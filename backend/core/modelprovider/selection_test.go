package modelprovider

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"

	"lazymind/core/common/orm"
	"lazymind/core/store"
)

func setupSelectedModelTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := orm.Connect(orm.DriverSQLite, t.TempDir()+"/selected-model.db")
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
		&orm.UserModelProvider{},
		&orm.UserModelProviderGroup{},
		&orm.UserModelProviderGroupModel{},
		&orm.UserSelectedModel{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	store.Init(db.DB, nil, nil)
	return db.DB
}

func seedSelectableModel(t *testing.T, db *gorm.DB, userID, modelID, modelType string) {
	t.Helper()

	now := time.Now()
	if err := db.Create(&orm.UserModelProvider{
		ID:       "provider-" + modelID,
		Name:     "SiliconFlow",
		Category: "model",
		BaseModel: orm.BaseModel{
			CreateUserID:   userID,
			CreateUserName: "User 1",
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroup{
		ID:                  "group-" + modelID,
		UserModelProviderID: "provider-" + modelID,
		Name:                "SiliconFlow",
		BaseURL:             "https://api.siliconflow.cn/v1/",
		APIKey:              "secret",
		IsVerified:          true,
		BaseModel: orm.BaseModel{
			CreateUserID:   userID,
			CreateUserName: "User 1",
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}).Error; err != nil {
		t.Fatalf("create group: %v", err)
	}
	if err := db.Create(&orm.UserModelProviderGroupModel{
		ID:                       modelID,
		UserModelProviderID:      "provider-" + modelID,
		UserModelProviderGroupID: "group-" + modelID,
		ProviderName:             "SiliconFlow",
		Name:                     "Qwen/Qwen3-32B",
		ModelType:                modelType,
		IsDefault:                true,
		BaseModel: orm.BaseModel{
			CreateUserID:   userID,
			CreateUserName: "User 1",
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}).Error; err != nil {
		t.Fatalf("create model: %v", err)
	}
}

func performSetSharedModel(body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPut, "/api/core/model_providers/selected_models/share", strings.NewReader(body))
	req.Header.Set("X-User-Id", "user-1")
	req.Header.Set("X-User-Name", "User 1")
	rec := httptest.NewRecorder()
	SetSharedModel(rec, req)
	return rec
}

func TestSetSharedModelCreatesSelectionFromValidModelID(t *testing.T) {
	db := setupSelectedModelTestDB(t)
	seedSelectableModel(t, db, "user-1", "model-qwen3-32b", "llm")

	rec := performSetSharedModel(`{"model_key":"llm","model_id":"model-qwen3-32b","share":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var row orm.UserSelectedModel
	if err := db.Where("user_id = ? AND model_type = ?", "user-1", "llm").Take(&row).Error; err != nil {
		t.Fatalf("query selected model: %v", err)
	}
	if row.UserModelProviderGroupModelID != "model-qwen3-32b" || !row.Share {
		t.Fatalf("expected shared qwen selection, got %#v", row)
	}
}
