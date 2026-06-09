package modelprovider

import (
	"context"
	"os"
	"testing"
	"time"

	"gorm.io/gorm"

	"lazymind/core/common/orm"
)

func setupListProviderTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := orm.Connect(orm.DriverSQLite, t.TempDir()+"/list-provider.db")
	if err != nil {
		t.Fatalf("connect sqlite: %v", err)
	}
	sqlDB, err := db.DB.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})
	if err := db.AutoMigrate(
		&orm.DefaultModelProvider{},
		&orm.DefaultModel{},
		&orm.UserModelProvider{},
		&orm.UserModelProviderGroup{},
		&orm.UserModelProviderGroupModel{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db.DB
}

func ensureUserProviderUniqueIndex(t *testing.T, db *gorm.DB) {
	t.Helper()

	if err := db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS uk_user_model_providers_user_default_provider
		ON user_model_providers (create_user_id, default_model_provider_id)
	`).Error; err != nil {
		t.Fatalf("create provider unique index: %v", err)
	}
}

func TestBuildListItemsReturnsConfigurationFlagFromVerifiedGroups(t *testing.T) {
	db := setupListProviderTestDB(t)
	now := time.Now()
	rows := []orm.UserModelProvider{
		{
			ID:                     "provider-configured",
			DefaultModelProviderID: "default-configured",
			Name:                   "Bing",
			Description:            "Bing Search",
			BaseURL:                "https://api.bing.test/",
			Category:               "search",
			BaseModel: orm.BaseModel{
				CreateUserID: "user-1",
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
		{
			ID:                     "provider-unverified",
			DefaultModelProviderID: "default-unverified",
			Name:                   "Tavily",
			Description:            "Tavily Search",
			BaseURL:                "https://api.tavily.test/",
			Category:               "search",
			BaseModel: orm.BaseModel{
				CreateUserID: "user-1",
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("create providers: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroup{
		ID:                  "group-configured",
		UserModelProviderID: "provider-configured",
		Name:                "Bing",
		BaseURL:             "https://api.bing.test/",
		APIKey:              "secret",
		IsVerified:          true,
		BaseModel: orm.BaseModel{
			CreateUserID: "user-1",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}).Error; err != nil {
		t.Fatalf("create verified group: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroup{
		ID:                  "group-unverified",
		UserModelProviderID: "provider-unverified",
		Name:                "Tavily",
		BaseURL:             "https://api.tavily.test/",
		APIKey:              "secret",
		IsVerified:          false,
		BaseModel: orm.BaseModel{
			CreateUserID: "user-1",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}).Error; err != nil {
		t.Fatalf("create unverified group: %v", err)
	}

	items := buildListItems(t.Context(), db, rows)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if !items[0].IsConfigured {
		t.Fatalf("expected configured provider to be marked configured: %#v", items[0])
	}
	if items[1].IsConfigured {
		t.Fatalf("expected provider without verified groups to be missing: %#v", items[1])
	}
}

func TestBuildListItemsAllowsVerifiedCustomBaseURLWithoutAPIKey(t *testing.T) {
	db := setupListProviderTestDB(t)
	now := time.Now()
	rows := []orm.UserModelProvider{
		{
			ID:                     "provider-default-empty-key",
			DefaultModelProviderID: "default-empty-key",
			Name:                   "Sciverse",
			Description:            "Sciverse Search",
			BaseURL:                "https://api.sciverse.space",
			Category:               "search",
			BaseModel: orm.BaseModel{
				CreateUserID: "user-1",
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
		{
			ID:                     "provider-custom-empty-key",
			DefaultModelProviderID: "default-empty-key",
			Name:                   "Sciverse Local",
			Description:            "Sciverse Search",
			BaseURL:                "https://api.sciverse.space",
			Category:               "search",
			BaseModel: orm.BaseModel{
				CreateUserID: "user-1",
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
	}
	if err := db.Create(&orm.DefaultModelProvider{
		ID:          "default-empty-key",
		Name:        "Sciverse",
		Description: "Sciverse Search",
		BaseURL:     "https://api.sciverse.space",
		Category:    "search",
		CreatedAt:   now,
		UpdatedAt:   now,
	}).Error; err != nil {
		t.Fatalf("create default provider: %v", err)
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("create providers: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroup{
		ID:                  "group-default-empty-key",
		UserModelProviderID: "provider-default-empty-key",
		Name:                "Sciverse",
		BaseURL:             "https://api.sciverse.space",
		APIKey:              "",
		IsVerified:          true,
		BaseModel: orm.BaseModel{
			CreateUserID: "user-1",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}).Error; err != nil {
		t.Fatalf("create verified group: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroup{
		ID:                  "group-custom-empty-key",
		UserModelProviderID: "provider-custom-empty-key",
		Name:                "Sciverse Local",
		BaseURL:             "http://localhost:9000/search",
		APIKey:              "",
		IsVerified:          true,
		BaseModel: orm.BaseModel{
			CreateUserID: "user-1",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}).Error; err != nil {
		t.Fatalf("create custom verified group: %v", err)
	}

	items := buildListItems(t.Context(), db, rows)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].IsConfigured {
		t.Fatalf("expected default base URL with empty key to be missing: %#v", items[0])
	}
	if !items[1].IsConfigured {
		t.Fatalf("expected custom base URL with empty key to be configured: %#v", items[1])
	}
}

func TestBuildListItemsAddsMinerULocalPresetWhenConfigured(t *testing.T) {
	t.Setenv("LAZYMIND_OCR_SERVER_TYPE", "mineru")
	t.Setenv("LAZYMIND_OCR_SERVER_URL", "http://mineru.local:8000/api/v1/pdf_parse")

	items := buildListItems(t.Context(), nil, []orm.UserModelProvider{
		{
			ID:                     "provider-mineru",
			DefaultModelProviderID: "default-mineru",
			Name:                   "MinerU",
			Description:            "MinerU OCR",
			BaseURL:                "https://mineru.net/api/v4/",
			Category:               "ocr",
		},
	})

	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if len(items[0].BaseURLPresets) != 2 {
		t.Fatalf("expected 2 presets, got %#v", items[0].BaseURLPresets)
	}
	if items[0].BaseURLPresets[0].Key != "official" || items[0].BaseURLPresets[1].Key != "local" {
		t.Fatalf("unexpected preset order: %#v", items[0].BaseURLPresets)
	}
}

func TestBuildListItemsOmitsMinerULocalPresetWithoutConfiguredURL(t *testing.T) {
	t.Setenv("LAZYMIND_OCR_SERVER_TYPE", "mineru")
	_ = os.Unsetenv("LAZYMIND_OCR_SERVER_URL")

	items := buildListItems(t.Context(), nil, []orm.UserModelProvider{
		{
			ID:                     "provider-mineru",
			DefaultModelProviderID: "default-mineru",
			Name:                   "MinerU",
			Description:            "MinerU OCR",
			BaseURL:                "https://mineru.net/api/v4/",
			Category:               "ocr",
		},
	})

	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if len(items[0].BaseURLPresets) != 1 {
		t.Fatalf("expected only official preset, got %#v", items[0].BaseURLPresets)
	}
	if items[0].BaseURLPresets[0].Key != "official" {
		t.Fatalf("expected official preset, got %#v", items[0].BaseURLPresets)
	}
}

func TestSyncUserProvidersFromDefaultsIncludesSiliconFlow(t *testing.T) {
	db := setupListProviderTestDB(t)
	ensureUserProviderUniqueIndex(t, db)
	seedDefaultProviders(t, db, []orm.DefaultModelProvider{
		defaultProvider("provider-qwen", "Qwen", "https://dashscope.aliyuncs.com/"),
		defaultProvider("provider-siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1/"),
	})

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("sync providers: %v", err)
	}

	var rows []orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND deleted_at IS NULL", "user-1").Find(&rows).Error; err != nil {
		t.Fatalf("list user providers: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 synced providers, got %d", len(rows))
	}

	var siliconFlow orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND name = ? AND deleted_at IS NULL", "user-1", "SiliconFlow").Take(&siliconFlow).Error; err != nil {
		t.Fatalf("expected SiliconFlow provider to be synced: %v", err)
	}
	if siliconFlow.BaseURL != "https://api.siliconflow.cn/v1/" {
		t.Fatalf("unexpected SiliconFlow base_url: %s", siliconFlow.BaseURL)
	}
}

func TestSyncUserProvidersFromDefaultsDoesNotRequireConflictIndex(t *testing.T) {
	db := setupListProviderTestDB(t)
	provider := defaultProvider("provider-siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1/")
	seedDefaultProviders(t, db, []orm.DefaultModelProvider{provider})

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("sync providers without unique index: %v", err)
	}
	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User Renamed"); err != nil {
		t.Fatalf("resync providers without unique index: %v", err)
	}

	var rows []orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND default_model_provider_id = ? AND deleted_at IS NULL", "user-1", provider.ID).
		Find(&rows).Error; err != nil {
		t.Fatalf("list synced providers: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected exactly one active provider after resync, got %d: %#v", len(rows), rows)
	}
	if rows[0].Name != "SiliconFlow" || rows[0].CreateUserName != "User Renamed" {
		t.Fatalf("provider was not refreshed: %#v", rows[0])
	}
}

func TestSyncUserProvidersFromDefaultsAddsLegacySQLiteColumns(t *testing.T) {
	dbConn, err := orm.Connect(orm.DriverSQLite, t.TempDir()+"/legacy-provider.db")
	if err != nil {
		t.Fatalf("connect sqlite: %v", err)
	}
	db := dbConn.DB
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if err := db.Exec(`
		CREATE TABLE default_model_providers (
			id TEXT NOT NULL PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL,
			base_url TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			deleted_at TEXT
		);
		CREATE TABLE user_model_providers (
			id TEXT NOT NULL PRIMARY KEY,
			default_model_provider_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT NOT NULL,
			base_url TEXT NOT NULL DEFAULT '',
			create_user_id TEXT NOT NULL,
			create_user_name TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			deleted_at TEXT
		);
	`).Error; err != nil {
		t.Fatalf("create legacy tables: %v", err)
	}
	now := time.Now().UTC()
	if err := db.Exec(
		`INSERT INTO default_model_providers (id, name, description, base_url, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		"provider-siliconflow",
		"SiliconFlow",
		"SiliconFlow description",
		"https://api.siliconflow.cn/v1/",
		now,
		now,
	).Error; err != nil {
		t.Fatalf("insert legacy provider: %v", err)
	}

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("sync legacy providers: %v", err)
	}

	for _, table := range []string{"default_model_providers", "user_model_providers"} {
		for _, column := range []string{"category", "capabilities"} {
			if !db.Migrator().HasColumn(table, column) {
				t.Fatalf("expected %s.%s to be added", table, column)
			}
		}
	}

	var row struct {
		Category     string
		Capabilities string
	}
	if err := db.Table("user_model_providers").
		Select("category, capabilities").
		Where("create_user_id = ? AND name = ?", "user-1", "SiliconFlow").
		Take(&row).Error; err != nil {
		t.Fatalf("load synced legacy provider: %v", err)
	}
	if row.Category != "model" || row.Capabilities != "multi_group,custom_base_url,has_models" {
		t.Fatalf("unexpected defaults from added columns: %#v", row)
	}
}

