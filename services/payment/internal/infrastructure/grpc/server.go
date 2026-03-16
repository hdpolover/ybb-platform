package grpc

import (
	"context"
	"encoding/json"

	"fmt"
	"log"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/events"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/domain/services"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
)

type PaymentGrpcServer struct {
	pb.UnimplementedPaymentServiceServer
	intentRepo      repositories.PaymentIntentRepository
	txRepo          repositories.PaymentTransactionRepository
	methodRepo      repositories.PaymentMethodRepository
	idempotencyRepo repositories.PaymentIdempotencyRepository
	gatewayFact     gateways.GatewayFactory
	publisher       messaging.EventPublisher
	defaultGateway  string
}

func NewPaymentGrpcServer(
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	methodRepo repositories.PaymentMethodRepository,
	idempotencyRepo repositories.PaymentIdempotencyRepository,
	gatewayFact gateways.GatewayFactory,
	publisher messaging.EventPublisher,
	defaultGateway string,
) *PaymentGrpcServer {
	return &PaymentGrpcServer{
		intentRepo:      intentRepo,
		txRepo:          txRepo,
		methodRepo:      methodRepo,
		idempotencyRepo: idempotencyRepo,
		gatewayFact:     gatewayFact,
		publisher:       publisher,
		defaultGateway:  defaultGateway,
	}
}

func (s *PaymentGrpcServer) CreateIntent(ctx context.Context, req *pb.CreateIntentRequest) (*pb.CreateIntentResponse, error) {
	metadata := make(map[string]interface{})
	for k, v := range req.Metadata {
		metadata[k] = v
	}

	// Store extended payment info in metadata for accurate processing
	if req.CustomerName != "" {
		metadata["customer_name"] = req.CustomerName
	}
	if req.CustomerEmail != "" {
		metadata["customer_email"] = req.CustomerEmail
	}
	if req.CustomerPhone != "" {
		metadata["customer_phone"] = req.CustomerPhone
	}
	if req.Description != "" {
		metadata["description"] = req.Description
	}
	if len(req.ItemDetails) > 0 {
		metadata["item_details"] = req.ItemDetails
	}

	intent := entities.NewPaymentIntent(
		req.UserId,
		float64(req.Amount),
		req.Currency,
		req.ReferenceType,
		req.ReferenceId,
		metadata,
	)

	if req.ParticipantId != "" {
		intent.ParticipantID = &req.ParticipantId
	}

	if err := s.intentRepo.Create(ctx, intent); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create intent: %v", err)
	}

	return &pb.CreateIntentResponse{
		IntentId:     intent.ID,
		Status:       string(intent.Status),
		ClientSecret: intent.ClientSecret,
	}, nil
}

func (s *PaymentGrpcServer) GetPaymentMethods(ctx context.Context, req *pb.GetPaymentMethodsRequest) (*pb.GetPaymentMethodsResponse, error) {
	// Fetch all enabled methods from DB
	paymentMethods, err := s.methodRepo.FindAll(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to fetch methods: %v", err)
	}

	methods := []*pb.PaymentMethod{}
	for _, m := range paymentMethods {
		if !m.IsActive {
			continue
		}

		fee, _, _ := services.CalculateFee(&m, float64(req.Amount))

		// Map to Proto
		// Note: Category defaults provided if empty in DB
		category := "bank_transfer" // fallback
		if m.GatewayType != "" {
			category = m.GatewayType
		} else if m.Type.IsManual() {
			category = "manual"
		}

		methods = append(methods, &pb.PaymentMethod{
			Id:           m.Code, // Use Code (e.g. "midtrans_header") as ID for frontend
			Name:         m.DisplayName,
			Category:     category,
			ImageUrl:     m.Icon,
			EstimatedFee: fee,
			IsSurcharge:  m.Config.IsSurcharge,
		})
	}

	return &pb.GetPaymentMethodsResponse{Methods: methods}, nil
}

