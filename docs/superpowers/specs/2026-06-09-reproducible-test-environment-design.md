# Reproducible Test Environment Design

## Context

`make test` currently delegates directly to `tests/run-all.sh`. The runner resolves `npm`, `python3`, and `go` from the developer's current host `PATH`, so test results can vary across machines.

CI already provides clearer version boundaries:

- Python 3.11 for lint, auth-service tests, evo/CLI tests, and algorithm tests.
- Node 20 for frontend tests.
- Go 1.25.11 for backend/core tests.

The repository also already has useful lock inputs: `tests/frontend/package-lock.json`, Go `go.sum` files, and several Python requirements files. The missing piece is a local and container workflow that consistently consumes those inputs.

## Goals

- Keep daily local testing fast and explicit.
- Avoid hidden Python, system, and toolchain installation during `make test`.
- Provide a fully reproducible container test path for CI and release checks.
- Use one Python test lock file for local and container runs.
- Align local test expectations with CI tool versions.

## Non-Goals

- Do not replace the existing production Docker build.
- Do not merge service runtime images with the test image.
- Do not make `make test` install system packages, Node, Go, or Python dependencies implicitly.
- Keep frontend dependency installation deterministic with `npm ci` from the committed lockfile.
- Do not split Python locks by service unless the unified lock becomes unworkable.

## Proposed Approach

Use a dual-track test workflow:

- `make test-setup` explicitly prepares the local Python test environment.
- `make test` checks that the local environment is ready, then runs tests.
- `make test-container` builds and runs a dedicated test Docker image for reproducible verification.

This keeps the default developer path lightweight while providing a stricter container path for CI and release confidence.

## Local Test Flow

`make test` should remain the daily entry point, but it should fail early when the environment is not prepared.

Expected behavior:

- Verify `uv` is available.
- Verify `.venv` exists and uses Python 3.11.
- Verify Python packages are synced from the committed test lock file.
- Verify Node is version 20.
- Verify npm is available.
- Verify Go is version 1.25.11.
- Run `tests/run-all.sh` only after checks pass.

If a check fails, the output should explain the fix, for example:

- `Python test venv missing: run make test-setup`
- `Python dependencies out of sync: run make test-setup`
- `Node 18 found, Node 20 required for local test parity`
- `Go 1.24 found, Go 1.25.11 required for backend/core tests`

`make test` must not install Python packages, Go tools, Node, or system packages. The frontend segment may run `npm ci` because it is an explicit, lockfile-driven part of the test command.

## Local Setup Flow

`make test-setup` is the explicit local environment preparation command.

Expected behavior:

- Create `.venv` with Python 3.11 using `uv`.
- Install Python dependencies with `uv pip sync requirements/test-lock.txt`.
- Leave Node and Go installation to the developer's toolchain manager.
- Print the expected Node and Go versions after Python setup completes.

This keeps dependency installation intentional and avoids surprising developers when they only wanted to run tests.

## Python Dependency Locking

Add a unified Python test dependency input and lock:

- `requirements/test.in`
- `requirements/test-lock.txt`

`requirements/test.in` should reference the existing requirement sources needed by the current test suite:

- `backend/auth-service/requirements.txt`
- `tests/backend/auth-service/requirements-test.txt`
- `algorithm/lazyllm/requirements.txt`
- `algorithm/requirements.txt`

It should also include explicit test and compatibility constraints already reflected by CI where needed, such as:

- `pytest`
- `pytest-asyncio`
- `httpx<0.28`
- `anyio<4.5`

`requirements/test-lock.txt` should be generated with `uv pip compile` targeting Python 3.11 and committed. Both local setup and the container image should consume this same lock file.

If the unified lock later becomes hard to maintain because auth-service and algorithm require incompatible dependencies, split the lock by test segment as a follow-up change.

## Frontend Dependency Handling

Frontend tests should use the existing `tests/frontend/package-lock.json`.

`tests/run-all.sh` should run `npm ci` instead of `npm install` inside `tests/frontend`, then run `npm test`.

This makes frontend dependency resolution deterministic and avoids lockfile drift during test runs.

## Go Dependency Handling

Backend/core tests should continue to use `tests/backend/core/go.mod` and `tests/backend/core/go.sum`.

The local runner should check for Go 1.25.11. The container image should install Go 1.25.11 directly.

The normal test path should not run `go mod tidy`, because that can modify tracked files. A separate maintenance target can be added later if the project wants an explicit dependency-refresh command.

## Test Runner Responsibilities

`tests/run-all.sh` should remain the segmented runner for:

- Frontend tests.
- Auth-service Python tests.
- Backend/core Go tests.
- Algorithm Python tests.

It should use controlled commands passed from the environment where useful:

- Python should come from `.venv/bin/python` locally or the container's Python environment.
- Frontend should use `npm ci`.
- Go should use the active Go binary after preflight checks.

The script should focus on running tests and aggregating failures. Environment preparation belongs in `make test-setup`, and environment validation belongs in a small helper script or Make target.

## Container Test Flow

Add a dedicated test image under `tests/docker/`.

The test image should:

- Use a stable Linux base.
- Install Python 3.11.
- Install Node 20.
- Install Go 1.25.11.
- Install system build dependencies needed for Python and Go native extensions, such as `build-essential`, `cmake`, and `pkg-config`.
- Install Python dependencies from `requirements/test-lock.txt`.
- Use `npm ci` for frontend dependencies during the test run.
- Use Go modules from the checked-in module files.

`make test-container` should build the image and run the full test suite inside it. The container path is the recommended pre-merge, CI, and release verification path.

## Error Handling

Preflight failures should be short and actionable. The runner should report all obvious missing tools where practical, but it should avoid long diagnostic output.

Test failures should preserve the existing segmented output structure so it remains easy to see whether frontend, auth-service, backend/core, or algorithm failed.

The container command should clearly distinguish image build failures from test failures.

## Verification Strategy

Implementation should be verified by:

- Running the local preflight with a missing or unsynced `.venv` and confirming it fails with the expected message.
- Running `make test-setup` and confirming `.venv` is created and synced from `requirements/test-lock.txt`.
- Running `make test` from the prepared environment.
- Running `make test-container`.
- Confirming `npm ci` does not modify `tests/frontend/package-lock.json`.
- Confirming Go tests do not modify `go.mod` or `go.sum`.

## Open Decisions

No unresolved product decisions remain for the initial implementation. The design intentionally starts with one Python lock file and one dedicated test container image.
