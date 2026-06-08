package modelprovider

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"lazymind/core/common/orm"
)

func TestSeedModelCatalogUpdatesExistingSQLiteTextTimeRows(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "catalog.db")
	db, err := orm.Connect(orm.DriverSQLite, dbPath)
	if err != nil {
		t.Fatalf("connect sqlite: %v", err)
	}
	sqlDB, err := db.DB.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := db.Exec(`
CREATE TABLE default_model_providers (
	id TEXT NOT NULL PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	base_url TEXT NOT NULL DEFAULT '',
	category TEXT NOT NULL DEFAULT 'model',
	capabilities TEXT NOT NULL DEFAULT 'multi_group,custom_base_url,has_models',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE UNIQUE INDEX uk_default_model_providers_name ON default_model_providers (name);
CREATE TABLE default_models (
	id TEXT NOT NULL PRIMARY KEY,
	default_model_provider_id TEXT NOT NULL,
	provider_name TEXT NOT NULL DEFAULT '',
	name TEXT NOT NULL,
	model_type TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE UNIQUE INDEX uk_default_models_provider_name ON default_models (default_model_provider_id, name);
INSERT INTO default_model_providers
	(id, name, description, base_url, category, capabilities, created_at, updated_at)
VALUES
	('provider-claude', 'Claude', 'old description', 'https://old.example/', 'model',
	 'multi_group,custom_base_url,has_models', '2026-06-08 01:02:03+00:00', '2026-06-08 01:02:03+00:00');
INSERT INTO default_models
	(id, default_model_provider_id, provider_name, name, model_type, created_at, updated_at)
VALUES
	('model-sonnet', 'provider-claude', 'Claude', 'claude-sonnet', 'llm',
	 '2026-06-08 01:02:03+00:00', '2026-06-08 01:02:03+00:00');
`).Error; err != nil {
		t.Fatalf("create sqlite text-time schema: %v", err)
	}

	catalogPath := filepath.Join(t.TempDir(), "model_catalog.yaml")
	catalog := []byte(`
model_providers:
  capabilities:
    - multi_group
    - custom_base_url
    - has_models
  suppliers:
    - name: Claude
      description: new description
      base_url: https://new.example
      models:
        - name: claude-sonnet
          type: vlm
`)
	if err := os.WriteFile(catalogPath, catalog, 0o644); err != nil {
		t.Fatalf("write catalog: %v", err)
	}

	if err := SeedModelCatalog(context.Background(), db.DB, catalogPath); err != nil {
		t.Fatalf("seed catalog with sqlite text timestamps: %v", err)
	}

	var description, baseURL, modelType string
	if err := db.Raw(`SELECT description, base_url FROM default_model_providers WHERE id = ?`, "provider-claude").
		Row().Scan(&description, &baseURL); err != nil {
		t.Fatalf("query provider: %v", err)
	}
	if description != "new description" || baseURL != "https://new.example/" {
		t.Fatalf("provider not updated, got description=%q base_url=%q", description, baseURL)
	}
	if err := db.Raw(`SELECT model_type FROM default_models WHERE id = ?`, "model-sonnet").
		Row().Scan(&modelType); err != nil {
		t.Fatalf("query model: %v", err)
	}
	if modelType != "vlm" {
		t.Fatalf("model type not updated, got %q", modelType)
	}
}