func (s *PaymentGrpcServer) ProcessPayment(ctx context.Context, req *pb.ProcessPaymentRequest) (*pb.ProcessPaymentResponse, error) {
	var idempotencyRecord *entities.PaymentIdempotencyKey
	if idempotencyKey := grpcIdempotencyKey(ctx); idempotencyKey != "" && s.idempotencyRepo != nil {
		requestHash, hashErr := services.BuildIdempotencyRequestHash(map[string]interface{}{
			"intent_id":         req.IntentId,
			"payment_method_id": req.PaymentMethodId,
			"gateway_token":     req.GatewayToken,
			"payment_details":   req.PaymentDetails,
		})
		if hashErr != nil {
			return nil, status.Errorf(codes.Internal, "failed to compute idempotency hash: %v", hashErr)
		}

		var err error
		idempotencyRecord, err = s.idempotencyRepo.FindByKey(ctx, idempotencyKey, "grpc_process_payment")
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to load idempotency key: %v", err)
		}
		if validationErr := services.ValidateIdempotencyRecord(idempotencyRecord, req.IntentId, requestHash); validationErr != nil {
			return nil, status.Error(codes.AlreadyExists, validationErr.Error())
		}
		if idempotencyRecord != nil {
			if idempotencyRecord.Status == entities.PaymentIdempotencyStatusCompleted && len(idempotencyRecord.ResponseBody) > 0 {
				var resp pb.ProcessPaymentResponse
				if err := json.Unmarshal(idempotencyRecord.ResponseBody, &resp); err == nil {
					return &resp, nil
				}
			}
			if idempotencyRecord.Status == entities.PaymentIdempotencyStatusFailed {
				return nil, status.Error(codes.FailedPrecondition, idempotencyRecord.ErrorMessage)
			}
		}
		if idempotencyRecord == nil {
			idempotencyRecord = entities.NewPaymentIdempotencyKey(idempotencyKey, "grpc_process_payment", req.IntentId, requestHash)
			if err := s.idempotencyRepo.Create(ctx, idempotencyRecord); err != nil {
				return nil, status.Error(codes.AlreadyExists, "request with this idempotency key is already processing")
			}
		}
	}

	// 1. Get Intent
	intent, err := s.intentRepo.FindByID(ctx, req.IntentId)
	if err != nil {
		s.failIdempotency(ctx, idempotencyRecord, err)
		return nil, status.Errorf(codes.NotFound, "intent not found")
	}

	// 2. Fetch Payment Method for Fee Calculation
	method, err := s.methodRepo.FindByCode(ctx, req.PaymentMethodId)
	if err != nil {
		s.failIdempotency(ctx, idempotencyRecord, err)
		// Fallback or Error?
		// Ideally we should strict check. But if manual ID was passed...
		// Let's assume passed ID is 'code'
		return nil, status.Errorf(codes.InvalidArgument, "invalid payment method: %v", err)
	}

	// Calculate Fees
	fee, total, net := services.CalculateFee(method, intent.Amount)

	// 3. Create Transaction (Pending)
	tx := entities.NewPaymentTransaction(intent.ID, req.PaymentMethodId, total)
	tx.AmountSubtotal = intent.Amount
	tx.AmountTotal = total
	tx.FeeProvider = fee
	tx.NetAmount = net
	tx.Currency = intent.Currency

	if err := s.txRepo.Create(ctx, tx); err != nil {
		s.failIdempotency(ctx, idempotencyRecord, err)
		return nil, status.Errorf(codes.Internal, "failed to create transaction: %v", err)
	}

	// Special Handling for Manual Methods
	if method.Type.IsManual() {
		// Create metadata with bank info
		meta := map[string]string{
			"is_manual":      "true",
			"bank_name":      method.BankName,
			"account_number": method.AccountNumber,
			"account_name":   method.AccountName,
			"instructions":   method.Instructions,
		}

		// Manual payments are waiting for proof/admin review.
		tx.Status = entities.TransactionStatusNeedsReview

		// Save metadata to tx.GatewayResponse
		gwRespMap := map[string]interface{}{}
		for k, v := range meta {
			gwRespMap[k] = v
		}
		rawBytes, _ := json.Marshal(gwRespMap)
		tx.GatewayResponse = rawBytes
		s.txRepo.Update(ctx, tx)

		response := &pb.ProcessPaymentResponse{
			Status:        string(tx.Status),
			TransactionId: tx.ID,
			Action: &pb.ProcessPaymentAction{
				Type: "manual_transfer",
			},
			Metadata: meta,
		}
		s.completeIdempotency(ctx, idempotencyRecord, tx.ID, response)
		return response, nil
	}

	gatewayName, err := services.ResolveGatewayName(method, s.defaultGateway)
	if err != nil {
		s.failIdempotency(ctx, idempotencyRecord, err)
		return nil, status.Errorf(codes.InvalidArgument, "invalid payment method gateway: %v", err)
	}

	gateway, err := s.gatewayFact.GetGateway(gatewayName)
	if err != nil {
		s.failIdempotency(ctx, idempotencyRecord, err)
		return nil, status.Errorf(codes.Internal, "gateway configuration error: %s", gatewayName)
	}

	// Parse Payment Details
	var paymentDetails map[string]interface{}
	if req.PaymentDetails != nil && req.PaymentDetails.DetailsJson != "" {
		_ = json.Unmarshal([]byte(req.PaymentDetails.DetailsJson), &paymentDetails)
	}

	// Extract customer details from intent metadata or fallback
	// In real world, we might fetch User entity here.
	customerName := "Guest"
	customerEmail := "guest@example.com"
	customerPhone := "0800000000"
	var itemDetails []gateways.ItemDetails

	var metaMap map[string]interface{}
	if len(intent.Metadata) > 0 {
		if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
			if n, ok := metaMap["customer_name"].(string); ok && n != "" {
				customerName = n
			}
			if e, ok := metaMap["customer_email"].(string); ok && e != "" {
				customerEmail = e
			} else if e, ok := metaMap["email"].(string); ok && e != "" {
				customerEmail = e
			}
			if p, ok := metaMap["customer_phone"].(string); ok && p != "" {
				customerPhone = p
			}

			// Extract items
			if itemsRaw, ok := metaMap["item_details"]; ok {
				if rawBytes, err := json.Marshal(itemsRaw); err == nil {
					_ = json.Unmarshal(rawBytes, &itemDetails)
				}
			}
		}
	}

	// Ensure at least one item
	if len(itemDetails) == 0 {
		desc := "Payment"
		if d, ok := metaMap["description"].(string); ok && d != "" {
			desc = d
		} else if intent.ReferenceType != "" {
			desc = fmt.Sprintf("%s - %s", intent.ReferenceType, intent.ReferenceID)
		}

		itemDetails = append(itemDetails, gateways.ItemDetails{
			ID:   intent.ReferenceID,
			Name: desc,
			// Assuming IDR/No-decimal currency for price mapping
			Price:    int64(intent.Amount),
			Quantity: 1,
		})
	}

	// Validate Item Sum for Gateway Consistency (e.g. Midtrans rejects if Sum != Gross Amount)
	// If Surcharge is applied, AmountTotal > sum(items). We must add the fee as an item.
	var itemSum int64
	for _, it := range itemDetails {
		itemSum += it.Price * int64(it.Quantity)
	}

	totalChargeInt := int64(tx.AmountTotal)
	if itemSum != totalChargeInt {
		diff := totalChargeInt - itemSum
		if diff > 0 {
			// Surcharge / Fee
			itemDetails = append(itemDetails, gateways.ItemDetails{
				ID:       "SERVICE-FEE",
				Name:     "Service Fee",
				Price:    diff,
				Quantity: 1,
			})
		} else {
			// Weird discrepancy (maybe rounding or discount logic).
			// To be safe and prevent gateway error: fallback to single aggregate item.
			itemDetails = []gateways.ItemDetails{
				{
					ID:       intent.ReferenceID,
					Name:     "Payment Total (Consolidated)",
					Price:    totalChargeInt,
					Quantity: 1,
				},
			}
		}
	}

	chargeReq := &gateways.ChargePaymentRequest{
		TransactionID:   tx.ID,
		IntentID:        intent.ID,
		Amount:          tx.AmountTotal, // Charge the TOTAL (inc surcharge if any)
		Currency:        intent.Currency,
		PaymentMethodID: req.PaymentMethodId,
		GatewayToken:    req.GatewayToken,
		PaymentDetails:  paymentDetails,
		Items:           itemDetails, // Pass items strictly
		CustomerDetails: gateways.CustomerDetails{
			Name:  customerName,
			Email: customerEmail,
			Phone: customerPhone,
		},
	}

	resp, err := gateway.ChargePayment(ctx, chargeReq)
	if err != nil {
		tx.Status = entities.TransactionStatusFailed

		errMsg := err.Error()
		if len(errMsg) > 250 {
			errMsg = errMsg[:250]
		}
		tx.ErrorCode = errMsg

		s.txRepo.Update(ctx, tx)
		s.failIdempotency(ctx, idempotencyRecord, err)
		return nil, status.Errorf(codes.Internal, "payment gateway error: %v", err)
	}

	// 4. Update Transaction
	tx.GatewayReferenceID = resp.GatewayReferenceID
	if resp.Status == "SUCCESS" {
		tx.Status = entities.TransactionStatusSuccess
		intent.Status = entities.PaymentIntentStatusSucceeded
		s.intentRepo.Update(ctx, intent)

		// Publish Succeeded Event
		// Extract email from metadata
		email := ""
		if len(intent.Metadata) > 0 {
			var meta map[string]interface{}
			if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
				if e, ok := meta["email"].(string); ok {
					email = e
				}
				if e, ok := meta["customer_email"].(string); ok && email == "" {
					email = e
				}
			}
		}

		event := events.NewPaymentEvent(
			events.PaymentSucceededEvent,
			tx.ID,
			intent.ReferenceID,
			intent.UserID,
			email,
			intent.Amount,
			intent.Currency,
			"SUCCEEDED",
			req.PaymentMethodId,
		)

		// Populate event metadata from intent metadata
		if len(intent.Metadata) > 0 {
			var meta map[string]interface{}
			if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
				event.Metadata = meta
			}
		}

		if err := s.publisher.Publish(ctx, event); err != nil {
			// Log error but don't fail transaction
			fmt.Printf("failed to publish success event: %v\n", err)
		}

	} else if resp.Status == "FAILED" {
		tx.Status = entities.TransactionStatusFailed

		// Publish Failed Event
		// Extract email
		email := ""
		if len(intent.Metadata) > 0 {
			var meta map[string]interface{}
			if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
				if e, ok := meta["email"].(string); ok {
					email = e
				}
				if e, ok := meta["customer_email"].(string); ok && email == "" {
					email = e
				}
			}
		}

		event := events.NewPaymentEvent(
			events.PaymentFailedEvent,
			tx.ID,
			intent.ReferenceID,
			intent.UserID,
			email,
			intent.Amount,
			intent.Currency,
			"FAILED",
			req.PaymentMethodId,
		)
		if err := s.publisher.Publish(ctx, event); err != nil {
			fmt.Printf("failed to publish failed event: %v\n", err)
		}
	} else {
		tx.Status = entities.TransactionStatusPending
	}

	if resp.Metadata != nil {
		rawBytes, _ := json.Marshal(resp.Metadata)
		tx.GatewayResponse = rawBytes
	}

	// Prepare metadata for proto response
	var protoMetadata map[string]string
	if resp.Metadata != nil {
		protoMetadata = make(map[string]string)
		for k, v := range resp.Metadata {
			protoMetadata[k] = fmt.Sprintf("%v", v)
		}
	}

	s.txRepo.Update(ctx, tx)

	response := &pb.ProcessPaymentResponse{
		Status:        resp.Status,
		TransactionId: tx.ID,
		Action: &pb.ProcessPaymentAction{
			Type: resp.ActionType,
			Url:  resp.ActionURL,
		},
		Metadata: protoMetadata,
	}
	s.completeIdempotency(ctx, idempotencyRecord, tx.ID, response)
	return response, nil
}

