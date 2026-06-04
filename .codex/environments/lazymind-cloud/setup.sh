#!/usr/bin/env bash
set -euo pipefail

# Codex cloud setup for the default LazyMind environment.
# Use this script in the Codex environment named "lazymind-cloud".

corepack enable || true
corepack prepare pnpm@10.0.0 --activate || npm install -g pnpm@10.0.0

python -m pip install --upgrade pip
python -m pip install flake8 flake8-quotes flake8-bugbear pytest httpx

(cd frontend && pnpm install --frozen-lockfile)
(cd tests/frontend && npm install)

# Go dependencies are resolved lazily by go test/build, but this warms the main modules.
(cd backend/core && go mod download)
(cd backend/file-watcher && go mod download)
(cd backend/scan-control-plane && go mod download)
