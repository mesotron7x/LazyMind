# Codex Environments

This directory keeps the shareable setup material for the LazyMind Codex environments.

`manifest.json` records the intended default environment and the two configured environment names.

## lazymind-cloud

Use `lazymind-cloud` as the default Codex cloud environment in Codex settings.

Setup script:

```bash
.codex/environments/lazymind-cloud/setup.sh
```

Maintenance script:

```bash
.codex/environments/lazymind-cloud/maintenance.sh
```

Recommended package versions:

- Node.js 24 LTS
- pnpm 10
- Python 3.11+
- Go 1.25+

## lazymind-windows-desktop

Use `lazymind-windows-desktop` for local Windows desktop work in the Codex app.

Setup script:

```powershell
.codex/environments/lazymind-windows-desktop/setup.windows.ps1
```

Debug action:

```powershell
.codex/environments/lazymind-windows-desktop/debug.windows.ps1
```

The debug action runs:

```powershell
make windows-desktop
& "$HOME/LazyMind/LazyMind.exe"
```

The adjacent `local-environment.json` records the intended Codex app local environment/action shape for this project.
