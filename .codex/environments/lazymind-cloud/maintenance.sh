#!/usr/bin/env bash
set -euo pipefail

# Keep cached Codex cloud containers current after dependency files change.

(cd frontend && pnpm install --frozen-lockfile)
(cd tests/frontend && npm install)
(cd backend/core && go mod download)
(cd backend/file-watcher && go mod download)
(cd backend/scan-control-plane && go mod download)
