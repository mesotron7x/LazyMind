# Phase 1 功能实现 Implementation Plan

## Purpose

This document is the implementation plan for LazyMind Desktop Mode new Phase 1. New Phase 1 merges the old first two stages. The target is:

- Build a self-contained Windows development output at `~/LazyMind_dev/`.
- Provide `~/LazyMind_dev/LazyMind.exe` as the double-click entrypoint.
- Run without Docker and without manually starting backend services.
- Deliver most Web-version functionality through Desktop Mode: assistants, skills, knowledge base, scan/parse/index/chat, model configuration, logs, diagnostics.
- Hide Desktop-removed UI surfaces: login, register, role/user management complexity, RBAC configuration, Evo.

---

## Conventions

- `[PARALLEL]` — Can run concurrently with other steps in the same wave.
- `[SEQUENTIAL]` — Must wait for prerequisites.
- `[TEST-FIRST]` — Write tests before implementation where practical.
- `[VERIFY]` — Run the specified verification after implementation.
- Paths are repository-root relative unless stated otherwise.
- Windows build scripts must use PowerShell or Windows-native commands. Do not use `sed`, `sleep`, `grep`, or other Unix-only tools.
- Python tooling must not be installed directly into the system environment. Use `uv tool install ...` for Python tools when needed.

---

## Wave 0: Stage Contract and Windows Build Foundation

### Step 0.1 [SEQUENTIAL] — Normalize Phase 1 build contract

**Goal:** Make the build target and output layout explicit before implementation.

**Actions:**
1. Define output root: `~/LazyMind_dev/`.
2. Define entrypoint: `~/LazyMind_dev/LazyMind.exe`.
3. Define required output subdirectories:
   ```text
   ~/LazyMind_dev/
     LazyMind.exe
     electron/
     renderer/
     bin/
     python-services/
     resources/
       icons/
       default-docs/
       templates/
     config/
     logs/
   ```
4. Document that this is not the final installer layout. The final installer belongs to Phase 2.

**Verify:**
- Implementation code and scripts use this layout consistently.

---

### Step 0.2 [TEST-FIRST] [PARALLEL] — Windows clean/build script tests

**Goal:** Validate build scripts before wiring expensive builds.

**Tests:**
1. `desktop-dev-windows-exe` removes old `~/LazyMind_dev/`.
2. Old `LazyMind.exe`, Electron, and managed backend processes are terminated before deletion.
3. Script contains no Unix-only commands: `sed`, `sleep`, `grep`, `rm -rf`, `cp -r` in Windows target.
4. Script does not create a real `nul` file.
5. Script detects missing `npm`/`npx`/`pnpm` under PowerShell 7 and reports an actionable error.

**Actions:**
1. Add or update `make desktop-dev-windows-exe`.
2. Implement PowerShell helper scripts under a Desktop build scripts directory.
3. Use `Remove-Item`, `Copy-Item`, `Start-Process`, `Stop-Process`, `Test-Path`, `New-Item` instead of Unix commands.
4. Add a post-build check for `~/LazyMind_dev/nul`.

**Verify:**
- Target can be invoked from Windows PowerShell.
- Repeated builds cleanly replace output.

---

### Step 0.3 [PARALLEL] — Frontend Desktop build output

**Goal:** Build renderer static assets for Electron custom protocol.

**Actions:**
1. Add or update `frontend` Desktop build script.
2. Ensure Vite `outDir` points to the Desktop output location.
3. Pass `--emptyOutDir` when `outDir` is outside project root.
4. Ensure Desktop mode compile-time flag is available to frontend code.
5. Confirm normal Web build remains unchanged.

**Verify:**
- Web build succeeds.
- Desktop renderer build succeeds.
- Desktop renderer output is copied to `~/LazyMind_dev/renderer/`.

---

### Step 0.4 [PARALLEL] — Icon and launcher resources

**Goal:** Prepare app icon and GUI launcher metadata.

**Actions:**
1. Generate `resources/icons/icon.ico` from `frontend/src/public/Lazy.png`.
2. Configure launcher resource metadata: product name `LazyMind`, original filename `LazyMind.exe`, file description, version.
3. Compile launcher with GUI subsystem (`-H=windowsgui`) so double-click does not show a console.
4. Ensure launcher starts child processes with no console window.

**Verify:**
- `LazyMind.exe` file properties show LazyMind metadata and icon.
- Double-clicking `LazyMind.exe` does not open a terminal window.

---

## Wave 1: Electron Shell, Security, and Process Lifecycle

### Step 1.1 [TEST-FIRST] [PARALLEL] — Electron shell and custom protocol

