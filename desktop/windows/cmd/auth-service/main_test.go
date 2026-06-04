package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDesktopAuthStartupEndpoints(t *testing.T) {
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
