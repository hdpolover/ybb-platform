package services

import (
	"github.com/ybb-platform/payment/internal/domain/entities"
)

// CalculateFee returns the estimated fee and the total amount to be charged.
// If method.Config.IsSurcharge is TRUE: Total = Amount + Fee.
// If method.Config.IsSurcharge is FALSE (Absorb): Total = Amount. (Fee is just calculated for reporting).
//
// Returns:
// - fee: The calculated fee amount
// - totalCharge: The amount sent to the gateway
// - netAmount: The amount we realize (Total - Fee) or (Amount - Fee) depending on model
func CalculateFee(method *entities.PaymentMethodEntity, amount float64) (fee float64, totalCharge float64, netAmount float64) {
	config := method.Config

	// 1. Calculate Fee
	// Formula: Fixed + (Amount * %)
	// Note: For Surcharge, we usually calculate % based on the ORIGINAL amount, not the total.
	fee = config.FixedFee + (amount * config.PercentageFee)

	// Ensure min fee
	if fee < config.MinFee {
		fee = config.MinFee
	}

	// 2. Calculate Total & Net
	if config.IsSurcharge {
		// Customer Pays Fee
		totalCharge = amount + fee
		netAmount = amount // We get the full original amount
	} else {
		// We Absorb Fee
		totalCharge = amount
		netAmount = amount - fee
		if netAmount < 0 {
			netAmount = 0
		}
	}

	return fee, totalCharge, netAmount
}