**Goal:** Load the renderer through a controlled custom protocol.

**Tests:**
1. `lazymind://app/` resolves to renderer `index.html`.
2. Unknown SPA routes fall back to `index.html`.
3. MIME types are correct.
4. CSP is applied.
5. `lazymind:` application links are handled and never produce unsupported protocol errors.

**Actions:**
1. Implement or update Electron main process protocol registration.
2. Use custom protocol for production renderer loading.
3. Keep dev mode compatible with Vite dev server when explicitly enabled.
4. Register app-level handling for `lazymind:` links used by existing UI features.

**Verify:**
- Main window loads renderer in production output.
- App-internal links using `lazymind:` do not crash or open browser errors.

---

### Step 1.2 [TEST-FIRST] [PARALLEL] — BrowserWindow and IPC security baseline

**Goal:** Ensure renderer does not gain broad local privileges.

**Tests:**
1. `nodeIntegration=false`.
2. `contextIsolation=true`.
3. `webSecurity=true`.
4. Renderer cannot access raw `ipcRenderer`.
5. IPC handlers reject unknown channels.
6. Path IPC rejects traversal and non-allowed paths.

**Actions:**
1. Define `SECURITY_CONFIG`.
2. Implement IPC channel registry.
3. Expose only typed `window.lazymind` APIs in preload.
4. Remove Electron default menu via `Menu.setApplicationMenu(null)`.

**Verify:**
- No default menu bar appears, including Alt-key menu flash.
- Security tests pass.

---

### Step 1.3 [TEST-FIRST] [SEQUENTIAL] — Process manager

**Prereqs:** Step 1.2

**Goal:** Electron/launcher starts, monitors, logs, and stops all local services.

**Tests:**
1. Service state transitions: pending -> starting -> healthy -> stopped.
2. Port conflicts are detected.
3. Crash triggers bounded restart/backoff.
4. `stopAll()` kills process trees.
5. Spawn uses argument arrays and `shell: false`.
6. Environment variables are whitelisted.
7. Child processes do not show console windows.

**Actions:**
1. Define service configs for core, auth-service, algorithm service, scan-control-plane, file-watcher.
2. Start services from `~/LazyMind_dev/bin/` and `~/LazyMind_dev/python-services/`.
3. Inject Desktop mode env vars, DB paths, local secret, log paths.
4. Capture stdout/stderr into module logs.
5. Surface service status to renderer.

**Verify:**
- Starting `LazyMind.exe` starts all required services.
- Closing app leaves no managed child process.

---

### Step 1.4 [TEST-FIRST] [SEQUENTIAL] — Local proxy and identity injection

**Prereqs:** Step 1.3

**Goal:** Replace Kong in Desktop Mode and control assistant identity.

**Tests:**
1. Proxy binds only `127.0.0.1`.
2. Routes auth/core/chat/parse/processor/doc/scan/file APIs.
3. SSE passthrough works.
4. Multipart upload/download works.
5. Renderer-supplied `X-User-ID` / `X-User-Id` is overwritten.
6. Proxy injects current assistant ID and `X-Desktop-Secret`.
7. Backend returns 401/403 for missing or invalid local secret on protected Desktop routes.
8. CORS only allows Desktop renderer origin.

**Actions:**
1. Implement local proxy route table.
2. Generate local secret at startup.
3. Pass secret to managed backend services.
4. Add Desktop secret validation middleware to backend services where needed.
5. Update frontend API base URL for Desktop Mode.

**Verify:**
- Frontend requests reach backend through proxy.
- Other local clients cannot perform privileged Desktop actions without local secret.

---

## Wave 2: SQLite, Runtime Store, and Desktop Auth

### Step 2.1 [TEST-FIRST] [PARALLEL] — SQLite complete migration

**Goal:** Remove PostgreSQL dependency from Desktop Mode.

**Tests:**
1. core SQLite migrations apply from empty DB.
2. auth-service migrations apply from empty DB.
3. scan-control-plane migrations apply from empty DB.
4. algorithm/document task schema initializes.
5. WAL, busy timeout, foreign keys are enabled.
6. PostgreSQL / Cloud path still works.

**Actions:**
1. Complete SQLite migration directories for core/auth/scan/algorithm.
2. Replace PostgreSQL-specific SQL or isolate by dialect.
3. Establish DB ownership:
   - `main.db`: core
   - `auth.db`: auth-service
   - `scan.db`: scan-control-plane/file-watcher
   - `algo.db`: algorithm/parsing/processor/doc-service
4. Route cross-service access through APIs, not cross-DB writes.

**Verify:**
- Desktop services start using SQLite files under user data dir.
- Cloud migrations/tests remain unaffected.

