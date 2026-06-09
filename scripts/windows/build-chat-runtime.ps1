param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
    [string]$OutputDir = (Join-Path $env:USERPROFILE "LazyMind"),
    [string]$PythonVersion = "3.11.9",
    [string]$ToolchainRoot = (Join-Path $env:USERPROFILE ".lazymind\toolchains"),
    [string]$UvPath = "",
    [string]$UvCacheDir = "",
    [string]$UvPythonInstallDir = "",
    [string]$UvLinkMode = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-UvPath {
    if ($UvPath -and (Test-Path $UvPath)) {
        return (Resolve-Path $UvPath).Path
    }

    $cmd = Get-Command uv -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $uv = Get-ChildItem -Path $ToolchainRoot -Directory -Filter "uv-*" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName "uv.exe" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if ($uv) {
        return $uv
    }

    throw "uv was not found. Run scripts/windows/install-build-tools.ps1, then retry."
}

function Invoke-External {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @()
    )
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

function Assert-ChildPath {
    param(
        [string]$Parent,
        [string]$Child
    )
    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\', '/')
    $childFull = [System.IO.Path]::GetFullPath($Child).TrimEnd('\', '/')
    if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside output directory: $childFull"
    }
}

function Copy-PackageTree {
    param(
        [string]$Source,
        [string]$Destination
    )
    if (-not (Test-Path $Source)) {
        throw "Source directory not found: $Source"
    }
    if (Test-Path $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    robocopy $Source $Destination /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "robocopy failed ($LASTEXITCODE): $Source -> $Destination"
    }
}

function New-FilteredAlgorithmRequirements {
    param(
        [string]$Source,
        [string]$Destination
    )
    $lines = Get-Content -LiteralPath $Source
    $filtered = foreach ($line in $lines) {
        if ($line -match '^\s*milvus-lite(\s|=|<|>|~|!|$)') {
            "# Windows desktop chat runtime excludes Linux/macOS-only dependency: $line"
        }
        else {
            $line
        }
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
    Set-Content -LiteralPath $Destination -Value $filtered -Encoding UTF8
}

function Get-UserProfilePath {
    if ($env:USERPROFILE) {
        return $env:USERPROFILE
    }

    $profile = [Environment]::GetFolderPath("UserProfile")
    if ($profile) {
        return $profile
    }

    throw "Unable to resolve user profile path for uv cache directories."
}

function Resolve-OptionalPath {
    param(
        [string]$Value,
        [string]$Default
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return [System.IO.Path]::GetFullPath($Default)
    }

    return [System.IO.Path]::GetFullPath($Value)
}

function Resolve-UvLinkMode {
    param(
        [string]$Value
    )

    $mode = $Value
    if ([string]::IsNullOrWhiteSpace($mode)) {
        $mode = $env:LAZYMIND_UV_LINK_MODE
    }
    if ([string]::IsNullOrWhiteSpace($mode)) {
        $mode = "hardlink"
    }

    $mode = $mode.Trim().ToLowerInvariant()
    $validModes = @("copy", "hardlink", "clone", "symlink")
    if ($validModes -notcontains $mode) {
        throw "Invalid LAZYMIND_UV_LINK_MODE '$mode'. Expected one of: $($validModes -join ', ')."
    }

    return $mode
}

$repo = (Resolve-Path $RepoRoot).Path
$output = [System.IO.Path]::GetFullPath($OutputDir)
$venvDir = Join-Path $output "python"
$algorithmOut = Join-Path $output "algorithm"
$userStateRoot = Join-Path (Get-UserProfilePath) ".lazymind"
$uvCacheDir = Resolve-OptionalPath -Value $UvCacheDir -Default (Join-Path $userStateRoot "uv-cache")
$uvPythonDir = Resolve-OptionalPath -Value $UvPythonInstallDir -Default (Join-Path $userStateRoot "uv-python")
$uvLinkMode = Resolve-UvLinkMode -Value $UvLinkMode
$requirementsDir = Join-Path $output ".requirements"
$uv = Resolve-UvPath

Assert-ChildPath -Parent $output -Child $venvDir
Assert-ChildPath -Parent $output -Child $algorithmOut
Assert-ChildPath -Parent $output -Child $requirementsDir

Write-Host "Building LazyMind chat runtime"
Write-Host "  Repo:   $repo"
Write-Host "  Output: $output"
Write-Host "  uv:     $uv"
Write-Host "  Python: $PythonVersion"
Write-Host "  uv cache:  $uvCacheDir"
Write-Host "  uv python: $uvPythonDir"
Write-Host "  uv link:   $uvLinkMode"

New-Item -ItemType Directory -Force -Path $output | Out-Null
New-Item -ItemType Directory -Force -Path $uvCacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $uvPythonDir | Out-Null
$env:UV_CACHE_DIR = $uvCacheDir
$env:UV_PYTHON_INSTALL_DIR = $uvPythonDir
$env:UV_PYTHON_INSTALL_BIN = "0"
$env:UV_PYTHON_INSTALL_REGISTRY = "0"
if (Test-Path $venvDir) {
    Remove-Item -LiteralPath $venvDir -Recurse -Force
}
if (Test-Path $algorithmOut) {
    Remove-Item -LiteralPath $algorithmOut -Recurse -Force
}

Invoke-External $uv @("python", "install", "--install-dir", $uvPythonDir, "--no-bin", "--no-registry", $PythonVersion)
Invoke-External $uv @("venv", "--relocatable", "--python", $PythonVersion, $venvDir)

$pythonExe = Join-Path $venvDir "Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Expected venv Python was not created: $pythonExe"
}

