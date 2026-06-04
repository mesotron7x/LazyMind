# AGENTS.md

## Project Overview

LazyMind is an enterprise RAG knowledge-base platform with a cloud/container stack, a Go core API, Python algorithm services, a React/Vite frontend, evo self-evolution tooling, and a Windows desktop runtime.

Key areas:

- `backend/core/`: Go HTTP API, ACL, chat, memory, migrations, OpenAPI output.
- `backend/auth-service/`: FastAPI auth, JWT/RBAC, users, roles, and groups.
- `backend/file-watcher/` and `backend/scan-control-plane/`: Go services for local/cloud source scanning.
- `algorithm/`: Python chat, parsing, processor, model config, and RAG tools.
- `evo/`: Python self-evolution service and harness.
- `frontend/`: React/Vite SPA using pnpm.
- `desktop/windows/`: Windows Electron shell, Go launcher, runtime resources, and design docs.
- `api/`: OpenAPI specs. Keep generated frontend clients in sync when APIs change.
- `tests/`: module-level unit tests and the full test runner.

## Working Rules

- Prefer existing Makefile targets and local patterns over one-off commands.
- Keep generated API clients, OpenAPI specs, migrations, and docs in sync with behavior changes.
- Do not introduce Docker, Node, Go, Python, or desktop toolchain changes casually; this repo has multiple deployment surfaces.
- Treat Windows desktop work as first-class. Verify Windows path assumptions instead of translating blindly from Linux or WSL conventions.
- For frontend changes, match the existing Ant Design/SCSS style and avoid marketing-style layouts inside operational screens.
- For Go changes, run `gofmt` on touched Go files.
- For Python changes, keep flake8-compatible style.
- Do not commit secrets. Use `.env` locally and keep examples in `.env.example`.

## Common Commands

From the repository root:

```bash
make help
make lint
make test
./tests/run-all.sh
```

Cloud/container stack:

```bash
make up
make up-build
make down
make fresh-start
```

Windows desktop build, from Windows PowerShell or a Windows shell with Git/MSYS tools:

```powershell
make windows-build-tools
make windows-build-tools-check
make windows-desktop LAZYMIND_OUTPUT_DIR="C:/Users/$env:USERNAME/LazyMind"
```

The default Windows desktop output is `~/LazyMind/`, and the launcher is `~/LazyMind/LazyMind.exe`.

## Targeted Verification

Use the narrowest reliable check for the area changed:

- Frontend app: `cd frontend && pnpm install --frozen-lockfile && pnpm build`
- Frontend tests: `cd tests/frontend && npm install && npm test`
- Auth service: `python -m pytest tests/backend/auth-service/ -v --tb=short`
- Go core tests: `cd tests/backend/core && go test ./... -v`
- File watcher tests: `cd backend/file-watcher && go test ./...`
- Scan control plane tests: `cd backend/scan-control-plane && go test ./...`
- Algorithm tests: `python -m pytest tests/algorithm/ -v --tb=short`
- Evo tests: `python -m pytest tests/evo/ -v --tb=short`
- Full suite: `make test`

For Windows desktop changes, prefer:

```powershell
make windows-desktop LAZYMIND_OUTPUT_DIR="C:/Users/$env:USERNAME/LazyMind"
& "$HOME/LazyMind/LazyMind.exe"
```

## Environment Notes

- `LAZYMIND_MODEL_CONFIG_PATH=dynamic` is the default model mode.
- Standard local frontend URL after `make up` is `http://localhost:8090`.
- Kong/API gateway defaults to `http://localhost:8000`.
- Unified Swagger UI is `http://localhost:8090/docs.html`.
- Built-in credentials for local development are `admin` / `admin`.
- OCR, Milvus, OpenSearch, dashboards, and model provider keys are configured through environment variables documented in `docs/quick_start.md`.