---

### Step 2.2 [TEST-FIRST] [PARALLEL] — Runtime Store replacement and hardening

**Goal:** Replace Redis semantics without deleting behavior.

**Tests:**
1. Chat status set/get works.
2. Cancel signal crosses goroutine/process boundary required by current architecture.
3. Multi-answer metadata works.
4. Chat input state works.
5. TTL cleanup works.
6. Required persistent states survive restart.
7. Cloud Redis implementation still passes behavior tests.

**Actions:**
1. Introduce `RuntimeStore` interface.
2. Implement `RedisRuntimeStore` for Cloud.
3. Implement `MemoryRuntimeStore` to unblock Desktop startup.
4. Implement SQLite-backed or hybrid store for restart-sensitive state.
5. Replace direct Redis calls in core chat/runtime paths.
6. Make auth-service work without Redis in Desktop mode.

**Verify:**
- Desktop Mode starts without Redis.
- Restart-sensitive chat/runtime state behaves as designed.

---

### Step 2.3 [TEST-FIRST] [SEQUENTIAL] — Desktop Auth and AI Assistant APIs

**Prereqs:** Step 2.1

**Goal:** Desktop Mode is login-free but still uses backend user model.

**Tests:**
1. `/desktop/bootstrap` creates default group, role, permissions, and “天文学家 🪐”.
2. Bootstrap is idempotent.
3. Assistant CRUD maps to backend users.
4. New assistants join default group with write permission.
5. Current assistant identity is returned to Electron/frontend.
6. Desktop routes are not registered in Cloud mode.
7. 50 assistants can be created and switched without data mix-up.

**Actions:**
1. Add Desktop bootstrap and assistant endpoints to auth-service.
2. Ensure default assistant description matches HLD.
3. Soft-delete or archive assistant according to LLD policy.
4. Preserve RBAC tables and permission checks.
5. Hide RBAC complexity from Desktop UI rather than deleting data model.

**Verify:**
- Desktop app opens without login.
- Default assistant appears on first launch.
- Assistant switching changes backend request context.

---

## Wave 3: Vector, Segment, and Algorithm Pipeline

### Step 3.1 [TEST-FIRST] [PARALLEL] — Milvus Lite full integration

**Goal:** Use Milvus Lite as Desktop vector store.

**Tests:**
1. Collection create/drop works.
2. Insert/search/delete works.
3. Filters by assistant/user and document work.
4. Data persists across process restart.
5. Chinese and space-containing Windows paths work.
6. 10K-vector search target is measured.

**Actions:**
1. Implement VectorStore protocol if missing.
2. Implement Milvus Lite backend.
3. Configure data dir under user data path.
4. Add Go/No-Go smoke for Windows.
5. Keep Cloud Milvus path unchanged.

**Verify:**
- Real document embeddings can be written and queried in Desktop Mode.

---

### Step 3.2 [TEST-FIRST] [PARALLEL] — SegmentStore local implementation

**Goal:** Replace OpenSearch with a local Desktop SegmentStore implementation.

**Tests:**
1. Index segments.
2. Search by keyword.
3. Delete by document/assistant.
4. Assistant isolation works.
5. Chinese text search works within accepted limitation.
6. Restart persistence works.
7. Cloud OpenSearch implementation remains unchanged.

**Actions:**
1. Reuse existing SegmentStore abstraction.
2. Add SQLite FTS5 or other approved lightweight local implementation.
3. Identify and route direct OpenSearch calls through SegmentStore.
4. Add behavior parity tests.

**Verify:**
- Chat/RAG retrieves local segments through SegmentStore.

---

### Step 3.3 [TEST-FIRST] [SEQUENTIAL] — Algorithm, parsing, indexing, and Chat/RAG pipeline

**Prereqs:** Steps 2.1, 3.1, 3.2

**Goal:** Build the real local document-to-answer chain.

**Tests:**
1. Markdown parsing creates segments.
2. Default solar-system Markdown is scanned and parsed.
3. Parse task status transitions: queued -> processing -> completed/failed.
4. Embedding uses configured provider or deterministic mock in tests.
5. Segments are stored in SegmentStore.
6. Vectors are stored in Milvus Lite.
7. Chat query retrieves relevant context.
8. Assistant A cannot read assistant B context.
9. Unsupported Office/OCR paths return clear degraded status.

**Actions:**
1. Build/consolidate algorithm FastAPI app or service topology.
2. Add parse, processor, doc, chat routers as needed.
3. Implement text/Markdown parsing and segmentation.
4. Add embedding provider abstraction.
5. Wire model provider config from existing inner/dynamic mechanism.
6. Keep mock LLM/embedding server for tests and default development config.
7. Ensure mock state is reported to frontend.