func grpcIdempotencyKey(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	for _, header := range []string{"idempotency-key", "x-idempotency-key"} {
		values := md.Get(header)
		if len(values) > 0 && values[0] != "" {
			return values[0]
		}
	}
	return ""
}

func (s *PaymentGrpcServer) completeIdempotency(ctx context.Context, record *entities.PaymentIdempotencyKey, transactionID string, response *pb.ProcessPaymentResponse) {
	if record == nil || s.idempotencyRepo == nil || response == nil {
		return
	}
	record.Status = entities.PaymentIdempotencyStatusCompleted
	record.TransactionID = transactionID
	record.ErrorMessage = ""
	record.UpdatedAt = time.Now().UTC()
	if rawBytes, err := json.Marshal(response); err == nil {
		record.ResponseBody = rawBytes
	}
	if err := s.idempotencyRepo.Update(ctx, record); err != nil {
		log.Printf("failed to update grpc idempotency record: %v", err)
	}
}

func (s *PaymentGrpcServer) failIdempotency(ctx context.Context, record *entities.PaymentIdempotencyKey, idempotencyErr error) {
	if record == nil || s.idempotencyRepo == nil || idempotencyErr == nil {
		return
	}
	record.Status = entities.PaymentIdempotencyStatusFailed
	record.ErrorMessage = idempotencyErr.Error()
	record.UpdatedAt = time.Now().UTC()
	if err := s.idempotencyRepo.Update(ctx, record); err != nil {
		log.Printf("failed to update grpc idempotency failure: %v", err)
	}
}

