# Phase 1 功能实现 Implementation Plan

## Purpose

This document owns the execution order for LazyMind Desktop Mode Phase 1. Phase 1 is a one-shot functional delivery: it must produce a self-contained Windows desktop runtime with the full local assistant, scan, parse, index, retrieve, Chat/RAG, model configuration, logging, diagnostics, and security baseline. 

Detailed interfaces, schemas, APIs, file manifests, and acceptance details live in the linked LLD documents. Keep this plan focused on sequencing, dependencies, and verification gates.

## Source Documents

- Overview and acceptance: `lld.md`
- Desktop shell and package directory: `01-electron-shell.md`
- Process lifecycle: `02-process-manager.md`
- Local proxy and identity injection: `03-local-proxy.md`
- Desktop auth and AI assistant model: `04-desktop-auth.md`
- SQLite migration foundation: `05-sqlite-migration.md`
- Runtime store foundation: `06-runtime-store.md`
- Frontend desktop mode foundation: `07-frontend-desktop-mode.md`
- Logging, diagnostics, and security baseline: `08-logging-diagnostics-security.md`
- Module-level verification matrix: `09-test-plan.md`
- Complete SQLite data layer: `10-sqlite-complete.md`
- Milvus Lite vector store: `11-milvus-lite.md`
- SegmentStore local retrieval: `12-segment-store-local.md`
- Algorithm and parsing pipeline: `13-algorithm-pipeline.md`
- Runtime store hardening: `14-runtime-store-hardening.md`
- Frontend complete experience: `15-frontend-complete.md`
- Credential and secret management: `16-credential-security.md`
- Integration and performance verification: `17-test-plan.md`

## Conventions

- `[SEQUENTIAL]` means the step consumes outputs from earlier steps and should not be parallelized.
- `[PARALLEL]` means the step can proceed once its listed prerequisites are stable.
- `[TEST-FIRST]` means contract or regression tests should be written before implementation when practical.
- Each step should update the linked LLD when implementation changes the design contract.

---

## Wave 0: Desktop Shell, Build Contract, and Security Baseline

### Step 0.1 [SEQUENTIAL] — Freeze the Phase 1 desktop runtime contract

**Refs:** `lld.md`, `01-electron-shell.md`, `08-logging-diagnostics-security.md`

**Outcome:** The `make windows-desktop` contract, `~/LazyMind/` layout, `LazyMind.exe` launcher role, Desktop Mode switches, data directory, log directory, and security boundaries are explicit before feature implementation fans out.

### Step 0.2 [TEST-FIRST] [PARALLEL] — Windows self-contained build workflow

**Refs:** `01-electron-shell.md`, `09-test-plan.md`, `17-test-plan.md`

**Outcome:** The Make target cleans old processes/output, builds frontend/Electron/Go/Python/resources/icons/configs, copies development-only ignored config when present, avoids Unix-only commands, and checks for bad artifacts such as `nul`.

### Step 0.3 [TEST-FIRST] [PARALLEL] — Electron shell, protocol, and launcher resources

**Refs:** `01-electron-shell.md`, `08-logging-diagnostics-security.md`

**Outcome:** Electron loads the renderer through the desktop protocol, handles `lazymind:` links, removes the default menu, exposes only approved preload APIs, and embeds the required icon/launcher metadata.

### Step 0.4 [TEST-FIRST] [PARALLEL] — Logging, diagnostics, and security primitives

**Refs:** `08-logging-diagnostics-security.md`, `16-credential-security.md`

**Outcome:** IPC allowlists, path validation, log collection, redaction, diagnostic bundle boundaries, local secret primitives, and child-process safety rules exist before services and frontend depend on them.

---

## Wave 1: Local Runtime and Data Layer

### Step 1.1 [TEST-FIRST] [SEQUENTIAL] — Process manager for all local services

**Refs:** `02-process-manager.md`, `08-logging-diagnostics-security.md`

**Outcome:** Electron can start, health-check, log, surface failure states for, and terminate core, auth-service, algorithm/chat/parsing/processor/doc services, scan-control-plane, and file-watcher from controlled resource paths.

### Step 1.2 [TEST-FIRST] [SEQUENTIAL] — Local proxy and identity injection

**Refs:** `03-local-proxy.md`, `04-desktop-auth.md`, `08-logging-diagnostics-security.md`

**Outcome:** All frontend API traffic flows through Local Proxy with REST/SSE/upload/download support, backend readiness errors, desktop secret injection, and controlled current-assistant identity injection.

### Step 1.3 [TEST-FIRST] [PARALLEL] — Complete SQLite data layer

**Refs:** `05-sqlite-migration.md`, `10-sqlite-complete.md`

**Outcome:** Core, auth, scan, and algorithm services have complete SQLite migrations, ownership boundaries, PostgreSQL compatibility adaptations, WAL/timeout/foreign-key behavior, backup/restore boundaries, and Cloud-safe selection logic.

### Step 1.4 [TEST-FIRST] [PARALLEL] — Runtime store replacement and recovery

**Refs:** `06-runtime-store.md`, `14-runtime-store-hardening.md`

**Outcome:** Redis-dependent state is mapped to Desktop local stores with explicit volatile/durable classification, SQLite recovery where needed, cleanup strategy, and Cloud-safe factory selection.

---

## Wave 2: Identity, Retrieval, and Algorithm Loop

### Step 2.1 [TEST-FIRST] [SEQUENTIAL] — Desktop Auth and AI Assistant identity

**Refs:** `04-desktop-auth.md`, `03-local-proxy.md`, `15-frontend-complete.md`

