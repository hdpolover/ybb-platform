package persistence_test

import (
	"context"
	"testing"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const (
	testProgramID = "11111111-1111-1111-1111-111111111111"
	otherProgram  = "22222222-2222-2222-2222-222222222222"
)

func setupMethodsDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	// Raw DDL for the same reason as gateway_config_repository_test.go: the
	// entities use PostgreSQL-specific types AutoMigrate cannot render here.
	stmts := []string{
		`CREATE TABLE payment_methods (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			code TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			display_name TEXT NOT NULL DEFAULT '',
			description TEXT DEFAULT '',
			icon TEXT DEFAULT '',
			gateway_name TEXT DEFAULT '',
			gateway_type TEXT DEFAULT '',
			bank_name TEXT DEFAULT '',
			account_number TEXT DEFAULT '',
			account_name TEXT DEFAULT '',
			instructions TEXT DEFAULT '',
			requires_proof INTEGER NOT NULL DEFAULT 0,
			admin_instructions TEXT DEFAULT '',
			config TEXT,
			sort_order INTEGER DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE program_payment_methods (
			id TEXT PRIMARY KEY,
			program_id TEXT NOT NULL,
			payment_method_id TEXT NOT NULL,
			is_enabled INTEGER NOT NULL DEFAULT 1,
			description_override TEXT,
			instructions_override TEXT,
			admin_instructions_override TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME,
			CONSTRAINT uq_program_method UNIQUE (program_id, payment_method_id)
		)`,
	}
	for _, s := range stmts {
		if err := db.Exec(s).Error; err != nil {
			t.Fatalf("create table: %v", err)
		}
	}
	return db
}

func seedMethod(t *testing.T, db *gorm.DB, id, name string, sortOrder int, active bool) {
	t.Helper()
	if err := db.Exec(
		`INSERT INTO payment_methods (id, name, type, code, is_active, display_name, config, sort_order)
		 VALUES (?, ?, 'manual', ?, ?, ?, '{}', ?)`,
		id, name, "code_"+id, active, name, sortOrder,
	).Error; err != nil {
		t.Fatalf("seed method %s: %v", name, err)
	}
}

// seedMethodFull is seedMethod plus the two fields the instruction-seeding
// logic branches on: type (manual vs automatic) and the master instructions.
func seedMethodFull(t *testing.T, db *gorm.DB, id, name, methodType, instructions string, sortOrder int) {
	t.Helper()
	if err := db.Exec(
		`INSERT INTO payment_methods (id, name, type, code, is_active, display_name, instructions, config, sort_order)
		 VALUES (?, ?, ?, ?, 1, ?, ?, '{}', ?)`,
		id, name, methodType, "code_"+id, name, instructions, sortOrder,
	).Error; err != nil {
		t.Fatalf("seed method %s: %v", name, err)
	}
}

func seedOverlay(t *testing.T, db *gorm.DB, programID, methodID string, enabled bool, sortOrder int) {
	t.Helper()
	if err := db.Exec(
		`INSERT INTO program_payment_methods (id, program_id, payment_method_id, is_enabled, sort_order)
		 VALUES (?, ?, ?, ?, ?)`,
		programID+"-"+methodID, programID, methodID, enabled, sortOrder,
	).Error; err != nil {
		t.Fatalf("seed overlay: %v", err)
	}
}

func viewByID(views []repositories.ProgramMethodView, id string) *repositories.ProgramMethodView {
	for i := range views {
		if views[i].ID == id {
			return &views[i]
		}
	}
	return nil
}