func (s *PaymentGrpcServer) SubmitManualPayment(ctx context.Context, req *pb.SubmitManualPaymentRequest) (*pb.SubmitManualPaymentResponse, error) {
	// 1. Get Intent
	intent, err := s.intentRepo.FindByID(ctx, req.IntentId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "intent not found")
	}

	// 2. Create Transaction (Pending)
	// We treat "manual_transfer" as the method ID
	tx := entities.NewPaymentTransaction(intent.ID, "manual_transfer", intent.Amount)

	// 3. Store Proof details in GatewayResponse
	proofData := map[string]interface{}{
		"proof_url":     req.ProofFileUrl,
		"proof_file_id": req.ProofFileId,
		"notes":         req.Details,
		"is_manual":     true,
	}

	rawProof, _ := json.Marshal(proofData)
	tx.GatewayResponse = rawProof

	email := ""
	if len(intent.Metadata) > 0 {
		var meta map[string]interface{}
		if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
			if e, ok := meta["email"].(string); ok {
				email = e
			}
			if e, ok := meta["customer_email"].(string); ok && email == "" {
				email = e
			}
		}
	}

	event := events.NewPaymentEvent(
		events.PaymentCreatedEvent,
		tx.ID,
		intent.ReferenceID,
		intent.UserID,
		email,
		intent.Amount,
		intent.Currency,
		"PENDING_REVIEW",
		"manual_transfer",
	)

	// Persist Transaction
	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create manual transaction: %v", err)
	}

	s.publisher.Publish(ctx, event)

	return &pb.SubmitManualPaymentResponse{
		Status:        "PENDING_REVIEW", // Informational string for frontend
		TransactionId: tx.ID,
	}, nil
}

