package gateways

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/coreapi" // WAJIB: Import ini untuk Verify/Cancel/Refund
	"github.com/midtrans/midtrans-go/snap"
	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// MidtransGateway implements PaymentGateway for Midtrans
type MidtransGateway struct {
	snapClient    snap.Client    // Client untuk Create Payment (Frontend)
	coreApiClient coreapi.Client // Client untuk Verify, Cancel, Refund (Backend)
	serverKey     string
	env           string
}

// NewMidtransGateway creates a new Midtrans payment gateway
func NewMidtransGateway(serverKey, clientKey, env string) *MidtransGateway {
	var midtransEnv midtrans.EnvironmentType
	if env == "production" {
		midtransEnv = midtrans.Production
	} else {
		midtransEnv = midtrans.Sandbox
	}

	// 1. Init Snap Client
	sClient := snap.Client{}
	sClient.New(serverKey, midtransEnv)

	// 2. Init Core API Client (Untuk Verify/Refund/Cancel)
	cClient := coreapi.Client{}
	cClient.New(serverKey, midtransEnv)

	return &MidtransGateway{
		snapClient:    sClient,
		coreApiClient: cClient,
		serverKey:     serverKey,
		env:           env,
	}
}

// GetName returns the gateway name
func (g *MidtransGateway) GetName() string {
	return "midtrans"
}

// CreatePayment creates a payment with Midtrans Snap
func (g *MidtransGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
    
    // 1. Tentukan Payment Method (Logic diperbaiki)
    // Default-nya nil (kosong/null), agar Midtrans menampilkan SEMUA.
    var enabledPayments []snap.SnapPaymentType

    // Jika user minta SPESIFIK (bukan automatic), baru kita isi list-nya.
    if req.PaymentMethod != "" && req.PaymentMethod != "automatic" {
        enabledPayments = []snap.SnapPaymentType{
            snap.SnapPaymentType(req.PaymentMethod),
        }
    }

    // 2. Build Snap request
    snapReq := &snap.Request{
        TransactionDetails: midtrans.TransactionDetails{
            OrderID:  req.Payment.ID,
            GrossAmt: int64(req.Payment.Amount),
        },
        CustomerDetail: &midtrans.CustomerDetails{
            FName: req.CustomerName,
            Email: req.CustomerEmail,
            Phone: req.CustomerPhone,
        },
        
        EnabledPayments: enabledPayments, 

        Callbacks: &snap.Callbacks{
            Finish: req.CallbackURL,
        },
    }

    // Create transaction
    snapResp, err := g.snapClient.CreateTransaction(snapReq)
    if err != nil {
        log.Printf("Midtrans CreateTransaction failed: %v", err)
        return nil, fmt.Errorf("midtrans create transaction failed: %w", err)
    }

    return &domainGateways.CreatePaymentResponse{
        RedirectURL:    snapResp.RedirectURL,
        Token:          snapResp.Token,
        GatewayOrderID: req.Payment.ID,
        Raw:            snapResp,
    }, nil
}

