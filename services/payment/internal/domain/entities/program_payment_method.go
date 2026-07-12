package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProgramPaymentMethodEntity is a per-program overlay row on top of the shared
// PaymentMethodEntity master data. A program with zero rows here is
// "unconfigured" and the read path falls back to all active master methods —
// see ProgramPaymentMethodRepository.FindMergedByProgram.
type ProgramPaymentMethodEntity struct {
	ID              string `gorm:"type:uuid;primaryKey"                                      json:"id"`
	ProgramID       string `gorm:"type:uuid;not null;uniqueIndex:uq_program_method"           json:"program_id"`
	PaymentMethodID string `gorm:"type:uuid;not null;uniqueIndex:uq_program_method"           json:"payment_method_id"`
	IsEnabled       bool   `gorm:"not null;default:true"                                      json:"is_enabled"`

	// --- Overrides (nil = no override, fall back to master value) ---
	DescriptionOverride       *string `gorm:"type:text" json:"description_override"`
	InstructionsOverride      *string `gorm:"type:text" json:"instructions_override"`
	AdminInstructionsOverride *string `gorm:"type:text" json:"admin_instructions_override"`

	SortOrder int `gorm:"not null;default:0" json:"sort_order"`

	// --- Timestamps ---
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-" swaggerignore:"true"`
}

// TableName specifies the table name for GORM
func (ProgramPaymentMethodEntity) TableName() string {
	return "program_payment_methods"
}

// BeforeCreate hook to generate UUID
func (p *ProgramPaymentMethodEntity) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
