# Hermetic Host Test Target Design

## Goal

Add a new Make target, `test-hermetic`, that runs the same test scope as the existing `make test` target while using a project-specific, reproducible host-side test environment.

The existing `make test` behavior remains unchanged for backward compatibility. It continues to depend on whatever Python, Node/npm, and Go tools are available on the host.

## Scope

`make test-hermetic` covers only the test segments currently reachable from `make test` through `tests/run-all.sh`:

- frontend tests in `tests/frontend`
- auth-service Python tests in `tests/backend/auth-service`
- backend/core Go tests in `tests/backend/core`
- algorithm Python tests in `tests/algorithm`

The new target does not include CI-only test jobs such as `tests/doc_check`, `tests/evo`, or `tests/test_cli.py`.

The design does not add Docker, Compose, devcontainer, or any other containerized strong-consistency test environment.

## Existing Findings

The repository currently has a multi-stack test surface:

- Python 3.11 is used by CI for auth-service, algorithm, evo, and doc checks.
- Node 20 is used by CI for frontend tests.
- Go 1.24.0 is declared in `backend/core/go.mod`, `tests/backend/core/go.mod`, and CI.
- `make test` calls `tests/run-all.sh`.
- `tests/run-all.sh` currently skips a segment if its host tool is missing.
- `tests/frontend` has its own `package-lock.json` and uses npm.
- `frontend/package.json` uses `pnpm@10.0.0`, but the current `make test` scope does not run frontend package build or lint tasks from `frontend/`.
- Python test dependencies are spread across `backend/auth-service/requirements.txt`, `tests/backend/auth-service/requirements-test.txt`, `algorithm/requirements.txt`, and `algorithm/lazyllm/pyproject.toml`.

## User-Facing Commands

Add the following target:

```text
make test-hermetic
```

The target performs environment validation, prepares the project-specific test environment, then runs the original `make test` scope with controlled commands.

Optional helper targets may be added if they keep the interface clear:

```text
make test-hermetic-setup
make test-hermetic-check
```

These helpers are implementation conveniences, not replacements for `make test-hermetic`.

## Compatibility Rules

`make test` must remain compatible with its current behavior:

- It continues to call the existing test runner.
- It continues to use host tools directly.
- It must not start depending on `uv`, `fnm`, or a project-managed virtual environment.
- Any stricter behavior belongs to `make test-hermetic`.

`make test-hermetic` is allowed to be stricter:

- If `uv` is missing, fail with a clear message.
- If Python 3.11 cannot be selected through `uv`, fail with a clear message.
- If neither `fnm` nor `nvm` is available, fail with a clear message.
- If `go` is missing, fail with a clear message.
- If Go is not `1.24.0`, fail with a clear message.
- If Node 20 cannot be selected through `fnm` or `nvm`, fail with a clear message.
- If Python dependencies are out of sync with the managed environment, recreate or resync them before running tests.

## Environment Design

Python is managed with `uv` in a repository-local virtual environment. The target requires Python 3.11 because that is the version currently used by CI for the relevant Python test jobs. The recommended default path is:

```text
.venv-test
```

The environment should be ignored by git. A developer may override the path through an environment variable such as:

```text
LAZYMIND_TEST_VENV
```

Node is selected from the host through either `fnm` or `nvm`. The target requires Node 20 because that is the version currently used by CI for the frontend test job. The implementation should prefer `fnm` when both managers are present, then fall back to `nvm`.

Go is selected from the host. The target requires Go 1.24.0 to match both Go module declarations and the current CI setup.

## Dependency Strategy

Python dependencies should be installed only into the project-specific test virtual environment. They must not be installed into the system interpreter or a developer's unrelated virtual environment.

The implementation should use a repo-owned Python test requirements input that aggregates only the dependencies needed by the `make test` scope. A lock file is preferred when practical, but the first implementation may start with a deterministic setup script if dependency resolution across `algorithm/lazyllm` proves too expensive or platform-sensitive.

Frontend test dependencies should be installed from `tests/frontend/package-lock.json` using `npm ci`, not `npm install`, inside the `tests/frontend` workspace.

Go tests should run from `tests/backend/core` using the existing Go module and `go.sum`. The target should avoid mutating module files during normal test execution.

## Test Runner Design

The existing `tests/run-all.sh` should remain usable by `make test`.

For `make test-hermetic`, prefer either:

- a new runner script that executes the same four segments with explicit tool paths; or
- a wrapper that exports controlled `PYTHON`, `PATH`, and Node manager state before calling the existing runner.

The implementation must avoid changing `make test` semantics. If the existing runner needs improvements that would change behavior, put those improvements behind `test-hermetic` instead.

## Error Handling

Failures should be immediate and actionable:

- missing `uv`: tell the developer to install `uv`
- missing `fnm` or `nvm`: tell the developer to install one of them
- unavailable Node 20: tell the developer to install Node 20 through the available manager
- wrong Go version: show the detected version and required version
- Python dependency sync failure: point to the setup step or rerun `make test-hermetic`
- test failure: preserve the underlying test command output and exit non-zero

The target should not silently skip test segments.

## Documentation

Update developer-facing docs to explain:

- `make test` remains the legacy host-environment test command.
- `make test-hermetic` is the recommended reproducible host-side test command for the existing quick test scope.
- Required host tools are `uv`, `fnm` or `nvm`, and Go 1.24.0.
- No containerized test environment is provided by this design.

## Non-Goals

- Do not add Docker-based test images or container targets.
- Do not expand test scope beyond the current `make test` coverage.
- Do not change CI test jobs.
- Do not require `make test` users to install `uv`, `fnm`, or `nvm`.
- Do not install dependencies globally on the host.

## Acceptance Criteria

- `make test` remains available and compatible with the current host-dependent behavior.
- `make test-hermetic` fails fast if `uv`, `fnm` or `nvm`, or Go are unavailable.
- `make test-hermetic` creates the Python test environment with Python 3.11.
- `make test-hermetic` creates or syncs a repo-local Python test virtual environment.
- `make test-hermetic` selects Node 20 through `fnm` or `nvm`.
- `make test-hermetic` requires Go 1.24.0.
- `make test-hermetic` runs exactly the same four test segments as the original `make test` scope.
- `make test-hermetic` does not use Docker or include CI-only test jobs.