// The production defect: an admin on a CONFIGURED program could not see —
// and therefore could not enable — a shared method the program had never
// been attached to. The only affordance left was "create new", which then
// collided with the global unique name. Five never-attached orphan methods
// accumulated in prod this way.
func TestFindAllForAdminByProgramSurfacesUnattachedMethods(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)
	ctx := context.Background()

	seedMethod(t, db, "m-bca", "Bank Transfer BCA (Manual)", 1, true)
	seedMethod(t, db, "m-paypal", "PayPal (Manual)", 2, true)
	seedMethod(t, db, "m-mastercard", "Mastercard / Visa / JCB (Manual Confirmation)", 3, true)
	seedMethod(t, db, "m-retired", "Retired Gateway", 4, false)

	// Program is "configured": it has overlay rows, but only for two methods.
	seedOverlay(t, db, testProgramID, "m-bca", true, 1)
	seedOverlay(t, db, testProgramID, "m-paypal", true, 2)

	views, err := repo.FindAllForAdminByProgram(ctx, testProgramID)
	if err != nil {
		t.Fatalf("FindAllForAdminByProgram: %v", err)
	}

	if len(views) != 3 {
		t.Fatalf("expected 3 active methods (inactive excluded), got %d", len(views))
	}

	mastercard := viewByID(views, "m-mastercard")
	if mastercard == nil {
		t.Fatal("the unattached method is missing — the admin still cannot enable it")
	}
	if mastercard.IsEnabled {
		t.Error("unattached method must report IsEnabled=false so the checkbox renders unticked")
	}

	if bca := viewByID(views, "m-bca"); bca == nil || !bca.IsEnabled {
		t.Error("attached+enabled method should remain enabled")
	}
	if viewByID(views, "m-retired") != nil {
		t.Error("inactive master methods must not be offered")
	}

	// Attached rows keep the program's curated order and stay ahead of the
	// newly visible ones; the console bulk-saves sort_order by list position.
	if views[0].ID != "m-bca" || views[1].ID != "m-paypal" || views[2].ID != "m-mastercard" {
		t.Errorf("unexpected ordering: %s, %s, %s", views[0].ID, views[1].ID, views[2].ID)
	}
}

func TestFindAllForAdminByProgramKeepsDisabledOverlayVisible(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)

	seedMethod(t, db, "m-bca", "Bank Transfer BCA (Manual)", 1, true)
	seedOverlay(t, db, testProgramID, "m-bca", false, 1)

	views, err := repo.FindAllForAdminByProgram(context.Background(), testProgramID)
	if err != nil {
		t.Fatalf("FindAllForAdminByProgram: %v", err)
	}
	if len(views) != 1 {
		t.Fatalf("expected the explicitly disabled method to stay visible, got %d views", len(views))
	}
	if views[0].IsEnabled {
		t.Error("explicitly disabled overlay must report IsEnabled=false")
	}
}

// An unconfigured program has every active method implicitly on. The console
// must not show a fleet of unticked boxes for a program whose participants can
// currently use everything.
func TestFindAllForAdminByProgramUnconfiguredStaysDefaultEnabled(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)

	seedMethod(t, db, "m-bca", "Bank Transfer BCA (Manual)", 1, true)
	seedMethod(t, db, "m-paypal", "PayPal (Manual)", 2, true)
	seedOverlay(t, db, otherProgram, "m-bca", true, 1) // belongs to a different program

	views, err := repo.FindAllForAdminByProgram(context.Background(), testProgramID)
	if err != nil {
		t.Fatalf("FindAllForAdminByProgram: %v", err)
	}
	if len(views) != 2 {
		t.Fatalf("expected 2 views, got %d", len(views))
	}
	for _, v := range views {
		if !v.IsEnabled {
			t.Errorf("unconfigured program should default %s to enabled", v.Name)
		}
	}
}

// Regression guard for the participant portal: the admin change must not leak
// disabled methods into the read path participants use. This is the failure
// mode that would be far worse than the bug being fixed.
func TestFindMergedByProgramStillHidesDisabledMethods(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)

	seedMethod(t, db, "m-bca", "Bank Transfer BCA (Manual)", 1, true)
	seedMethod(t, db, "m-paypal", "PayPal (Manual)", 2, true)
	seedMethod(t, db, "m-mastercard", "Mastercard / Visa / JCB (Manual Confirmation)", 3, true)

	seedOverlay(t, db, testProgramID, "m-bca", true, 1)
	seedOverlay(t, db, testProgramID, "m-paypal", false, 2)

	views, err := repo.FindMergedByProgram(context.Background(), testProgramID)
	if err != nil {
		t.Fatalf("FindMergedByProgram: %v", err)
	}
	if len(views) != 1 || views[0].ID != "m-bca" {
		t.Fatalf("portal must see only the enabled method, got %d views: %+v", len(views), views)
	}
}

func boolPtr(b bool) *bool    { return &b }
func strPtr(s string) *string { return &s }

func overlayRow(t *testing.T, db *gorm.DB, programID, methodID string) entities.ProgramPaymentMethodEntity {
	t.Helper()
	var row entities.ProgramPaymentMethodEntity
	if err := db.Where("program_id = ? AND payment_method_id = ?", programID, methodID).First(&row).Error; err != nil {
		t.Fatalf("overlay row %s: %v", methodID, err)
	}
	return row
}