**Outcome:** First launch creates default permissions, default group, default assistant, and default sample document; assistant CRUD and current-assistant selection propagate through Local Proxy into backend APIs.

### Step 2.2 [TEST-FIRST] [PARALLEL] — Milvus Lite vector store

**Refs:** `11-milvus-lite.md`, `13-algorithm-pipeline.md`

**Outcome:** Desktop vector storage supports collection lifecycle, indexing, insert/search/delete/update, persistence across restart, graceful shutdown, rebuild, and recovery prompts.

### Step 2.3 [TEST-FIRST] [PARALLEL] — SegmentStore local retrieval

**Refs:** `12-segment-store-local.md`, `13-algorithm-pipeline.md`

**Outcome:** Desktop local keyword/segment retrieval implements the existing SegmentStore contract, converges direct OpenSearch call sites, and passes behavioral comparison checks against the Cloud route.

### Step 2.4 [TEST-FIRST] [SEQUENTIAL] — Parsing, indexing, and Chat/RAG pipeline

**Refs:** `13-algorithm-pipeline.md`, `10-sqlite-complete.md`, `11-milvus-lite.md`, `12-segment-store-local.md`, `14-runtime-store-hardening.md`

**Outcome:** The default document and user-selected folders can flow through scan, parse, segment, embed, vector/segment index, retrieve, stream Chat/RAG answers, and status APIs with visible degradation for unavailable Office/OCR/local model capabilities.

### Step 2.5 [TEST-FIRST] [PARALLEL] — Credential and model configuration boundary

**Refs:** `16-credential-security.md`, `13-algorithm-pipeline.md`, `15-frontend-complete.md`

**Outcome:** Desktop reuses `/model-providers`; dynamic GUI configuration is the Phase 1 acceptance path, while inner/public may exist outside acceptance. API keys stay out of logs/diagnostics and reach backend services only through the approved credential bridge.

---

## Wave 3: Frontend Complete Experience

### Step 3.1 [TEST-FIRST] [SEQUENTIAL] — Desktop mode facade and Assistant Switcher

**Refs:** `07-frontend-desktop-mode.md`, `15-frontend-complete.md`, `04-desktop-auth.md`

**Outcome:** The UI enters Desktop Mode without login, uses assistant identity across Chat/skills/knowledge/preferences, and hides server-only identity affordances.

### Step 3.2 [TEST-FIRST] [PARALLEL] — Knowledge, scan, indexing, and service status UI

**Refs:** `15-frontend-complete.md`, `13-algorithm-pipeline.md`, `17-test-plan.md`

**Outcome:** Users can choose scan folders, see parse/index progress, distinguish local service/model/indexing errors, and use `/model-providers` to configure real SiliconFlow / Qwen models dynamically for acceptance.

### Step 3.3 [TEST-FIRST] [PARALLEL] — Native capabilities through controlled IPC

**Refs:** `01-electron-shell.md`, `08-logging-diagnostics-security.md`, `16-credential-security.md`

**Outcome:** Directory selection, opening log directories, diagnostic export, credential operations, and any desktop-only capabilities go through validated preload APIs with narrow parameter schemas.

---

## Wave 4: Phase 1 End-to-End Verification

### Step 4.1 [SEQUENTIAL] — Self-contained runtime smoke

**Refs:** `09-test-plan.md`, `17-test-plan.md`

**Outcome:** `make windows-desktop` produces `~/LazyMind/LazyMind.exe`; launch from the app directory, first window, service startup, proxy readiness, and close cleanup work without Docker, Node, Go, Python, or manual backend startup.

### Step 4.2 [SEQUENTIAL] — Functional loop smoke

**Refs:** `13-algorithm-pipeline.md`, `15-frontend-complete.md`, `17-test-plan.md`

**Outcome:** After `make windows-desktop`, automated UI E2E launches `~/LazyMind/LazyMind.exe`, configures SiliconFlow / Qwen models dynamically from `~/models.md`, ingests `~/docs`, verifies parse/index/vector/segment completion, verifies retrieval returns relevant chunks, and verifies Chat/RAG answers use those chunks with visible sources.

### Step 4.3 [SEQUENTIAL] — Isolation, persistence, and recovery

**Refs:** `04-desktop-auth.md`, `10-sqlite-complete.md`, `14-runtime-store-hardening.md`, `17-test-plan.md`

**Outcome:** 50+ assistants pass identity isolation tests; restart restores data and selected assistant; vector/segment/runtime state survives the expected lifecycle; corrupted local stores produce recoverable errors.

### Step 4.4 [SEQUENTIAL] — Security and diagnostics smoke

**Refs:** `08-logging-diagnostics-security.md`, `16-credential-security.md`, `17-test-plan.md`

**Outcome:** IPC, Local Proxy local secret, assistant identity injection, path validation, log/diagnostic redaction, backend localhost binding, and child-process cleanup checks pass.

### Step 4.5 [SEQUENTIAL] — Performance and Cloud regression

**Refs:** `17-test-plan.md`, all LLDs with Cloud Mode compatibility sections

**Outcome:** Cold start, search latency, memory, parse throughput, and concurrency budgets are measured; Server/Cloud Mode defaults remain on Docker, Kong, PostgreSQL, Redis, Milvus, and OpenSearch unless Desktop Mode is explicitly selected.

## Completion Criteria

Phase 1 is complete only when the acceptance overview in `lld.md` and the detailed checks in `09-test-plan.md` and `17-test-plan.md` pass. Any implementation change that alters a public contract must update the owning LLD before the corresponding step is considered complete.