func (s *PaymentGrpcServer) VerifyManualPayment(ctx context.Context, req *pb.VerifyManualPaymentRequest) (*pb.VerifyManualPaymentResponse, error) {
	// 1. Get Transaction
	tx, err := s.txRepo.FindByID(ctx, req.TransactionId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "transaction not found")
	}

	intent, err := s.intentRepo.FindByID(ctx, tx.IntentID)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "intent not found associated with transaction")
	}

	// Extract email
	email := ""
	if len(intent.Metadata) > 0 {
		var meta map[string]interface{}
		if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
			if e, ok := meta["email"].(string); ok {
				email = e
			}
			if e, ok := meta["customer_email"].(string); ok && email == "" {
				email = e
			}
		}
	}

	// 3. Update Status
	if req.Status == "SUCCESS" {
		tx.Status = entities.TransactionStatusSuccess
		intent.Status = entities.PaymentIntentStatusSucceeded
		// Update Intent
		if err := s.intentRepo.Update(ctx, intent); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update intent status: %v", err)
		}

		// Publish Succeeded Event
		event := events.NewPaymentEvent(
			events.PaymentSucceededEvent,
			tx.ID,
			intent.ReferenceID,
			intent.UserID,
			email,
			intent.Amount,
			intent.Currency,
			"SUCCEEDED",
			"manual_transfer",
		)

		if len(intent.Metadata) > 0 {
			var meta map[string]interface{}
			if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
				event.Metadata = meta
			}
		}

		s.publisher.Publish(ctx, event)

	} else if req.Status == "FAILED" {
		tx.Status = entities.TransactionStatusFailed
		tx.ErrorCode = "MANUAL_REJECTION: " + req.Reason

		// Publish Failed Event
		event := events.NewPaymentEvent(
			events.PaymentFailedEvent,
			tx.ID,
			intent.ReferenceID,
			intent.UserID,
			email,
			intent.Amount,
			intent.Currency,
			"FAILED",
			"manual_transfer",
		)
		s.publisher.Publish(ctx, event)

	} else {
		return nil, status.Errorf(codes.InvalidArgument, "invalid status")
	}

	// Audit/Admin info in Metadata?
	// For now just save the tx update
	if err := s.txRepo.Update(ctx, tx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update transaction: %v", err)
	}

	return &pb.VerifyManualPaymentResponse{
		Status: string(tx.Status),
	}, nil
}