func TestSeedGroupModelsFromDefaultsAddsSiliconFlowQwenLLM(t *testing.T) {
	db := setupListProviderTestDB(t)
	ensureUserProviderUniqueIndex(t, db)
	provider := defaultProvider("provider-siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1/")
	seedDefaultProviders(t, db, []orm.DefaultModelProvider{provider})
	now := time.Now().UTC()
	if err := db.Create(&orm.DefaultModel{
		ID:                     "model-qwen",
		DefaultModelProviderID: provider.ID,
		ProviderName:           provider.Name,
		Name:                   "Qwen/Qwen2.5-7B-Instruct",
		ModelType:              "llm",
		CreatedAt:              now,
		UpdatedAt:              now,
	}).Error; err != nil {
		t.Fatalf("seed default qwen model: %v", err)
	}
	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("sync providers: %v", err)
	}

	var parent orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND default_model_provider_id = ?", "user-1", provider.ID).Take(&parent).Error; err != nil {
		t.Fatalf("load parent provider: %v", err)
	}
	group := orm.UserModelProviderGroup{
		ID:                  "group-siliconflow",
		UserModelProviderID: parent.ID,
		Name:                "SiliconFlow",
		BaseURL:             "https://api.siliconflow.cn/v1/",
		APIKey:              "test-key",
		IsVerified:          true,
		BaseModel: orm.BaseModel{
			CreateUserID:   "user-1",
			CreateUserName: "User 1",
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}
	if err := db.Create(&group).Error; err != nil {
		t.Fatalf("create group: %v", err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return seedGroupModelsFromDefaults(tx, context.Background(), &group, &parent, group.BaseURL, "user-1", "User 1", now)
	}); err != nil {
		t.Fatalf("seed group models: %v", err)
	}

	var model orm.UserModelProviderGroupModel
	if err := db.Where("user_model_provider_group_id = ? AND name = ?", group.ID, "Qwen/Qwen2.5-7B-Instruct").Take(&model).Error; err != nil {
		t.Fatalf("load seeded qwen model: %v", err)
	}
	if model.ModelType != "llm" || model.ProviderName != "SiliconFlow" || !model.IsDefault {
		t.Fatalf("unexpected seeded qwen model: %#v", model)
	}
}

