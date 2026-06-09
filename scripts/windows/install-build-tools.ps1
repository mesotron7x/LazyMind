param(
    [string]$NodeVersion = "24.16.0",
    [string]$GoVersion = "1.25.10",
    [string]$PnpmVersion = "10.0.0",
    [string]$UvVersion = "0.11.18",
    [string]$ToolchainRoot = (Join-Path $env:USERPROFILE ".lazymind\toolchains"),
    [switch]$ForcePinnedNode,
    [switch]$ForcePinnedGo,
    [switch]$SkipScoopBootstrap
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Windows {
    $isWindowsPlatform = ($env:OS -eq "Windows_NT")
    $isWindowsVariable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
    if ($isWindowsVariable) {
        $isWindowsPlatform = [bool]$isWindowsVariable.Value
    }
    if (-not $isWindowsPlatform) {
        throw "This installer only supports Windows."
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Get-CommandPath {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

function Add-PathForCurrentProcess {
    param([string[]]$Entries)
    $existing = @()
    if ($env:Path) {
        $existing = $env:Path -split ";"
    }
    $prepend = @()
    foreach ($entry in $Entries) {
        if ([string]::IsNullOrWhiteSpace($entry) -or -not (Test-Path $entry)) {
            continue
        }
        $alreadyPresent = $false
        foreach ($item in $existing) {
            if ($item -and ($item.TrimEnd("\") -ieq $entry.TrimEnd("\"))) {
                $alreadyPresent = $true
                break
            }
        }
        if (-not $alreadyPresent) {
            $prepend += $entry
        }
    }
    if ($prepend.Count -gt 0) {
        $env:Path = (($prepend + $existing) -join ";")
    }
}

function Add-UserPath {
    param([string[]]$Entries)
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @()
    if ($userPath) {
        $parts = $userPath -split ";"
    }

    $changed = $false
    foreach ($entry in $Entries) {
        if ([string]::IsNullOrWhiteSpace($entry) -or -not (Test-Path $entry)) {
            continue
        }
        $alreadyPresent = $false
        foreach ($part in $parts) {
            if ($part -and ($part.TrimEnd("\") -ieq $entry.TrimEnd("\"))) {
                $alreadyPresent = $true
                break
            }
        }
        if (-not $alreadyPresent) {
            $parts += $entry
            $changed = $true
        }
    }

    if ($changed) {
        [Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")
    }
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

function Get-ScoopCmd {
    $cmd = Get-Command scoop.cmd -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    $defaultPath = Join-Path $env:USERPROFILE "scoop\shims\scoop.cmd"
    if (Test-Path $defaultPath) {
        return $defaultPath
    }
    return $null
}

function Ensure-Scoop {
    $scoopCmd = Get-ScoopCmd
    if ($scoopCmd) {
        return $scoopCmd
    }

    if ($SkipScoopBootstrap) {
        throw "Scoop is not installed and -SkipScoopBootstrap was set."
    }

    Write-Step "Installing Scoop"
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Invoke-Expression (Invoke-RestMethod -Uri "https://get.scoop.sh")

    $scoopCmd = Get-ScoopCmd
    if (-not $scoopCmd) {
        throw "Scoop installation completed, but scoop.cmd was not found. Open a new terminal and try again."
    }
    return $scoopCmd
}

function Ensure-ScoopPackages {
    param([string]$ScoopCmd)
    $packages = @("git", "make", "grep", "coreutils", "7zip")
    Write-Step "Installing Scoop packages: $($packages -join ', ')"
    foreach ($pkg in $packages) {
        & $ScoopCmd install $pkg
        if ($LASTEXITCODE -ne 0) {
            Write-Host "scoop install $pkg exited with $LASTEXITCODE; trying scoop update $pkg"
            & $ScoopCmd update $pkg
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install or update Scoop package: $pkg"
            }
        }
    }
}

function Test-NodeUsable {
    if ($ForcePinnedNode) {
        return $false
    }
    $node = Get-CommandPath "node"
    $npm = Get-CommandPath "npm"
    if (-not $node -or -not $npm) {
        return $false
    }
    try {
        $versionText = (& $node --version 2>$null)
        if ($versionText -match "^v(\d+)\.(\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            return ($major -ge 24 -and $major -lt 25)
        }
    }
    catch {
        return $false
    }
    return $false
}

function Ensure-Node {
    $nodeDirName = "node-v$NodeVersion-win-x64"
    $nodeDir = Join-Path $ToolchainRoot $nodeDirName
    if (Test-NodeUsable) {
        Write-Step "Using existing Node.js"
        node --version
        npm --version
        return $null
    }

    if (Test-Path (Join-Path $nodeDir "node.exe")) {
        Write-Step "Using pinned Node.js at $nodeDir"
    }
    else {
        Write-Step "Installing Node.js $NodeVersion"
        New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null
        $zipPath = Join-Path $ToolchainRoot "$nodeDirName.zip"
        $url = "https://nodejs.org/dist/v$NodeVersion/$nodeDirName.zip"
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        Expand-Archive -LiteralPath $zipPath -DestinationPath $ToolchainRoot -Force
        Remove-Item -LiteralPath $zipPath -Force
    }
    Add-PathForCurrentProcess @($nodeDir)
    return $nodeDir
}

function Test-GoUsable {
    if ($ForcePinnedGo) {
        return $false
    }
    $go = Get-CommandPath "go"
    if (-not $go) {
        return $false
    }
    try {
        $versionText = (& $go version 2>$null)
        if ($versionText -match "go(\d+)\.(\d+)(?:\.(\d+))?") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            return ($major -gt 1 -or ($major -eq 1 -and $minor -ge 25))
        }
    }
    catch {
        return $false
    }
    return $false
}

function Ensure-Go {
    $goDir = Join-Path $ToolchainRoot "go$GoVersion"
    $goBin = Join-Path $goDir "bin"
    if (Test-GoUsable) {
        Write-Step "Using existing Go"
        go version
        return $null
    }

    if (Test-Path (Join-Path $goBin "go.exe")) {
        Write-Step "Using pinned Go at $goDir"
    }
    else {
        Write-Step "Installing Go $GoVersion"
        New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null
        $zipPath = Join-Path $ToolchainRoot "go$GoVersion.windows-amd64.zip"
        $tempDir = Join-Path $ToolchainRoot "go-extract-$([Guid]::NewGuid().ToString('N'))"
        $url = "https://go.dev/dl/go$GoVersion.windows-amd64.zip"
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        Expand-Archive -LiteralPath $zipPath -DestinationPath $tempDir -Force
        Move-Item -LiteralPath (Join-Path $tempDir "go") -Destination $goDir
        Remove-Item -LiteralPath $zipPath -Force
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
    Add-PathForCurrentProcess @($goBin)
    return $goBin
}

function Ensure-Pnpm {
    param([string]$NpmGlobalPrefix)
    Write-Step "Installing pnpm $PnpmVersion"
    $corepack = Get-CommandPath "corepack"
    if ($corepack) {
        try {
            Invoke-External $corepack @("enable")
            Invoke-External $corepack @("prepare", "pnpm@$PnpmVersion", "--activate")
            return $null
        }
        catch {
            Write-Host "Corepack setup failed: $($_.Exception.Message)"
        }
    }

    $npm = Get-CommandPath "npm"
    if (-not $npm) {
        throw "npm is required to install pnpm, but npm was not found."
    }
    New-Item -ItemType Directory -Force -Path $NpmGlobalPrefix | Out-Null
    Invoke-External $npm @("install", "-g", "pnpm@$PnpmVersion", "--prefix", $NpmGlobalPrefix)
    Add-PathForCurrentProcess @($NpmGlobalPrefix)
    return $NpmGlobalPrefix
}

function Test-UvUsable {
    $uv = Get-CommandPath "uv"
    if (-not $uv) {
        return $false
    }
    try {
        $versionText = (& $uv --version 2>$null)
        if ($versionText -match "^uv\s+([0-9]+\.[0-9]+\.[0-9]+)") {
            return ($Matches[1].Trim() -eq $UvVersion)
        }
    }
    catch {
        return $false
    }
    return $false
}

function Ensure-Uv {
    $uvDir = Join-Path $ToolchainRoot "uv-$UvVersion"
    $uvExe = Join-Path $uvDir "uv.exe"
    if (Test-UvUsable) {
        Write-Step "Using existing uv"
        uv --version
        return $null
    }

    if (Test-Path $uvExe) {
        Write-Step "Using pinned uv at $uvDir"
    }
    else {
        Write-Step "Installing uv $UvVersion"
        New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null
        $zipPath = Join-Path $ToolchainRoot "uv-$UvVersion-x86_64-pc-windows-msvc.zip"
        $extractDir = Join-Path $ToolchainRoot "uv-extract-$([Guid]::NewGuid().ToString('N'))"
        $url = "https://github.com/astral-sh/uv/releases/download/$UvVersion/uv-x86_64-pc-windows-msvc.zip"
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
        New-Item -ItemType Directory -Force -Path $uvDir | Out-Null
        Move-Item -LiteralPath (Join-Path $extractDir "uv.exe") -Destination $uvExe -Force
        Move-Item -LiteralPath (Join-Path $extractDir "uvx.exe") -Destination (Join-Path $uvDir "uvx.exe") -Force
        Remove-Item -LiteralPath $zipPath -Force
        Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    Add-PathForCurrentProcess @($uvDir)
    return $uvDir
}

Assert-Windows

$scoopShims = Join-Path $env:USERPROFILE "scoop\shims"
$scoopGitUsrBin = Join-Path $env:USERPROFILE "scoop\apps\git\current\usr\bin"
$npmGlobalPrefix = Join-Path $ToolchainRoot "npm-global"

Add-PathForCurrentProcess @($scoopShims, $scoopGitUsrBin)

$scoopCmd = Ensure-Scoop
Ensure-ScoopPackages -ScoopCmd $scoopCmd

Add-PathForCurrentProcess @($scoopShims, $scoopGitUsrBin)
$nodePath = Ensure-Node
$goPath = Ensure-Go
$pnpmPath = Ensure-Pnpm -NpmGlobalPrefix $npmGlobalPrefix
$uvPath = Ensure-Uv

$persistEntries = @($scoopShims, $scoopGitUsrBin)
if ($nodePath) {
    $persistEntries += $nodePath
}
if ($goPath) {
    $persistEntries += $goPath
}
if ($pnpmPath) {
    $persistEntries += $pnpmPath
}
if ($uvPath) {
    $persistEntries += $uvPath
}
Add-UserPath -Entries $persistEntries

Write-Step "Build tools installation complete"
Write-Host "Open a new terminal, then run:"
Write-Host "  make windows-build-tools-check"
Write-Host "  make windows-desktop LAZYMIND_OUTPUT_DIR=C:/Users/$env:USERNAME/LazyMind"
