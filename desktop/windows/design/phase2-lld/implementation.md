# Phase 2 打安装包 Implementation Plan

## Purpose

This document describes the implementation plan for new Phase 2: Windows installer packaging. Feature completion belongs to new Phase 1. Phase 2 starts only after `make desktop-dev-windows-exe` can produce a working `~/LazyMind_dev/` directory with `LazyMind.exe`.

---

## Wave 0: Package Contract

### Step 0.1 — Freeze Phase 1 artifact contract

**Goal:** Treat the Phase 1 self-contained directory as installer input.

**Actions:**
1. Document required files from `~/LazyMind_dev/`.
2. Identify which files become installer resources.
3. Identify which files must move to user data directory on first launch.
4. Define version metadata and artifact naming.

**Verify:**
- Installer build fails early if required Phase 1 artifacts are missing.

---

## Wave 1: Electron Installer

### Step 1.1 — Configure electron-builder

**Actions:**
1. Configure product name `LazyMind`.
2. Configure icon, version, app ID, publisher metadata.
3. Include renderer, Electron main/preload, backend binaries, Python service directories, templates, default docs.
4. Exclude dev dependencies and unnecessary build artifacts.

**Verify:**
- Local Windows installer artifact is generated.

---

### Step 1.2 — Install directory and resource lookup

**Actions:**
1. Ensure Electron locates backend resources from packaged resource paths.
2. Ensure user data remains under `%APPDATA%\LazyMind\`.
3. Ensure logs are written to user data/log paths, not install directory.

**Verify:**
- Installed app starts with normal user permissions.

---

## Wave 2: Backend Packaging

### Step 2.1 — Go service packaging

**Actions:**
1. Compile Windows exe for required Go services.
2. Include version metadata.
3. Place under installer resource `bin/`.
4. Verify stdout/stderr collection.

**Verify:**
- Packaged app starts and stops Go services.

---

### Step 2.2 — Python service packaging

**Actions:**
1. Package auth/algorithm/parsing/processor/doc services as executable directories or single-file executables.
2. Include Milvus Lite dependencies.
3. Include certificates, templates, and runtime resources.
4. Validate dynamic imports and model SDK loading.

**Verify:**
- Packaged app starts Python services without system Python.

---

## Wave 3: Upgrade, Uninstall, and Data

### Step 3.1 — First launch and migration

**Actions:**
1. Copy default config and default documents to user data directory only on first launch.
2. Detect schema/data version.
3. Run necessary migrations.
4. Preserve user-created assistants, documents, vectors, indexes, and model config.

**Verify:**
- Fresh install initializes data.
- Upgrade install preserves data.

---

### Step 3.2 — Uninstall behavior

**Actions:**
1. Default uninstall preserves `%APPDATA%\LazyMind\`.
2. Optional data cleanup behavior is documented or implemented if chosen.
3. Remove only installer-owned application files by default.

**Verify:**
- Uninstall does not accidentally delete user data.

---

## Wave 4: Security, Signing, and CI

### Step 4.1 — Signing and integrity

**Actions:**
1. Add signing configuration placeholders.
2. Ensure signing secrets are read only from CI secrets or local secure env.
3. Produce SHA256 checksums.
4. Plan backend binary integrity validation if required.

**Verify:**
- Unsigned dev installer and signed release path are clearly separated.
- Secrets are not logged.

---

### Step 4.2 — GitHub Actions artifact workflow

**Actions:**
1. Add Windows Desktop installer workflow.
2. Cache npm, Go, Python/uv dependencies safely.
3. Build frontend, Electron, Go services, Python services, installer.
4. Upload installer, SHA256, commit SHA, version metadata, build logs.
5. Keep workflow independent from Cloud/Server Mode CI.

**Verify:**
- Manual `workflow_dispatch` produces artifact.
- Cloud CI remains unchanged.

---

## Wave 5: Clean Environment Verification

### Step 5.1 — Clean Windows smoke

**Verify:**
1. Install on clean Windows x64 without Docker/Node/Go/Python.
2. Launch `LazyMind.exe`.
3. Default assistant appears.
4. Add document path.
5. Build knowledge base.
6. Ask a question.
7. Close app and confirm child processes exit.
8. Restart and confirm data persists.

---

### Step 5.2 — Path and permission smoke

**Verify:**
1. Install/run under normal user permissions.
2. Run with Chinese Windows username/path.
3. Run with spaces in install path or user data path.
4. Validate Windows Defender / security software behavior.
5. Export diagnostics.

---

## Completion Criteria

Phase 2 is complete when:

1. Windows installer builds locally and in GitHub Actions.
2. Installed app runs without development tools.
3. User data survives restart and upgrade.
4. Uninstall behavior is safe.
5. Diagnostics work in installed environment.
6. Artifact contains version, commit SHA, SHA256, and build logs.
7. Cloud/Server Mode CI is unaffected.