// VerifyPayment verifies payment status with Midtrans Core API
func (g *MidtransGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
    // 1. Panggil Core API CheckTransaction
    resp, err := g.coreApiClient.CheckTransaction(gatewayOrderID)
    
    // --- BAGIAN PERBAIKAN DIMULAI DARI SINI ---
    if err != nil {
        // Kita cek pesan errornya. Jika isinya "404" atau "Transaction doesn't exist",
        // Itu artinya user belum memilih metode pembayaran di halaman Snap.
        // KITA JANGAN RETURN ERROR, tapi return status PENDING.
        errMessage := err.Error()
        if strings.Contains(errMessage, "404") || strings.Contains(errMessage, "Transaction doesn't exist") {
            return &entities.Payment{
                ID:              gatewayOrderID,
                Status:          entities.PaymentStatusPending, // Paksa jadi Pending
                GatewayOrderID:  gatewayOrderID,
                GatewayResponse: map[string]interface{}{"status_message": "Transaction not found in Midtrans (Not started yet)"},
            }, nil
        }

        // Jika errornya BUKAN 404 (misal: koneksi putus), baru kita return error beneran
        return nil, fmt.Errorf("midtrans check transaction failed: %w", err)
    }
    // --- BAGIAN PERBAIKAN SELESAI ---

    // 2. Mapping Status dari Midtrans ke Entity Aplikasi (Kode lama tetap sama)
    var status entities.PaymentStatus
    
    transactionStatus := resp.TransactionStatus
    fraudStatus := resp.FraudStatus

    switch transactionStatus {
    case "capture":
        switch fraudStatus {
        case "challenge":
            status = entities.PaymentStatusProcessing
        case "accept":
            status = entities.PaymentStatusSuccess
        }
    case "settlement":
        status = entities.PaymentStatusSuccess
    case "deny", "cancel", "expire":
        status = entities.PaymentStatusFailed
    case "pending":
        status = entities.PaymentStatusPending
    default:
        status = entities.PaymentStatusProcessing
    }

    // Konversi Struct Response Midtrans ke map
    var rawResponse map[string]interface{}
    if data, err := json.Marshal(resp); err == nil {
        _ = json.Unmarshal(data, &rawResponse)
    }

    return &entities.Payment{
        ID:              gatewayOrderID,
        Status:          status,
        GatewayOrderID:  gatewayOrderID,
        GatewayResponse: rawResponse,
    }, nil
}

// HandleWebhook processes Midtrans webhook notification
func (g *MidtransGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	// 1. Parse JSON Payload
	var notification map[string]interface{}
	if err := json.Unmarshal(payload, &notification); err != nil {
		return nil, fmt.Errorf("failed to unmarshal notification: %w", err)
	}

	// 2. Ambil data penting
	orderID, _ := notification["order_id"].(string)
	statusCode, _ := notification["status_code"].(string)
	grossAmount, _ := notification["gross_amount"].(string)
	signatureKey, _ := notification["signature_key"].(string)
	transactionStatus, _ := notification["transaction_status"].(string)
	fraudStatus, _ := notification["fraud_status"].(string)

	// 3. Verifikasi Signature (Security Check)
	rawString := orderID + statusCode + grossAmount + g.serverKey
	hasher := sha512.New()
	hasher.Write([]byte(rawString))
	expectedSignature := hex.EncodeToString(hasher.Sum(nil))

	if signatureKey != expectedSignature {
		return nil, fmt.Errorf("invalid signature key")
	}

	// 4. Translate Status
	var paymentStatus entities.PaymentStatus

	switch transactionStatus {
	case "capture":
		switch fraudStatus {
		case "challenge":
			paymentStatus = entities.PaymentStatusProcessing
		case "accept":
			paymentStatus = entities.PaymentStatusSuccess
		}
	case "settlement":
		paymentStatus = entities.PaymentStatusSuccess
	case "deny", "cancel", "expire":
		paymentStatus = entities.PaymentStatusFailed
	case "pending":
		paymentStatus = entities.PaymentStatusPending
	default:
		paymentStatus = entities.PaymentStatusProcessing
	}

	return &entities.Payment{
		ID:              orderID,
		Status:          paymentStatus,
		GatewayOrderID:  orderID,
		GatewayResponse: notification,
	}, nil
}

// CancelPayment cancels a payment (Only works for Pending transactions)
func (g *MidtransGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	// Panggil Core API CancelTransaction
	// Note: Midtrans hanya mengizinkan cancel untuk transaksi yang statusnya masih Pending
	// atau Fraud Challenge.
	_, err := g.coreApiClient.CancelTransaction(gatewayOrderID)
	if err != nil {
		return fmt.Errorf("midtrans cancel transaction failed: %w", err)
	}
	return nil
}

// RefundPayment refunds a payment
func (g *MidtransGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	// Siapkan Request Refund
	req := &coreapi.RefundReq{
		Amount: int64(amount),
		Reason: "Refund requested by system/admin",
	}

	// Panggil Core API DirectRefundTransaction
	// Note: Fitur Direct Refund di Midtrans biasanya perlu diaktifkan by request ke support Midtrans
	_, err := g.coreApiClient.DirectRefundTransaction(gatewayOrderID, req)
	if err != nil {
		return fmt.Errorf("midtrans refund transaction failed: %w", err)
	}
	
	return nil
}