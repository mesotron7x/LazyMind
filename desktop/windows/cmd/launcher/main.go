//go:generate go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest -64

package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

var logPath string

func main() {
	exePath, err := os.Executable()
	if err != nil {
		fatal("cannot determine executable path: " + err.Error())
	}
	exeDir := filepath.Dir(exePath)
	logPath = filepath.Join(exeDir, "logs", "launcher.log")

	setEnv(exeDir)

	coreBin := filepath.Join(exeDir, "bin")
	if isPortOpen("127.0.0.1", 8001, 500*time.Millisecond) {
		fatal("core port 8001 is already in use; wait for the previous LazyMind instance to exit or stop the stale core.exe process")
	}

	coreProc, err := startHidden(coreBin, filepath.Join(coreBin, "core.exe"))
	if err != nil {
		fatal("failed to start core: " + err.Error())
	}

	if !waitForHealth("http://127.0.0.1:8001/health", 30*time.Second) {
		cleanupCore(coreProc)
		fatal("core health check timed out")
	}

	electronExe := filepath.Join(exeDir, "electron", "electron.exe")
	electronApp := filepath.Join(exeDir, "app")
	electronProc, err := startHidden(exeDir, electronExe, electronApp)
	if err != nil {
		cleanupCore(coreProc)
		fatal("failed to start electron: " + err.Error())
	}

	electronProc.Wait()

	cleanupCore(coreProc)
}

func setEnv(exeDir string) {
	envs := map[string]string{
		"ACL_DB_DRIVER":                  "sqlite",
		"ACL_DB_DSN":                     filepath.Join(exeDir, "data", "auth.db"),
		"ELECTRON_RENDERER_DIR":          filepath.Join(exeDir, "renderer"),
		"LAZYMIND_DESKTOP_ROOT":          exeDir,
		"LAZYMIND_LAUNCHER_MANAGED_CORE": "1",
		"LAZYMIND_STATE_BACKEND":         "memory",
		"LAZYMIND_MODE":                  "desktop",
		"LAZYMIND_JWT_SECRET":            "lazymind-desktop-local-dev",
		"SERVER_PORT":                    "8001",
		"SERVER_HOST":                    "127.0.0.1",
		"LAZYMIND_DATA_DIR":              filepath.Join(exeDir, "data"),
		"LAZYMIND_LOG_DIR":               filepath.Join(exeDir, "logs"),
		"MIGRATIONS_DIR":                 filepath.Join(exeDir, "bin", "migrations", "sqlite"),
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

func cleanupCore(proc *os.Process) {
	killTree(proc)
	if !waitForProcessExit(proc, 5*time.Second) {
		log("core process did not report exit before timeout")
	}
	if !waitForPortClosed("127.0.0.1", 8001, 10*time.Second) {
		log("core port 8001 did not close before timeout")
	}
}

func killTree(proc *os.Process) {
	if proc == nil {
		return
	}
	cmd := exec.Command("taskkill", "/T", "/F", "/PID", fmt.Sprintf("%d", proc.Pid))
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
	cmd.Run()
}

func waitForProcessExit(proc *os.Process, timeout time.Duration) bool {
	if proc == nil {
		return true
	}
	done := make(chan struct{})
	go func() {
		_, _ = proc.Wait()
		close(done)
	}()
	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}

func waitForPortClosed(host string, port int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if !isPortOpen(host, port, 500*time.Millisecond) {
			return true
		}
		time.Sleep(250 * time.Millisecond)
	}
	return !isPortOpen(host, port, 500*time.Millisecond)
}

func isPortOpen(host string, port int, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func fatal(msg string) {
	line := fmt.Sprintf("LazyMind launcher: %s\n", msg)
	fmt.Fprint(os.Stderr, line)
	log(line)
	os.Exit(1)
}

func log(line string) {
	if logPath != "" {
		if len(line) == 0 || line[len(line)-1] != '\n' {
			line += "\n"
		}
		_ = os.MkdirAll(filepath.Dir(logPath), 0755)
		if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
			defer f.Close()
			_, _ = f.WriteString(time.Now().Format(time.RFC3339) + " " + line)
		}
	}
}
