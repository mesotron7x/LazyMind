# Upgrade backend/core to Go 1.25.11

## Context

`backend/core` is a standalone Go module using `module lazymind/core`. It currently declares Go 1.24.0 in its module file and builds with a Go 1.24.6 Docker builder image. The related test module under `tests/backend/core` also declares Go 1.24.0, and CI runs backend/core tests with Go 1.24.0.

Go 1.25.11 was released on 2026-06-02 and includes security fixes and compiler/runtime bug fixes. The goal is to move the backend/core toolchain entry points to that patch version without broadening the change to unrelated Go services.

## Approved Approach

Use a focused backend/core upgrade.

Update only the files that directly affect backend/core development, testing, and container builds:

- `backend/core/go.mod`
- `backend/core/Dockerfile`
- `tests/backend/core/go.mod`
- `.github/workflows/ci.yml`
- `docker-compose.yml`

Do not change other Go services, including:

- `backend/file-watcher`
- `backend/scan-control-plane`

## Design

The backend/core module declaration should move from `go 1.24.0` to `go 1.25.11`.

The backend/core Docker build image should move from `golang:1.24.6` to `golang:1.25.11`, preserving the existing `DOCKER_MIRROR` argument and build flow.

The backend/core test module should also declare `go 1.25.11` so local test metadata matches the module under test.

The CI job that runs backend/core tests should use Go 1.25.11. The lint job currently runs `make lint`, and the Makefile includes `backend/core` in `GO_DIRS`, so the lint job's Go setup should also use Go 1.25.11 to avoid a lint/test toolchain split for backend/core.

The `core-dev` service in `docker-compose.yml` should move from `golang:1.24-alpine` to `golang:1.25.11-alpine` so the local development container matches the requested backend/core version.

## Validation

After implementation, verify the change with:

- A repository search confirming no backend/core-related Go 1.24 references remain.
- `cd tests/backend/core && go test ./... -v`

If the local environment lacks Go 1.25.11 and the Go command cannot download the requested toolchain, report that clearly with the command output.

## Risks

The main risk is local or CI environment availability of Go 1.25.11 images and toolchains. This is mitigated by pinning exact versions in Docker, CI, and Go module files and by running the backend/core test module after the edit.

No application logic changes are expected.
