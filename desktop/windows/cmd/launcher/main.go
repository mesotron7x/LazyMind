//go:generate go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest -64

package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	exePath, err := os.Executable()
	if err != nil {
		fatal("cannot determine executable path: " + err.Error())
	}
	exeDir := filepath.Dir(exePath)

	setEnv(exeDir)

	coreBin := filepath.Join(exeDir, "bin")
	coreProc, err := startHidden(coreBin, filepath.Join(coreBin, "core.exe"))
	if err != nil {
		fatal("failed to start core: " + err.Error())
	}

	if !waitForHealth("http://127.0.0.1:8001/health", 30*time.Second) {
		killTree(coreProc)
		fatal("core health check timed out")
	}

	os.Setenv("ELECTRON_RENDERER_DIR", filepath.Join(exeDir, "renderer"))

	electronExe := filepath.Join(exeDir, "electron", "electron.exe")
	electronApp := filepath.Join(exeDir, "app")
	electronProc, err := startHidden(exeDir, electronExe, electronApp)
	if err != nil {
		killTree(coreProc)
		fatal("failed to start electron: " + err.Error())
	}

	electronProc.Wait()

	killTree(coreProc)
}

func setEnv(exeDir string) {
	envs := map[string]string{
		"ACL_DB_DRIVER":           "sqlite",
		"ACL_DB_DSN":              filepath.Join(exeDir, "data", "auth.db"),
		"LAZYMIND_STATE_BACKEND":  "memory",
		"LAZYMIND_MODE":           "desktop",
		"LAZYMIND_JWT_SECRET":     "lazymind-desktop-local-dev",
		"SERVER_PORT":             "8001",
		"SERVER_HOST":             "127.0.0.1",
		"LAZYMIND_DATA_DIR":       filepath.Join(exeDir, "data"),
		"LAZYMIND_LOG_DIR":        filepath.Join(exeDir, "logs"),
	}
	for k, v := range envs {
		os.Setenv(k, v)
	}
}

func startHidden(dir, name string, args ...string) (*os.Process, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd.Process, nil
}

func waitForHealth(url string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 2 * time.Second}
	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return true
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}

func killTree(proc *os.Process) {
	if proc == nil {
		return
	}
	cmd := exec.Command("taskkill", "/T", "/F", "/PID", fmt.Sprintf("%d", proc.Pid))
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
	cmd.Run()
}

func fatal(msg string) {
	fmt.Fprintf(os.Stderr, "LazyMind launcher: %s\n", msg)
	os.Exit(1)
}
