# Windows Desktop uv Cache Design

## Context

`make windows-desktop` removes `LAZYMIND_OUTPUT_DIR` before rebuilding the portable runtime. The chat runtime script currently places uv's package cache and managed Python install directory under that output directory, so every desktop build discards the cache and forces uv to recreate Python and reinstall dependencies from a cold cache.

## Design

Move uv's durable cache state outside the portable output directory and into the user's LazyMind toolchain area:

- uv package cache: `%USERPROFILE%\.lazymind\uv-cache`
- uv managed Python installs: `%USERPROFILE%\.lazymind\uv-python`

The portable runtime still rebuilds `LAZYMIND_OUTPUT_DIR\python` and `LAZYMIND_OUTPUT_DIR\algorithm` on each run, preserving the existing self-contained output behavior.

Dependency materialization uses uv's installer link mode. The default is `hardlink` for fast rebuilds and lower disk use. Users can override it with `LAZYMIND_UV_LINK_MODE=copy|hardlink|clone|symlink`.

## Error Handling

The script validates `LAZYMIND_UV_LINK_MODE` before invoking uv. Unsupported values fail early with a clear message. uv itself remains responsible for reporting platform or filesystem failures for a selected link mode.

## Testing

Use focused verification:

- PowerShell syntax parse for `scripts/windows/build-chat-runtime.ps1`
- Script dry validation by invoking it far enough to print selected cache/link settings when practical
- Full `make windows-desktop` remains the end-to-end verification path when dependencies and time allow
