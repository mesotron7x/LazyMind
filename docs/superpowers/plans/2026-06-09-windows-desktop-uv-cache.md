# Windows Desktop uv Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `make windows-desktop` reuse uv cache and managed Python state across rebuilds while keeping the output runtime portable.

**Architecture:** `scripts/windows/build-chat-runtime.ps1` owns chat runtime creation, so it will resolve durable uv directories under the user's LazyMind toolchain area and pass a validated uv `--link-mode` to dependency installation. Documentation will show the override knob without changing the Makefile target surface.

**Tech Stack:** PowerShell, uv, GNU Make Windows desktop target, Markdown docs.

---

### Task 1: Configure durable uv cache and link mode

**Files:**
- Modify: `scripts/windows/build-chat-runtime.ps1`

- [ ] **Step 1: Add parameters and defaults**

Add `UvCacheDir`, `UvPythonInstallDir`, and `UvLinkMode` parameters. Default directories should be `%USERPROFILE%\.lazymind\uv-cache` and `%USERPROFILE%\.lazymind\uv-python`; default link mode should read `LAZYMIND_UV_LINK_MODE` and otherwise use `hardlink`.

- [ ] **Step 2: Validate link mode**

Accept only `copy`, `hardlink`, `clone`, and `symlink`; throw a clear error for anything else.

- [ ] **Step 3: Use durable uv directories**

Keep `python` and `algorithm` under the output directory, but set `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR` to the durable user-level directories.

- [ ] **Step 4: Pass link mode to uv install**

Invoke `uv pip install` with `--link-mode $uvLinkMode` before the requirements arguments.

### Task 2: Document the override

**Files:**
- Modify: `docs/quick_start.md`
- Modify: `docs/quick_start.CN.md`

- [ ] **Step 1: Add concise usage note**

Document that Windows desktop builds reuse uv cache under `%USERPROFILE%\.lazymind` and can override install materialization with `LAZYMIND_UV_LINK_MODE=copy|hardlink|clone|symlink`.

### Task 3: Verify

**Files:**
- Test: `scripts/windows/build-chat-runtime.ps1`

- [ ] **Step 1: Parse script**

Run:

```powershell
$null = [System.Management.Automation.Language.Parser]::ParseFile("scripts/windows/build-chat-runtime.ps1", [ref]$null, [ref]$errors); if ($errors.Count) { $errors | Format-List; exit 1 }
```

Expected: exit code 0.

- [ ] **Step 2: Check link-mode validation**

Run:

```powershell
$env:LAZYMIND_UV_LINK_MODE="invalid"; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/build-chat-runtime.ps1 -RepoRoot . -OutputDir "$env:TEMP\lazymind-link-mode-check"
```

Expected: early failure mentioning valid `LAZYMIND_UV_LINK_MODE` values before uv downloads or installs dependencies.
