package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type apiResponse struct {
	Data any `json:"data,omitempty"`
}

type assistant struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Avatar      string `json:"avatar"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

var defaultAssistant = assistant{
	ID:          "11111111-1111-1111-1111-111111111111",
	Username:    "astronomer",
	DisplayName: "Astronomer",
	Avatar:      "",
	Description: "Default local desktop assistant",
	CreatedAt:   time.Now().UTC().Format(time.RFC3339),
}

func main() {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8002"
	}
	host := os.Getenv("SERVER_HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/authservice/auth/health", health)
	mux.HandleFunc("/api/authservice/auth/logout", ok)
	mux.HandleFunc("/api/authservice/auth/refresh", refresh)
	mux.HandleFunc("/api/authservice/auth/me", me)
	mux.HandleFunc("/api/authservice/auth/validate", validate)
	mux.HandleFunc("/api/authservice/auth/authorize", authorize)
	mux.HandleFunc("/api/authservice/desktop/bootstrap", bootstrap)
	mux.HandleFunc("/api/authservice/desktop/identity", identity)
	mux.HandleFunc("/api/authservice/desktop/assistants", assistants)
	mux.HandleFunc("/api/authservice/desktop/assistants/", assistantByID)

	addr := fmt.Sprintf("%s:%s", host, port)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "desktop auth-service failed: %v\n", err)
		os.Exit(1)
	}
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func ok(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]bool{"ok": true}})
}

func bootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
		"defaultAssistant": defaultAssistant,
	}})
}

func identity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: identityPayload()})
}

func refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]string{
		"access_token":  token(),
		"refresh_token": token(),
		"token_type":    "bearer",
	}})
}

func me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
		"id":       defaultAssistant.ID,
		"username": defaultAssistant.Username,
		"role":     "user",
	}})
}

func validate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
		"valid":   true,
		"user_id": defaultAssistant.ID,
	}})
}

func authorize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
		"allowed": true,
	}})
}

func assistants(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
			"assistants": []assistant{defaultAssistant},
		}})
	case http.MethodPost:
		writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
			"assistant": defaultAssistant,
		}})
	default:
		methodNotAllowed(w)
	}
}

func assistantByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/authservice/desktop/assistants/")
	if id == "" || id != defaultAssistant.ID {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "assistant not found"})
		return
	}
	writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
		"assistant": defaultAssistant,
	}})
}

func identityPayload() map[string]any {
	return map[string]any{
		"token":              token(),
		"refreshToken":       token(),
		"defaultAssistantId": defaultAssistant.ID,
		"assistant":          defaultAssistant,
	}
}

func token() string {
	header := base64.RawURLEncoding.EncodeToString(mustJSON(map[string]string{
		"alg": "none",
		"typ": "JWT",
	}))
	payload := base64.RawURLEncoding.EncodeToString(mustJSON(map[string]any{
		"sub":      defaultAssistant.ID,
		"username": defaultAssistant.Username,
		"role":     "user",
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}))
	return header + "." + payload + "."
}

func mustJSON(value any) []byte {
	data, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return data
}

func methodNotAllowed(w http.ResponseWriter) {
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "method not allowed"})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
