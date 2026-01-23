package persistence

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// RunRawSqlMigrations executes .sql files from the migrations directory
func RunRawSqlMigrations(db *gorm.DB, migrationsDir string) error {
	cwd, _ := os.Getwd()
	log.Printf("Migrator: Current working directory is %s", cwd)
	log.Printf("Migrator: Checking for pending SQL migrations in %s...", migrationsDir)

	// 1. Create schema_migrations table if not exists
	if err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`).Error; err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 2. Resolve Migrations Directory
	// Search order: given path -> ./migrations -> ../migrations -> ../../migrations
	foundPath := ""
	searchPaths := []string{
		migrationsDir,
		"./migrations",
		"../migrations",
		"../../migrations",
		"/app/migrations", // Docker fallback
	}

	for _, path := range searchPaths {
		info, err := os.Stat(path)
		if err == nil && info.IsDir() {
			foundPath = path
			break
		}
	}

	if foundPath == "" {
		log.Printf("Warning: Could not find migrations directory in any of %v. Skipping raw SQL migrations.", searchPaths)
		return nil // Non-fatal for dev (maybe?), but let's log warning.
	}

	log.Printf("Migrator: Found migrations directory at: %s", foundPath)
	files, err := os.ReadDir(foundPath)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory %s: %w", foundPath, err)
	}

	// 3. Filter and sort .sql files
	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".sql") {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles) // Ensure sequential order (001, 002, etc.)

	// 4. Iterate and apply
	for _, filename := range sqlFiles {
		var count int64
		if err := db.Table("schema_migrations").Where("version = ?", filename).Count(&count).Error; err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", filename, err)
		}

		if count > 0 {
			// Already applied
			continue
		}

		log.Printf("Applying migration: %s", filename)
		
		contentBytes, err := os.ReadFile(filepath.Join(foundPath, filename))
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}
		
		content := string(contentBytes)
		
		// Sanitize: Remove specific psql meta-commands that Go's sql driver hates
		// e.g. \c ybb_payments_db, \echo, etc.
		lines := strings.Split(content, "\n")
		var cleanLines []string
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "\\") {
				continue // Skip meta commands
			}
			cleanLines = append(cleanLines, line)
		}
		cleanContent := strings.Join(cleanLines, "\n")

		// Execute
		if err := db.Exec(cleanContent).Error; err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}

		// Mark as done
		if err := db.Exec("INSERT INTO schema_migrations (version) VALUES (?)", filename).Error; err != nil {
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}
		
		log.Printf("Migration %s applied successfully.", filename)
	}

	log.Println("SQL migrations check complete.")
	return nil
}