// The production incident: a manual method's instructions carry that program's
// own Xendit checkout links. Sharing them meant one edit put Middle East Youth
// Summit links in front of China Youth Summit and Istanbul Youth Summit
// participants at the same time. Enabling a manual method must give the
// program a copy it owns.
func TestUpsertFullSetSeedsManualInstructionsOnEnable(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)
	ctx := context.Background()

	seedMethodFull(t, db, "m-manual", "Mastercard / Visa / JCB (Manual Confirmation)", "manual", "<p>MEYS 2026 links</p>", 1)
	seedMethodFull(t, db, "m-auto", "Credit Card", "automatic", "<p>generic gateway copy</p>", 2)

	err := repo.UpsertFullSet(ctx, testProgramID, []repositories.OverridePatch{
		{PaymentMethodID: "m-manual", IsEnabled: boolPtr(true)},
		{PaymentMethodID: "m-auto", IsEnabled: boolPtr(true)},
	})
	if err != nil {
		t.Fatalf("UpsertFullSet: %v", err)
	}

	manual := overlayRow(t, db, testProgramID, "m-manual")
	if manual.InstructionsOverride == nil {
		t.Fatal("manual method must be seeded with its own copy of the instructions")
	}
	if *manual.InstructionsOverride != "<p>MEYS 2026 links</p>" {
		t.Errorf("unexpected seeded text: %q", *manual.InstructionsOverride)
	}

	auto := overlayRow(t, db, testProgramID, "m-auto")
	if auto.InstructionsOverride != nil {
		t.Error("automatic methods should keep inheriting the shared master copy")
	}
}

func TestUpsertFullSetDoesNotSeedWhenDisabledOrExplicit(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)
	ctx := context.Background()

	seedMethodFull(t, db, "m-off", "Left Off", "manual", "<p>master</p>", 1)
	seedMethodFull(t, db, "m-explicit", "Explicit Override", "manual", "<p>master</p>", 2)

	err := repo.UpsertFullSet(ctx, testProgramID, []repositories.OverridePatch{
		{PaymentMethodID: "m-off", IsEnabled: boolPtr(false)},
		{PaymentMethodID: "m-explicit", IsEnabled: boolPtr(true), InstructionsOverride: strPtr("<p>mine</p>")},
	})
	if err != nil {
		t.Fatalf("UpsertFullSet: %v", err)
	}

	if off := overlayRow(t, db, testProgramID, "m-off"); off.InstructionsOverride != nil {
		t.Error("a method left disabled must not be frozen with a seeded override")
	}
	explicit := overlayRow(t, db, testProgramID, "m-explicit")
	if explicit.InstructionsOverride == nil || *explicit.InstructionsOverride != "<p>mine</p>" {
		t.Error("an explicit override must win over seeding")
	}
}

// Re-saving an already-enabled method must not resurrect an override the admin
// deliberately cleared by unticking "Override for this program".
func TestUpsertFullSetDoesNotReseedAlreadyEnabled(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)
	ctx := context.Background()

	seedMethodFull(t, db, "m-manual", "Manual", "manual", "<p>master</p>", 1)
	seedOverlay(t, db, testProgramID, "m-manual", true, 1)

	if err := repo.UpsertFullSet(ctx, testProgramID, []repositories.OverridePatch{
		{PaymentMethodID: "m-manual", IsEnabled: boolPtr(true)},
	}); err != nil {
		t.Fatalf("UpsertFullSet: %v", err)
	}

	if row := overlayRow(t, db, testProgramID, "m-manual"); row.InstructionsOverride != nil {
		t.Error("already-enabled method must not be re-seeded; unticking the override should stick")
	}
}

func TestCountInheritingPrograms(t *testing.T) {
	db := setupMethodsDB(t)
	repo := persistence.NewProgramPaymentMethodRepository(db)

	seedMethodFull(t, db, "m-manual", "Manual", "manual", "<p>master</p>", 1)
	seedOverlay(t, db, testProgramID, "m-manual", true, 1) // inherits
	seedOverlay(t, db, otherProgram, "m-manual", true, 1)  // will override
	if err := db.Exec(`UPDATE program_payment_methods SET instructions_override='<p>own</p>' WHERE program_id=? AND payment_method_id=?`, otherProgram, "m-manual").Error; err != nil {
		t.Fatalf("set override: %v", err)
	}

	enabled, inheriting, err := repo.CountInheritingPrograms(context.Background(), "m-manual")
	if err != nil {
		t.Fatalf("CountInheritingPrograms: %v", err)
	}
	if enabled != 2 {
		t.Errorf("enabled = %d, want 2", enabled)
	}
	if inheriting != 1 {
		t.Errorf("inheriting = %d, want 1", inheriting)
	}
}