func (s *PaymentGrpcServer) GetIntentsByReference(ctx context.Context, req *pb.GetIntentsByReferenceRequest) (*pb.GetIntentsByReferenceResponse, error) {
	intents, err := s.intentRepo.FindByReference(ctx, req.ReferenceType, req.ReferenceId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get intents: %v", err)
	}

	pbIntents := make([]*pb.PaymentIntent, 0, len(intents))
	for _, intent := range intents {

		var metaMap map[string]interface{}
		metadata := make(map[string]string)

		if len(intent.Metadata) > 0 {
			if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
				for k, v := range metaMap {
					if strVal, ok := v.(string); ok {
						metadata[k] = strVal
					}
				}
			}
		}

		// Extract fields that were stored in JSONB but need to be returned explicitly
		var cName, cEmail, cPhone, desc string
		if s, ok := metaMap["customer_name"].(string); ok {
			cName = s
		}
		if s, ok := metaMap["customer_email"].(string); ok {
			cEmail = s
		}
		if s, ok := metaMap["customer_phone"].(string); ok {
			cPhone = s
		}
		if s, ok := metaMap["description"].(string); ok {
			desc = s
		}

		var pbItems []*pb.ItemDetail
		if itemsRaw, ok := metaMap["item_details"]; ok {
			if b, err := json.Marshal(itemsRaw); err == nil {
				_ = json.Unmarshal(b, &pbItems)
			}
		}

		pbIntents = append(pbIntents, &pb.PaymentIntent{
			Id:            intent.ID,
			UserId:        intent.UserID,
			Amount:        int64(intent.Amount),
			Currency:      intent.Currency,
			Status:        string(intent.Status),
			CreatedAt:     intent.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			ReferenceType: intent.ReferenceType,
			ReferenceId:   intent.ReferenceID,
			Metadata:      metadata,
			CustomerName:  cName,
			CustomerEmail: cEmail,
			CustomerPhone: cPhone,
			Description:   desc,
			ItemDetails:   pbItems,
		})
	}

	return &pb.GetIntentsByReferenceResponse{Intents: pbIntents}, nil
}