$lazyllmReq = Join-Path $repo "algorithm\lazyllm\requirements.txt"
$algorithmReq = Join-Path $repo "algorithm\requirements.txt"
$filteredAlgorithmReq = Join-Path $requirementsDir "algorithm.windows-chat-runtime.requirements.txt"
New-FilteredAlgorithmRequirements -Source $algorithmReq -Destination $filteredAlgorithmReq
Invoke-External $uv @("pip", "install", "--python", $pythonExe, "--link-mode", $uvLinkMode, "-r", $lazyllmReq, "-r", $filteredAlgorithmReq)

New-Item -ItemType Directory -Force -Path $algorithmOut | Out-Null
Copy-PackageTree -Source (Join-Path $repo "algorithm\lazymind") -Destination (Join-Path $algorithmOut "lazymind")
New-Item -ItemType Directory -Force -Path (Join-Path $algorithmOut "lazyllm") | Out-Null
Copy-Item -LiteralPath (Join-Path $repo "algorithm\lazyllm\pyproject.toml") -Destination (Join-Path $algorithmOut "lazyllm\pyproject.toml") -Force
Copy-PackageTree -Source (Join-Path $repo "algorithm\lazyllm\lazyllm") -Destination (Join-Path $algorithmOut "lazyllm\lazyllm")

Get-ChildItem -LiteralPath $algorithmOut -Recurse -Force |
    Where-Object { $_.PSIsContainer -and ($_.Name -eq "__pycache__" -or $_.Name -eq ".pytest_cache") } |
    Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath $algorithmOut -Recurse -Force -File |
    Where-Object { $_.Extension -eq ".pyc" -or $_.Extension -eq ".pyo" } |
    Remove-Item -Force

foreach ($artifact in @(
    $pythonExe,
    (Join-Path $algorithmOut "lazymind\chat\app.py"),
    (Join-Path $algorithmOut "lazyllm\pyproject.toml"),
    (Join-Path $algorithmOut "lazyllm\lazyllm\__init__.py"),
    (Join-Path $algorithmOut "lazymind\common\runtime_models.yaml"),
    (Join-Path $algorithmOut "lazymind\chat\resources\sensitive_words.txt")
)) {
    if (-not (Test-Path $artifact)) {
        throw "Missing chat runtime artifact: $artifact"
    }
}

Write-Host "Chat runtime ready."
