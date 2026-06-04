package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func resetAssistantStore() {
	assistantStore.Lock()
	defer assistantStore.Unlock()
	assistantStore.items = []assistant{defaultAssistant}
}

func TestDesktopAuthStartupEndpoints(t *testing.T) {
	resetAssistantStore()

	t.Run("health", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/authservice/auth/health", nil)
		rec := httptest.NewRecorder()

		health(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("health status = %d, want %d", rec.Code, http.StatusOK)
		}
		var body map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode health response: %v", err)
		}
		if body["status"] != "ok" {
			t.Fatalf("health status body = %q, want ok", body["status"])
		}
	})

	t.Run("bootstrap", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/authservice/desktop/bootstrap", nil)
		rec := httptest.NewRecorder()

		bootstrap(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("bootstrap status = %d, want %d", rec.Code, http.StatusOK)
		}
		var body struct {
			Data struct {
				DefaultAssistant assistant `json:"defaultAssistant"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode bootstrap response: %v", err)
		}
		if body.Data.DefaultAssistant.ID == "" || body.Data.DefaultAssistant.Username == "" {
			t.Fatalf("bootstrap assistant is incomplete: %#v", body.Data.DefaultAssistant)
		}
		if body.Data.DefaultAssistant.DisplayName != "天文学家" || body.Data.DefaultAssistant.Avatar != "🪐" {
			t.Fatalf("bootstrap assistant = %#v, want 天文学家 🪐", body.Data.DefaultAssistant)
		}
	})

	t.Run("identity", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/authservice/desktop/identity", nil)
		rec := httptest.NewRecorder()

		identity(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("identity status = %d, want %d", rec.Code, http.StatusOK)
		}
		var body struct {
			Data struct {
				Token              string `json:"token"`
				DefaultAssistantID string `json:"defaultAssistantId"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode identity response: %v", err)
		}
		if body.Data.Token == "" {
			t.Fatal("identity token is empty")
		}
		if body.Data.DefaultAssistantID != defaultAssistant.ID {
			t.Fatalf("identity assistant id = %q, want %q", body.Data.DefaultAssistantID, defaultAssistant.ID)
		}
	})
}

func TestDesktopAssistantCRUD(t *testing.T) {
	resetAssistantStore()

	t.Run("list starts with default assistant", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/authservice/desktop/assistants", nil)
		rec := httptest.NewRecorder()

		assistants(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("list status = %d, want %d", rec.Code, http.StatusOK)
		}
		var body struct {
			Data struct {
				Assistants []assistant `json:"assistants"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode list response: %v", err)
		}
		if len(body.Data.Assistants) != 1 || body.Data.Assistants[0].Username != defaultAssistant.Username {
			t.Fatalf("assistant list = %#v, want default assistant", body.Data.Assistants)
		}
	})

	t.Run("create update and delete assistant", func(t *testing.T) {
		createBody := []byte(`{"username":"writer","displayName":"写作助手","avatar":"✍️","description":"drafts text"}`)
		createReq := httptest.NewRequest(http.MethodPost, "/api/authservice/desktop/assistants", bytes.NewReader(createBody))
		createRec := httptest.NewRecorder()

		assistants(createRec, createReq)

		if createRec.Code != http.StatusOK {
			t.Fatalf("create status = %d, want %d: %s", createRec.Code, http.StatusOK, createRec.Body.String())
		}
		var createResp struct {
			Data struct {
				Assistant assistant `json:"assistant"`
			} `json:"data"`
		}
		if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
			t.Fatalf("decode create response: %v", err)
		}
		created := createResp.Data.Assistant
		if created.ID == "" || created.Username != "writer" || created.DisplayName != "写作助手" {
			t.Fatalf("created assistant = %#v", created)
		}

		updateBody := []byte(`{"displayName":"编辑助手","avatar":"📝","description":"edits text"}`)
		updateReq := httptest.NewRequest(http.MethodPatch, "/api/authservice/desktop/assistants/"+created.ID, bytes.NewReader(updateBody))
		updateRec := httptest.NewRecorder()

		assistantByID(updateRec, updateReq)

		if updateRec.Code != http.StatusOK {
			t.Fatalf("update status = %d, want %d: %s", updateRec.Code, http.StatusOK, updateRec.Body.String())
		}
		var updateResp struct {
			Data struct {
				Assistant assistant `json:"assistant"`
			} `json:"data"`
		}
		if err := json.Unmarshal(updateRec.Body.Bytes(), &updateResp); err != nil {
			t.Fatalf("decode update response: %v", err)
		}
		if updateResp.Data.Assistant.DisplayName != "编辑助手" || updateResp.Data.Assistant.Avatar != "📝" {
			t.Fatalf("updated assistant = %#v", updateResp.Data.Assistant)
		}

		deleteReq := httptest.NewRequest(http.MethodDelete, "/api/authservice/desktop/assistants/"+created.ID, nil)
		deleteRec := httptest.NewRecorder()

		assistantByID(deleteRec, deleteReq)

		if deleteRec.Code != http.StatusOK {
			t.Fatalf("delete status = %d, want %d: %s", deleteRec.Code, http.StatusOK, deleteRec.Body.String())
		}
		if _, ok := getAssistant(created.ID); ok {
			t.Fatal("deleted assistant is still present")
		}
	})

	t.Run("cannot delete default or last assistant", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/authservice/desktop/assistants/"+defaultAssistant.ID, nil)
		rec := httptest.NewRecorder()

		assistantByID(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("delete default status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})
}
