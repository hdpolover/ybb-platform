package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// overlayUpsertColumns are the columns updated on ON CONFLICT for
// program_payment_methods. PUT semantics: the caller sends the full desired
// state for the row, so every overridable column (including nil overrides,
// which clear a previous override) is written on conflict.
var overlayUpsertColumns = []string{
	"is_enabled",
	"description_override",
	"instructions_override",
	"admin_instructions_override",
	"sort_order",
	"updated_at",
}

// ProgramPaymentMethodRepository handles database access for the per-program
// payment method overlay using GORM.
type ProgramPaymentMethodRepository struct {
	db *gorm.DB
}

// NewProgramPaymentMethodRepository creates a new repository instance
func NewProgramPaymentMethodRepository(db *gorm.DB) *ProgramPaymentMethodRepository {
	return &ProgramPaymentMethodRepository{
		db: db,
	}
}

// FindMergedByProgram implements the fallback contract: a program with zero
// overlay rows is "unconfigured" and returns all active master methods
// as-is (today's behavior). A program with ≥1 overlay row is "configured"
// and returns only its is_enabled=true methods, merged with master via
// COALESCE, in overlay sort order.
func (r *ProgramPaymentMethodRepository) FindMergedByProgram(ctx context.Context, programID string) ([]repositories.ProgramMethodView, error) {
	var overlayCount int64
	if err := r.db.WithContext(ctx).
		Model(&entities.ProgramPaymentMethodEntity{}).
		Where("program_id = ?", programID).
		Count(&overlayCount).Error; err != nil {
		log.Printf("Failed to count program payment method overrides: %v", err)
		return nil, fmt.Errorf("failed to count program payment method overrides: %w", err)
	}

	if overlayCount == 0 {
		return r.findUnconfiguredDefault(ctx, programID)
	}
	return r.findConfigured(ctx, programID)
}

// findUnconfiguredDefault returns every active master method as a
// default-enabled view with no overrides — the fallback path.
func (r *ProgramPaymentMethodRepository) findUnconfiguredDefault(ctx context.Context, programID string) ([]repositories.ProgramMethodView, error) {
	var masters []entities.PaymentMethodEntity
	if err := r.db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("sort_order asc").
		Find(&masters).Error; err != nil {
		log.Printf("Failed to fetch master payment methods: %v", err)
		return nil, fmt.Errorf("failed to fetch master payment methods: %w", err)
	}

	views := make([]repositories.ProgramMethodView, 0, len(masters))
	for _, m := range masters {
		views = append(views, defaultView(programID, m))
	}
	return views, nil
}

// findConfigured merges the program's enabled overlay rows onto their
// master rows, in overlay sort order. Master rows that are missing or no
// longer active are skipped — a program should never surface a method that
// no longer exists (or was deactivated) in master data.
func (r *ProgramPaymentMethodRepository) findConfigured(ctx context.Context, programID string) ([]repositories.ProgramMethodView, error) {
	var overlays []entities.ProgramPaymentMethodEntity
	if err := r.db.WithContext(ctx).
		Where("program_id = ? AND is_enabled = ?", programID, true).
		Order("sort_order asc").
		Find(&overlays).Error; err != nil {
		log.Printf("Failed to fetch program payment method overrides: %v", err)
		return nil, fmt.Errorf("failed to fetch program payment method overrides: %w", err)
	}
	if len(overlays) == 0 {
		return []repositories.ProgramMethodView{}, nil
	}

	methodIDs := make([]string, 0, len(overlays))
	for _, o := range overlays {
		methodIDs = append(methodIDs, o.PaymentMethodID)
	}

	var masters []entities.PaymentMethodEntity
	if err := r.db.WithContext(ctx).
		Where("id IN ? AND is_active = ?", methodIDs, true).
		Find(&masters).Error; err != nil {
		log.Printf("Failed to fetch master payment methods for program overrides: %v", err)
		return nil, fmt.Errorf("failed to fetch master payment methods for program overrides: %w", err)
	}
	masterByID := make(map[string]entities.PaymentMethodEntity, len(masters))
	for _, m := range masters {
		masterByID[m.ID] = m
	}

	views := make([]repositories.ProgramMethodView, 0, len(overlays))
	for _, o := range overlays {
		master, ok := masterByID[o.PaymentMethodID]
		if !ok {
			continue
		}
		views = append(views, overlayView(programID, master, o))
	}
	return views, nil
}

// UpsertOverride creates or updates a single overlay row for
// (programID, methodID) — the lazy-creation point for a program's first
// per-method override.
func (r *ProgramPaymentMethodRepository) UpsertOverride(ctx context.Context, programID string, methodID string, patch repositories.OverridePatch) error {
	row := buildOverlayRow(programID, methodID, patch)

	if err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "program_id"}, {Name: "payment_method_id"}},
			DoUpdates: clause.AssignmentColumns(overlayUpsertColumns),
		}).
		Create(&row).Error; err != nil {
		log.Printf("Failed to upsert program payment method override: %v", err)
		return fmt.Errorf("failed to upsert program payment method override: %w", err)
	}
	return nil
}