**Verify:**
- Default document can go through scan, parse, index, and Chat/RAG flow.

---

### Step 3.4 [TEST-FIRST] [PARALLEL] — Scan path reuse and permissions

**Goal:** Reuse existing scan logic with Desktop path selection.

**Tests:**
1. Renderer can request folder picker through preload API.
2. Scan path add/remove/list works.
3. Unauthorized/protected directories produce user-readable errors.
4. No default full-disk scan.
5. Scan status is visible.

**Actions:**
1. Wire Electron folder picker to frontend.
2. Reuse existing scan-control-plane/file-watcher logic.
3. Store scan paths per assistant where applicable.
4. Add path canonicalization and permission checks.

**Verify:**
- User-selected folders can be scanned and indexed.

---

## Wave 4: Frontend Desktop Complete Experience

### Step 4.1 [TEST-FIRST] [PARALLEL] — Desktop mode, auth facade, and Assistant Switcher

**Goal:** Frontend works without login and keeps current assistant consistent.

**Tests:**
1. Desktop mode skips login redirect.
2. Settings page does not show “前往登录”.
3. Assistant Switcher loads assistant list.
4. Switching assistant updates store and backend context.
5. Chat and Skills pages use selected assistant.

**Actions:**
1. Add/complete Desktop mode detection.
2. Initialize Desktop store from `window.lazymind`.
3. Sync synthetic auth state only as frontend compatibility, not as authority.
4. Add Assistant Switcher to main layout.
5. Ensure current assistant is used in Chat, Skills, Knowledge, Preferences.

**Verify:**
- Manual switcher flow works with backend requests.

---

### Step 4.2 [TEST-FIRST] [PARALLEL] — Hide removed Desktop UI

**Goal:** HLD-removed features are hidden in Desktop Mode.

**Tests:**
1. Login/register routes redirect or are inaccessible in Desktop Mode.
2. User role management is hidden.
3. Complex RBAC configuration is hidden.
4. Evo entries/routes are hidden.
5. “用户” labels exposed to ordinary Desktop users become “AI 助手”.
6. “新建用户” displays as “新建 AI 助手”.

**Actions:**
1. Add route/page-level Desktop feature flags.
2. Update menu/sidebar entries.
3. Update visible labels.
4. Preserve Cloud UI behavior in Cloud mode.

**Verify:**
- Desktop UI does not expose removed features.
- Cloud UI remains unchanged.

---

### Step 4.3 [TEST-FIRST] [PARALLEL] — Knowledge, scan, index, and mock model status UI

**Goal:** Make local pipeline status visible.

**Tests:**
1. Scan paths list renders.
2. Parse/index statuses render.
3. Service unavailable state is clear.
4. Mock model warning renders only when mock config is active.
5. Mock warning links to `/model-providers`.

**Actions:**
1. Add scan path management UI or adapt existing UI.
2. Add parse/index status components.
3. Add service status bar/panel.
4. Add/keep `MockModelWarning`.
5. Use existing API status endpoints.

**Verify:**
- User can see why Chat/RAG is unavailable, degraded, or mock-backed.

---

### Step 4.4 [TEST-FIRST] [PARALLEL] — Model configuration reuse

**Goal:** Use existing `/model-providers` page, not a Desktop-only replacement.

**Tests:**
1. `/model-providers` route is reachable in Desktop Mode.
2. Existing providers, including SiliconFlow, are visible.
3. Dynamic GUI configuration persists.
4. Inner/preloaded configuration is available after build output copy.
5. No obsolete Desktop-only local model config UI remains linked.

**Actions:**
1. Route Desktop model configuration entry to `/model-providers`.
2. Ensure build target copies gitignored local development model config into output when present.
3. Wire credential storage or config persistence according to final config architecture.
4. Remove or unlink reverted Desktop-only local file config approach.

**Verify:**
- After rebuilding `~/LazyMind_dev/`, model config does not require manual re-entry when a local dev config exists.

---

## Wave 5: Credential, Logging, Diagnostics, and Security

### Step 5.1 [TEST-FIRST] [PARALLEL] — Credential and config boundary

**Goal:** Keep secrets out of logs and diagnostics.

**Tests:**
1. API keys are redacted from logs.
2. API keys are redacted from diagnostics.
3. Local secret is redacted.
4. Credential IPC rejects invalid service/account names.
5. OS credential backend or fallback behavior is explicit.