// --- Admin Payment Method Management ---

func mapEntityToAdminProto(m entities.PaymentMethodEntity) *pb.AdminPaymentMethod {
	return &pb.AdminPaymentMethod{
		Id:                m.ID,
		Name:              m.Name,
		Type:              string(m.Type),
		Code:              m.Code,
		IsActive:          m.IsActive,
		DisplayName:       m.DisplayName,
		Description:       m.Description,
		Icon:              m.Icon,
		GatewayName:       m.GatewayName,
		GatewayType:       m.GatewayType,
		BankName:          m.BankName,
		AccountNumber:     m.AccountNumber,
		AccountName:       m.AccountName,
		Instructions:      m.Instructions,
		RequiresProof:     m.RequiresProof,
		AdminInstructions: m.AdminInstructions,
		Config: &pb.FeeConfig{
			FixedFee:      m.Config.FixedFee,
			PercentageFee: m.Config.PercentageFee,
			MinFee:        m.Config.MinFee,
			Currency:      m.Config.Currency,
			IsSurcharge:   m.Config.IsSurcharge,
		},
		SortOrder: int32(m.SortOrder),
	}
}

func (s *PaymentGrpcServer) AdminListPaymentMethods(ctx context.Context, req *pb.AdminListPaymentMethodsRequest) (*pb.AdminListPaymentMethodsResponse, error) {
	methods, err := s.methodRepo.FindAll(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to fetch methods: %v", err)
	}

	var pbMethods []*pb.AdminPaymentMethod
	for _, m := range methods {
		pbMethods = append(pbMethods, mapEntityToAdminProto(m))
	}
	return &pb.AdminListPaymentMethodsResponse{Methods: pbMethods}, nil
}

func (s *PaymentGrpcServer) AdminGetPaymentMethod(ctx context.Context, req *pb.AdminGetPaymentMethodRequest) (*pb.AdminGetPaymentMethodResponse, error) {
	m, err := s.methodRepo.FindByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "not found: %v", err)
	}
	return &pb.AdminGetPaymentMethodResponse{Method: mapEntityToAdminProto(*m)}, nil
}

func (s *PaymentGrpcServer) AdminCreatePaymentMethod(ctx context.Context, req *pb.AdminCreatePaymentMethodRequest) (*pb.AdminCreatePaymentMethodResponse, error) {
	cfg := entities.FeeConfig{}
	if req.Config != nil {
		cfg.FixedFee = req.Config.FixedFee
		cfg.PercentageFee = req.Config.PercentageFee
		cfg.MinFee = req.Config.MinFee
		cfg.Currency = req.Config.Currency
		cfg.IsSurcharge = req.Config.IsSurcharge
	}

	m := entities.PaymentMethodEntity{
		Name:              req.Name,
		Type:              entities.PaymentMethodType(req.Type),
		Code:              req.Code,
		IsActive:          req.IsActive,
		DisplayName:       req.DisplayName,
		Description:       req.Description,
		Icon:              req.Icon,
		GatewayName:       req.GatewayName,
		GatewayType:       req.GatewayType,
		BankName:          req.BankName,
		AccountNumber:     req.AccountNumber,
		AccountName:       req.AccountName,
		Instructions:      req.Instructions,
		RequiresProof:     req.RequiresProof,
		AdminInstructions: req.AdminInstructions,
		Config:            cfg,
		SortOrder:         int(req.SortOrder),
	}

	if err := s.methodRepo.Create(ctx, &m); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create: %v", err)
	}

	return &pb.AdminCreatePaymentMethodResponse{Id: m.ID}, nil
}

