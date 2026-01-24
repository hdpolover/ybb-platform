package grpc

import (
	"context"
	"encoding/json"
	
	"fmt"
	
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/domain/events"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

type PaymentGrpcServer struct {
	pb.UnimplementedPaymentServiceServer
	intentRepo  repositories.PaymentIntentRepository
	txRepo      repositories.PaymentTransactionRepository
	gatewayFact gateways.GatewayFactory
	publisher   messaging.EventPublisher
}

func NewPaymentGrpcServer(
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	gatewayFact gateways.GatewayFactory,
	publisher messaging.EventPublisher,
) *PaymentGrpcServer {
	return &PaymentGrpcServer{
		intentRepo:  intentRepo,
		txRepo:      txRepo,
		gatewayFact: gatewayFact,
		publisher:   publisher,
	}
}

func (s *PaymentGrpcServer) CreateIntent(ctx context.Context, req *pb.CreateIntentRequest) (*pb.CreateIntentResponse, error) {
	metadata := make(map[string]interface{})
	for k, v := range req.Metadata {
		metadata[k] = v
	}

	intent := entities.NewPaymentIntent(
		req.UserId,
		float64(req.Amount),
		req.Currency,
		req.ReferenceType,
		req.ReferenceId,
		metadata,
	)
	intent.ParticipantID = req.ParticipantId

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
	// TODO: Fetch from dynamic config or DB
	methods := []*pb.PaymentMethod{
		{Id: "credit_card", Name: "Credit Card", Category: "card", ImageUrl: ""},
		{Id: "bca_va", Name: "BCA Virtual Account", Category: "bank_transfer", ImageUrl: ""},
		{Id: "bni_va", Name: "BNI Virtual Account", Category: "bank_transfer", ImageUrl: ""},
		{Id: "bri_va", Name: "BRI Virtual Account", Category: "bank_transfer", ImageUrl: ""},
		{Id: "permata_va", Name: "Permata Virtual Account", Category: "bank_transfer", ImageUrl: ""},
		{Id: "gopay", Name: "GoPay", Category: "ewallet", ImageUrl: ""},
		{Id: "shopeepay", Name: "ShopeePay", Category: "ewallet", ImageUrl: ""},
	}
	return &pb.GetPaymentMethodsResponse{Methods: methods}, nil
}

func (s *PaymentGrpcServer) ProcessPayment(ctx context.Context, req *pb.ProcessPaymentRequest) (*pb.ProcessPaymentResponse, error) {
	// 1. Get Intent
	intent, err := s.intentRepo.FindByID(ctx, req.IntentId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "intent not found")
	}

	// 2. Create Transaction (Pending)
	tx := entities.NewPaymentTransaction(intent.ID, req.PaymentMethodId, intent.Amount)
	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create transaction: %v", err)
	}

	// 3. Call Gateway
	gateway, err := s.gatewayFact.GetGateway("midtrans") // Default to midtrans
	if err != nil {
		return nil, status.Errorf(codes.Internal, "gateway configuration error")
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

	var metaMap map[string]interface{}
	if len(intent.Metadata) > 0 {
		if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
			if n, ok := metaMap["customer_name"].(string); ok { customerName = n }
			if e, ok := metaMap["customer_email"].(string); ok { customerEmail = e } // Try customer_email first
			if e, ok := metaMap["email"].(string); ok && customerEmail == "guest@example.com" { customerEmail = e } // Fallback to email
			if p, ok := metaMap["customer_phone"].(string); ok { customerPhone = p }
		}
	}

	chargeReq := &gateways.ChargePaymentRequest{
		TransactionID:   tx.ID,
		IntentID:        intent.ID,
		Amount:          intent.Amount,
		Currency:        intent.Currency,
		PaymentMethodID: req.PaymentMethodId,
		GatewayToken:    req.GatewayToken,
		PaymentDetails:  paymentDetails,
		CustomerDetails: gateways.CustomerDetails{
			Name:  customerName,
			Email: customerEmail,
			Phone: customerPhone,
		},
	}

	resp, err := gateway.ChargePayment(ctx, chargeReq)
	if err != nil {
		tx.Status = entities.TransactionStatusFailed
		tx.ErrorCode = err.Error()
		s.txRepo.Update(ctx, tx)
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

	s.txRepo.Update(ctx, tx)

	return &pb.ProcessPaymentResponse{
		Status:        resp.Status,
		TransactionId: tx.ID,
		Action: &pb.ProcessPaymentAction{
			Type: resp.ActionType,
			Url:  resp.ActionURL,
		},
	}, nil
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
		
        metadata := make(map[string]string)
        if len(intent.Metadata) > 0 {
             var metaMap map[string]interface{}
             if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
                 for k, v := range metaMap {
                     if strVal, ok := v.(string); ok {
                         metadata[k] = strVal
                     }
                 }
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
		})
	}

	return &pb.GetIntentsByReferenceResponse{Intents: pbIntents}, nil
}