**Actions:**
1. Reuse existing inner/dynamic model config mechanism.
2. Implement credential service if included in Phase 1 scope.
3. If OS credential storage is deferred, keep clear interface and add Phase 2 validation item.
4. Ensure development copied config is gitignored and never logged.

**Verify:**
- Diagnostics package contains only safe config summary.

---

### Step 5.2 [TEST-FIRST] [PARALLEL] — Logging and diagnostics

**Goal:** Provide useful diagnostics for Windows environments.

**Tests:**
1. Each managed process has a log file.
2. Logs rotate.
3. Diagnostic zip includes service status, version, config summary, recent logs.
4. Diagnostic zip excludes DB files, vector data, user documents, and plaintext secrets.
5. Opening log folder is path-checked.

**Actions:**
1. Implement log sanitizer and rotating writer.
2. Collect process stdout/stderr.
3. Implement diagnostics exporter.
4. Add frontend entry for logs/diagnostics.

**Verify:**
- Diagnostic export works from `LazyMind.exe` run.

---

### Step 5.3 [TEST-FIRST] [PARALLEL] — Repository and line-ending rules

**Goal:** Avoid Windows script and checkout issues.

**Tests:**
1. `.bat`, `.ps1`, Windows C launcher resources use CRLF.
2. Go/Python/Shell/TS/CSS/HTML/MD use LF unless locally required otherwise.
3. Generated output does not dirty source files.

**Actions:**
1. Add/update `.gitattributes`:
   - server code: LF
   - Windows-specific scripts/C source: CRLF
   - frontend code: LF
   - design docs: LF
2. Normalize only files touched for Desktop build if needed.

**Verify:**
- Fresh checkout on Windows can run the build target.

---

## Wave 6: End-to-End Verification

### Step 6.1 [SEQUENTIAL] — Self-contained directory smoke

**Prereqs:** Waves 0-5

**Verify:**
1. Run `make desktop-dev-windows-exe`.
2. Confirm `~/LazyMind_dev/LazyMind.exe` exists.
3. Confirm `~/LazyMind_dev/nul` does not exist.
4. Double-click or start `LazyMind.exe`.
5. Confirm no console window.
6. Confirm main UI appears.
7. Confirm no Electron menu bar.
8. Close app and confirm no child process remains.

---

### Step 6.2 [SEQUENTIAL] — Functional smoke

**Verify:**
1. App opens without login.
2. Default “天文学家 🪐” assistant appears.
3. Default solar-system Markdown exists and is visible.
4. Create a second assistant.
5. Switch assistants in Chat and Skills.
6. Add a scan path.
7. Scan, parse, index a Markdown document.
8. Chat retrieves local context.
9. Mock model warning appears when mock config is active.
10. `/model-providers` opens and supports provider configuration.

---

### Step 6.3 [SEQUENTIAL] — Isolation and persistence

**Verify:**
1. Create at least 50 assistants.
2. Confirm conversations are isolated.
3. Confirm skills are isolated.
4. Confirm knowledge context is isolated.
5. Restart app.
6. Confirm last selected assistant and persisted data recover.
7. Confirm runtime states that should recover do recover.

---

### Step 6.4 [SEQUENTIAL] — Security and diagnostics smoke

**Verify:**
1. Renderer cannot access Node APIs.
2. Raw IPC is unavailable.
3. Local backend ports are not exposed on LAN.
4. Requests without local secret cannot call protected Desktop routes.
5. Renderer-supplied `X-User-ID` cannot spoof current assistant.
6. Diagnostic package exports successfully.
7. Diagnostic package contains no plaintext model key, token, local secret, or user document body.

---

### Step 6.5 [SEQUENTIAL] — Cloud regression check

**Verify:**
1. Existing Web frontend build still succeeds.
2. Cloud backend defaults still use existing Kong/PostgreSQL/Redis/Milvus/OpenSearch paths.
3. Desktop-only dependencies do not become required for Cloud Docker build.
4. Desktop feature flags do not hide Cloud UI routes.

---

## Completion Criteria

Phase 1 is complete only when all of the following are true:

1. `make desktop-dev-windows-exe` builds `~/LazyMind_dev/` on Windows.
2. `~/LazyMind_dev/LazyMind.exe` launches the app by double-click.
3. Desktop app requires no Docker and no manual backend startup.
4. Most Web functionality is available through Desktop Mode local services.
5. HLD-removed functions are hidden or disabled in Desktop UI.
6. SQLite, Milvus Lite, SegmentStore, scan/parse/index/chat are in the real local chain.
7. Model configuration uses `/model-providers`.
8. Logs and diagnostics work and are redacted.
9. Assistant isolation and restart persistence are verified.
10. Cloud/Server Mode is not regressed.