func (s *PaymentGrpcServer) AdminUpdatePaymentMethod(ctx context.Context, req *pb.AdminUpdatePaymentMethodRequest) (*pb.AdminUpdatePaymentMethodResponse, error) {
	m, err := s.methodRepo.FindByID(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "not found")
	}

	// Update fields
	m.Name = req.Name
	m.Type = entities.PaymentMethodType(req.Type)
	m.Code = req.Code
	m.IsActive = req.IsActive
	m.DisplayName = req.DisplayName
	m.Description = req.Description
	m.Icon = req.Icon
	m.GatewayName = req.GatewayName
	m.GatewayType = req.GatewayType
	m.BankName = req.BankName
	m.AccountNumber = req.AccountNumber
	m.AccountName = req.AccountName
	m.Instructions = req.Instructions
	m.RequiresProof = req.RequiresProof
	m.AdminInstructions = req.AdminInstructions
	m.SortOrder = int(req.SortOrder)

	if req.Config != nil {
		m.Config.FixedFee = req.Config.FixedFee
		m.Config.PercentageFee = req.Config.PercentageFee
		m.Config.MinFee = req.Config.MinFee
		m.Config.Currency = req.Config.Currency
		m.Config.IsSurcharge = req.Config.IsSurcharge
	}

	if err := s.methodRepo.Update(ctx, m); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update: %v", err)
	}

	return &pb.AdminUpdatePaymentMethodResponse{Id: m.ID}, nil
}

func (s *PaymentGrpcServer) AdminDeletePaymentMethod(ctx context.Context, req *pb.AdminDeletePaymentMethodRequest) (*pb.AdminDeletePaymentMethodResponse, error) {
	if err := s.methodRepo.Delete(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete: %v", err)
	}
	return &pb.AdminDeletePaymentMethodResponse{Success: true}, nil
}

func (s *PaymentGrpcServer) AdminListPayments(ctx context.Context, req *pb.AdminListPaymentsRequest) (*pb.AdminListPaymentsResponse, error) {
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 10
	}
	page := int(req.Page)
	if page <= 0 {
		page = 1
	}

	filter := repositories.PaymentIntentFilter{
		UserID:    req.UserId,
		Status:    req.Status,
		ProgramID: req.ProgramId,
		FromDate:  req.FromDate,
		ToDate:    req.ToDate,
		Page:      page,
		Limit:     limit,
	}

	intents, total, err := s.intentRepo.FindAll(ctx, filter)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list payments: %v", err)
	}

	var pbPayments []*pb.PaymentIntent
	for _, intent := range intents {
		var metaMap map[string]interface{}
		metadata := make(map[string]string)

		if len(intent.Metadata) > 0 {
			if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
				for k, v := range metaMap {
					if strVal, ok := v.(string); ok {
						metadata[k] = strVal
					}
				}
			}
		}

		var cName, cEmail, cPhone, desc string
		if s, ok := metaMap["customer_name"].(string); ok {
			cName = s
		}
		if s, ok := metaMap["customer_email"].(string); ok {
			cEmail = s
		}
		if s, ok := metaMap["customer_phone"].(string); ok {
			cPhone = s
		}
		if s, ok := metaMap["description"].(string); ok {
			desc = s
		}

		var pbItems []*pb.ItemDetail
		if itemsRaw, ok := metaMap["item_details"]; ok {
			if b, err := json.Marshal(itemsRaw); err == nil {
				_ = json.Unmarshal(b, &pbItems)
			}
		}

		pbPayments = append(pbPayments, &pb.PaymentIntent{
			Id:            intent.ID,
			UserId:        intent.UserID,
			Amount:        int64(intent.Amount),
			Currency:      intent.Currency,
			Status:        string(intent.Status),
			CreatedAt:     intent.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			ReferenceType: intent.ReferenceType,
			ReferenceId:   intent.ReferenceID,
			Metadata:      metadata,
			CustomerName:  cName,
			CustomerEmail: cEmail,
			CustomerPhone: cPhone,
			Description:   desc,
			ItemDetails:   pbItems,
		})
	}

	totalPages := (int(total) + limit - 1) / limit

	return &pb.AdminListPaymentsResponse{
		Payments:   pbPayments,
		Total:      int32(total),
		Page:       int32(page),
		TotalPages: int32(totalPages),
	}, nil
}
