package modelprovider

import (
	"testing"
	"time"

	"lazymind/core/common/orm"
)

func TestResolveUserModelProviderAcceptsDefaultProviderID(t *testing.T) {
	db := setupListProviderTestDB(t)
	ensureUserProviderUniqueIndex(t, db)
	now := time.Now()

	if err := db.Create(&orm.DefaultModelProvider{
		ID:           "default-siliconflow",
		Name:         "SiliconFlow",
		Description:  "SiliconFlow",
		BaseURL:      "https://api.siliconflow.cn/v1/",
		Category:     "model",
		Capabilities: "multi_group,custom_base_url,has_models",
		CreatedAt:    now,
		UpdatedAt:    now,
	}).Error; err != nil {
		t.Fatalf("create default provider: %v", err)
	}

	provider, err := resolveUserModelProvider(t.Context(), db, "user-1", "Astronomer", "default-siliconflow")
	if err != nil {
		t.Fatalf("resolve provider: %v", err)
	}
	if provider.DefaultModelProviderID != "default-siliconflow" {
		t.Fatalf("expected default provider id to match, got %#v", provider)
	}
	if provider.CreateUserID != "user-1" {
		t.Fatalf("expected synced provider to belong to user-1, got %#v", provider)
	}
}

func TestResolveUserModelProviderAcceptsProviderNameSlug(t *testing.T) {
	db := setupListProviderTestDB(t)
	now := time.Now()

	if err := db.Create(&orm.UserModelProvider{
		ID:                     "user-siliconflow",
		DefaultModelProviderID: "default-siliconflow",
		Name:                   "SiliconFlow",
		Description:            "SiliconFlow",
		BaseURL:                "https://api.siliconflow.cn/v1/",
		Category:               "model",
		Capabilities:           "multi_group,custom_base_url,has_models",
		BaseModel: orm.BaseModel{
			CreateUserID: "user-1",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}).Error; err != nil {
		t.Fatalf("create user provider: %v", err)
	}

	provider, err := resolveUserModelProvider(t.Context(), db, "user-1", "", "siliconflow")
	if err != nil {
		t.Fatalf("resolve provider: %v", err)
	}
	if provider.ID != "user-siliconflow" {
		t.Fatalf("expected user provider id, got %#v", provider)
	}
}
