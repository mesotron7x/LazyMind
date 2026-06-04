package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
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
	DisplayName: "天文学家",
	Avatar:      "🪐",
	Description: "天文学家是一位专注于太阳系、行星、卫星、小行星、彗星和基础天文知识的入门向导，擅长用清晰、耐心、富有画面感的方式解释宇宙中的常见现象，帮助用户从太阳系开始建立对天文学的整体认识。",
	CreatedAt:   time.Now().UTC().Format(time.RFC3339),
}

var assistantStore = struct {
	sync.Mutex
	items []assistant
}{
	items: []assistant{defaultAssistant},
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
			"assistants": listAssistants(),
		}})
	case http.MethodPost:
		var body struct {
			Username    string `json:"username"`
			DisplayName string `json:"displayName"`
			Avatar      string `json:"avatar"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid request body"})
			return
		}
		created, status, msg := createAssistant(body.Username, body.DisplayName, body.Avatar, body.Description)
		if status != http.StatusOK {
			writeJSON(w, status, map[string]string{"message": msg})
			return
		}
		writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
			"assistant": created,
		}})
	default:
		methodNotAllowed(w)
	}
}

func assistantByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/authservice/desktop/assistants/")
	if id == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "assistant not found"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		found, ok := getAssistant(id)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "assistant not found"})
			return
		}
		writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
			"assistant": found,
		}})
	case http.MethodPatch:
		var body struct {
			DisplayName *string `json:"displayName"`
			Avatar      *string `json:"avatar"`
			Description *string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid request body"})
			return
		}
		updated, ok := updateAssistant(id, body.DisplayName, body.Avatar, body.Description)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "assistant not found"})
			return
		}
		writeJSON(w, http.StatusOK, apiResponse{Data: map[string]any{
			"assistant": updated,
		}})
	case http.MethodDelete:
		status, msg := deleteAssistant(id)
		if status != http.StatusOK {
			writeJSON(w, status, map[string]string{"message": msg})
			return
		}
		writeJSON(w, http.StatusOK, apiResponse{})
	default:
		methodNotAllowed(w)
	}
}

func identityPayload() map[string]any {
	return map[string]any{
		"token":              token(),
		"refreshToken":       token(),
		"defaultAssistantId": defaultAssistant.ID,
		"assistant":          defaultAssistant,
	}
}

func listAssistants() []assistant {
	assistantStore.Lock()
	defer assistantStore.Unlock()

	items := make([]assistant, len(assistantStore.items))
	copy(items, assistantStore.items)
	return items
}

func getAssistant(id string) (assistant, bool) {
	assistantStore.Lock()
	defer assistantStore.Unlock()

	for _, item := range assistantStore.items {
		if item.ID == id {
			return item, true
		}
	}
	return assistant{}, false
}

func createAssistant(username, displayName, avatar, description string) (assistant, int, string) {
	username = strings.TrimSpace(username)
	displayName = strings.TrimSpace(displayName)
	avatar = strings.TrimSpace(avatar)
	description = strings.TrimSpace(description)

	if username == "" {
		return assistant{}, http.StatusBadRequest, "username is required"
	}
	if avatar == "" {
		avatar = "🤖"
	}
	if displayName == "" {
		displayName = username
	}

	assistantStore.Lock()
	defer assistantStore.Unlock()

	for _, item := range assistantStore.items {
		if item.Username == username {
			return assistant{}, http.StatusConflict, "username already exists"
		}
	}

	created := assistant{
		ID:          newUUID(),
		Username:    username,
		DisplayName: displayName,
		Avatar:      avatar,
		Description: description,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	assistantStore.items = append(assistantStore.items, created)
	return created, http.StatusOK, ""
}

func updateAssistant(id string, displayName, avatar, description *string) (assistant, bool) {
	assistantStore.Lock()
	defer assistantStore.Unlock()

	for i := range assistantStore.items {
		if assistantStore.items[i].ID != id {
			continue
		}
		if displayName != nil {
			assistantStore.items[i].DisplayName = strings.TrimSpace(*displayName)
			if assistantStore.items[i].DisplayName == "" {
				assistantStore.items[i].DisplayName = assistantStore.items[i].Username
			}
		}
		if avatar != nil {
			assistantStore.items[i].Avatar = strings.TrimSpace(*avatar)
		}
		if description != nil {
			assistantStore.items[i].Description = strings.TrimSpace(*description)
		}
		return assistantStore.items[i], true
	}
	return assistant{}, false
}

func deleteAssistant(id string) (int, string) {
	assistantStore.Lock()
	defer assistantStore.Unlock()

	if len(assistantStore.items) <= 1 {
		return http.StatusBadRequest, "at least one assistant is required"
	}
	for i, item := range assistantStore.items {
		if item.ID != id {
			continue
		}
		if item.Username == defaultAssistant.Username {
			return http.StatusBadRequest, "default assistant cannot be deleted"
		}
		assistantStore.items = append(assistantStore.items[:i], assistantStore.items[i+1:]...)
		return http.StatusOK, ""
	}
	return http.StatusNotFound, "assistant not found"
}

func newUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("assistant-%d", time.Now().UnixNano())
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4],
		b[4:6],
		b[6:8],
		b[8:10],
		b[10:16],
	)
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