// UpsertFullSet upserts multiple overlay rows for a program in one
// transaction — used on first save to materialize the whole visible set at
// once, so toggling one method off doesn't silently disable the rest.
func (r *ProgramPaymentMethodRepository) UpsertFullSet(ctx context.Context, programID string, rows []repositories.OverridePatch) error {
	if len(rows) == 0 {
		return nil
	}

	toUpsert := make([]entities.ProgramPaymentMethodEntity, 0, len(rows))
	for _, patch := range rows {
		if patch.PaymentMethodID == "" {
			return fmt.Errorf("failed to upsert program payment methods: payment_method_id is required for each row")
		}
		toUpsert = append(toUpsert, buildOverlayRow(programID, patch.PaymentMethodID, patch))
	}

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "program_id"}, {Name: "payment_method_id"}},
			DoUpdates: clause.AssignmentColumns(overlayUpsertColumns),
		}).Create(&toUpsert).Error
	})
	if err != nil {
		log.Printf("Failed to bulk upsert program payment method overrides: %v", err)
		return fmt.Errorf("failed to bulk upsert program payment method overrides: %w", err)
	}
	return nil
}

// buildOverlayRow maps a patch onto a new overlay entity ready for
// ON CONFLICT upsert. Missing IsEnabled/SortOrder default to the same
// defaults as the DB column (true / 0) for first-time inserts.
func buildOverlayRow(programID, methodID string, patch repositories.OverridePatch) entities.ProgramPaymentMethodEntity {
	isEnabled := true
	if patch.IsEnabled != nil {
		isEnabled = *patch.IsEnabled
	}
	sortOrder := 0
	if patch.SortOrder != nil {
		sortOrder = *patch.SortOrder
	}

	return entities.ProgramPaymentMethodEntity{
		ProgramID:                 programID,
		PaymentMethodID:           methodID,
		IsEnabled:                 isEnabled,
		DescriptionOverride:       patch.DescriptionOverride,
		InstructionsOverride:      patch.InstructionsOverride,
		AdminInstructionsOverride: patch.AdminInstructionsOverride,
		SortOrder:                 sortOrder,
		UpdatedAt:                 time.Now(),
	}
}

// defaultView builds a ProgramMethodView for the unconfigured fallback path:
// master values as-is, enabled by default, no overrides.
func defaultView(programID string, m entities.PaymentMethodEntity) repositories.ProgramMethodView {
	return repositories.ProgramMethodView{
		ID:                m.ID,
		Name:              m.Name,
		Type:              m.Type,
		Code:              m.Code,
		IsActive:          m.IsActive,
		DisplayName:       m.DisplayName,
		Icon:              m.Icon,
		GatewayName:       m.GatewayName,
		GatewayType:       m.GatewayType,
		BankName:          m.BankName,
		AccountNumber:     m.AccountNumber,
		AccountName:       m.AccountName,
		RequiresProof:     m.RequiresProof,
		Config:            m.Config,
		ProgramID:         programID,
		IsConfigured:      false,
		IsEnabled:         true,
		Description:       m.Description,
		Instructions:      m.Instructions,
		AdminInstructions: m.AdminInstructions,
		SortOrder:         m.SortOrder,
		CreatedAt:         m.CreatedAt,
		UpdatedAt:         m.UpdatedAt,
	}
}

// overlayView builds a ProgramMethodView for the configured path: resolved
// (overlay-or-master) fields plus per-field has_override flags.
func overlayView(programID string, m entities.PaymentMethodEntity, o entities.ProgramPaymentMethodEntity) repositories.ProgramMethodView {
	description := m.Description
	hasDescriptionOverride := false
	if o.DescriptionOverride != nil {
		description = *o.DescriptionOverride
		hasDescriptionOverride = true
	}

	instructions := m.Instructions
	hasInstructionsOverride := false
	if o.InstructionsOverride != nil {
		instructions = *o.InstructionsOverride
		hasInstructionsOverride = true
	}

	adminInstructions := m.AdminInstructions
	hasAdminInstructionsOverride := false
	if o.AdminInstructionsOverride != nil {
		adminInstructions = *o.AdminInstructionsOverride
		hasAdminInstructionsOverride = true
	}

	return repositories.ProgramMethodView{
		ID:                           m.ID,
		Name:                         m.Name,
		Type:                         m.Type,
		Code:                         m.Code,
		IsActive:                     m.IsActive,
		DisplayName:                  m.DisplayName,
		Icon:                         m.Icon,
		GatewayName:                  m.GatewayName,
		GatewayType:                  m.GatewayType,
		BankName:                     m.BankName,
		AccountNumber:                m.AccountNumber,
		AccountName:                  m.AccountName,
		RequiresProof:                m.RequiresProof,
		Config:                       m.Config,
		ProgramID:                    programID,
		IsConfigured:                 true,
		IsEnabled:                    o.IsEnabled,
		Description:                  description,
		Instructions:                 instructions,
		AdminInstructions:            adminInstructions,
		SortOrder:                    o.SortOrder,
		HasDescriptionOverride:       hasDescriptionOverride,
		HasInstructionsOverride:      hasInstructionsOverride,
		HasAdminInstructionsOverride: hasAdminInstructionsOverride,
		CreatedAt:                    m.CreatedAt,
		UpdatedAt:                    o.UpdatedAt,
	}
}