func TestSyncUserProvidersFromDefaultsRestoresSoftDeletedProvider(t *testing.T) {
	db := setupListProviderTestDB(t)
	ensureUserProviderUniqueIndex(t, db)
	provider := defaultProvider("provider-siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1/")
	seedDefaultProviders(t, db, []orm.DefaultModelProvider{provider})

	deletedAt := time.Now().UTC()
	existing := orm.UserModelProvider{
		ID:                     "existing-user-provider",
		DefaultModelProviderID: provider.ID,
		Name:                   "Old SiliconFlow",
		Description:            "stale",
		BaseURL:                "https://old.example/v1/",
		Category:               "model",
		Capabilities:           "has_models",
		BaseModel: orm.BaseModel{
			CreateUserID:   "user-1",
			CreateUserName: "Old User",
			CreatedAt:      deletedAt.Add(-time.Hour),
			UpdatedAt:      deletedAt.Add(-time.Hour),
			DeletedAt:      &deletedAt,
		},
	}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatalf("seed soft-deleted provider: %v", err)
	}

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("sync providers: %v", err)
	}

	var row orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND default_model_provider_id = ?", "user-1", provider.ID).Take(&row).Error; err != nil {
		t.Fatalf("load restored provider: %v", err)
	}
	if row.ID != existing.ID {
		t.Fatalf("expected existing row to be restored, got id %s", row.ID)
	}
	if row.DeletedAt != nil {
		t.Fatalf("expected deleted_at to be cleared")
	}
	if row.Name != provider.Name || row.BaseURL != provider.BaseURL || row.CreateUserName != "User 1" {
		t.Fatalf("provider was not refreshed: %#v", row)
	}
}

