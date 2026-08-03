package repositories

import (
	"context"
	"time"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

// OverridePatch is the set of per-program fields an admin can override on a
// master payment method. Nil pointer fields mean "no change" on update and
// "no override" (fall back to master) on the merged read path.
type OverridePatch struct {
	PaymentMethodID           string
	IsEnabled                 *bool
	DescriptionOverride       *string
	InstructionsOverride      *string
	AdminInstructionsOverride *string
	SortOrder                 *int
}

// ProgramMethodView is the merged read model returned by FindMergedByProgram:
// the master payment method fields (account data, gateway config — never
// overridden per-program) plus the resolved (overlay-or-master) values for
// is_enabled/description/instructions/admin_instructions/sort_order, and
// per-field flags so the admin UI can show which fields are program-specific.
type ProgramMethodView struct {
	ID          string                     `json:"id"`
	Name        string                     `json:"name"`
	Type        entities.PaymentMethodType `json:"type"`
	Code        string                     `json:"code"`
	IsActive    bool                       `json:"is_active"`
	DisplayName string                     `json:"display_name"`
	Icon        string                     `json:"icon"`

	// --- Automatic Payment Fields (master-only, never overridden) ---
	GatewayName string `json:"gateway_name"`
	GatewayType string `json:"gateway_type"`

	// --- Manual Payment Fields (master-only, never overridden) ---
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	RequiresProof bool   `json:"requires_proof"`

	// --- Configuration (master-only) ---
	Config entities.FeeConfig `json:"config"`

	// --- Program context ---
	ProgramID    string `json:"program_id"`
	IsConfigured bool   `json:"is_configured"` // true if the program has ≥1 overlay row

	// --- Resolved (overlay-or-master) fields ---
	IsEnabled         bool   `json:"is_enabled"`
	Description       string `json:"description"`
	Instructions      string `json:"instructions"`
	AdminInstructions string `json:"admin_instructions"`
	SortOrder         int    `json:"sort_order"`

	// --- Per-field override flags ---
	HasDescriptionOverride       bool `json:"has_description_override"`
	HasInstructionsOverride      bool `json:"has_instructions_override"`
	HasAdminInstructionsOverride bool `json:"has_admin_instructions_override"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ProgramPaymentMethodRepository interface {
	// FindMergedByProgram implements the fallback contract: if the program has
	// zero overlay rows, it returns all active master methods as default-enabled
	// with no overrides. Otherwise it returns only the overlay's is_enabled=true
	// rows, merged with master via COALESCE, in overlay sort order.
	FindMergedByProgram(ctx context.Context, programID string) ([]ProgramMethodView, error)
	// FindAllForAdminByProgram returns every active master method for the admin
	// console, including ones this program has not enabled (IsEnabled=false),
	// so an admin can attach an existing shared method instead of being forced
	// to create a near-duplicate. Never use this for participant-facing reads.
	FindAllForAdminByProgram(ctx context.Context, programID string) ([]ProgramMethodView, error)
	// UpsertOverride creates or updates a single overlay row for (programID, methodID).
	UpsertOverride(ctx context.Context, programID string, methodID string, patch OverridePatch) error
	// UpsertFullSet upserts multiple overlay rows for a program in one transaction.
	// Used on first save to materialize the whole visible set at once.
	UpsertFullSet(ctx context.Context, programID string, rows []OverridePatch) error
}