func TestSyncUserProvidersFromDefaultsRefreshesCatalogFields(t *testing.T) {
	db := setupListProviderTestDB(t)
	ensureUserProviderUniqueIndex(t, db)
	provider := defaultProvider("provider-siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1/")
	seedDefaultProviders(t, db, []orm.DefaultModelProvider{provider})

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User 1"); err != nil {
		t.Fatalf("initial sync providers: %v", err)
	}

	if err := db.Model(&orm.DefaultModelProvider{}).
		Where("id = ?", provider.ID).
		Updates(map[string]any{
			"description":  "updated description",
			"base_url":     "https://updated.example/v1/",
			"category":     "search",
			"capabilities": "custom_base_url",
		}).Error; err != nil {
		t.Fatalf("update default provider: %v", err)
	}

	if err := syncUserProvidersFromDefaults(context.Background(), db, "user-1", "User Renamed"); err != nil {
		t.Fatalf("resync providers: %v", err)
	}

	var row orm.UserModelProvider
	if err := db.Where("create_user_id = ? AND default_model_provider_id = ?", "user-1", provider.ID).Take(&row).Error; err != nil {
		t.Fatalf("load refreshed provider: %v", err)
	}
	if row.Description != "updated description" ||
		row.BaseURL != "https://updated.example/v1/" ||
		row.Category != "search" ||
		row.Capabilities != "custom_base_url" ||
		row.CreateUserName != "User Renamed" {
		t.Fatalf("provider did not refresh catalog fields: %#v", row)
	}
}

func defaultProvider(id, name, baseURL string) orm.DefaultModelProvider {
	now := time.Now().UTC()
	return orm.DefaultModelProvider{
		ID:           id,
		Name:         name,
		Description:  name + " description",
		BaseURL:      baseURL,
		Category:     "model",
		Capabilities: "multi_group,custom_base_url,has_models",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

func seedDefaultProviders(t *testing.T, db *gorm.DB, providers []orm.DefaultModelProvider) {
	t.Helper()
	if err := db.Create(&providers).Error; err != nil {
		t.Fatalf("seed default providers: %v", err)
	}
}
