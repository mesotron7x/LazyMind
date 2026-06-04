param(
    [string]$ToolchainRoot = (Join-Path $env:USERPROFILE ".lazymind\toolchains"),
    [string]$NodeMajor = "24",
    [string]$PnpmMajor = "10",
    [string]$MinimumGoVersion = "1.25.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:PreferredCommandPaths = @{}
$script:PreferredNodePath = $null
$script:PreferredPnpmScript = $null

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

function Get-CommandPath {
    param([string]$Name)
    $key = $Name.ToLowerInvariant()
    if ($script:PreferredCommandPaths.ContainsKey($key)) {
        $preferredPath = $script:PreferredCommandPaths[$key]
        if ($preferredPath -and (Test-Path $preferredPath)) {
            return $preferredPath
        }
    }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

function Set-PreferredCommandPath {
    param(
        [string]$Name,
        [string]$Path
    )
    if ($Path -and (Test-Path $Path)) {
        $script:PreferredCommandPaths[$Name.ToLowerInvariant()] = $Path
    }
}

function Invoke-Version {
    param(
        [string]$Name,
        [string[]]$ArgumentList
    )
    if (
        $Name -ieq "pnpm" -and
        $script:PreferredNodePath -and
        $script:PreferredPnpmScript -and
        (Test-Path $script:PreferredNodePath) -and
        (Test-Path $script:PreferredPnpmScript)
    ) {
        try {
            return (& $script:PreferredNodePath $script:PreferredPnpmScript @ArgumentList 2>$null | Select-Object -First 1)
        }
        catch {
            return $null
        }
    }
    $path = Get-CommandPath $Name
    if (-not $path) {
        return $null
    }
    try {
        return (& $path @ArgumentList 2>$null | Select-Object -First 1)
    }
    catch {
        return $null
    }
}

function Write-ToolStatus {
    param(
        [string]$Name,
        [string[]]$VersionArgs = @("--version")
    )
    $path = Get-CommandPath $Name
    if (-not $path) {
        Write-Host ("{0,-8} MISSING" -f $Name)
        return $false
    }
    $version = Invoke-Version -Name $Name -ArgumentList $VersionArgs
    if ($version) {
        Write-Host ("{0,-8} OK      {1}  ({2})" -f $Name, $version, $path)
    }
    else {
        Write-Host ("{0,-8} FOUND   version unavailable  ({1})" -f $Name, $path)
    }
    return $true
}

function Test-NodeVersion {
    $version = Invoke-Version -Name "node" -ArgumentList @("--version")
    if (-not $version -or $version -notmatch "^v(\d+)\.(\d+)\.(\d+)") {
        return $false
    }
    return ([int]$Matches[1] -eq [int]$NodeMajor)
}

function Test-PnpmVersion {
    $version = Invoke-Version -Name "pnpm" -ArgumentList @("--version")
    if (-not $version -or $version -notmatch "^(\d+)\.") {
        return $false
    }
    return ([int]$Matches[1] -eq [int]$PnpmMajor)
}

function Test-GoVersion {
    $version = Invoke-Version -Name "go" -ArgumentList @("version")
    if (-not $version -or $version -notmatch "go(\d+)\.(\d+)(?:\.(\d+))?") {
        return $false
    }
    $patch = 0
    if ($Matches.ContainsKey(3) -and $Matches[3]) {
        $patch = [int]$Matches[3]
    }
    $actual = [Version]::new([int]$Matches[1], [int]$Matches[2], $patch)
    $minimum = [Version]::Parse($MinimumGoVersion)
    return ($actual -ge $minimum)
}

$isWindowsPlatform = ($env:OS -eq "Windows_NT")
$isWindowsVariable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
if ($isWindowsVariable) {
    $isWindowsPlatform = [bool]$isWindowsVariable.Value
}
if (-not $isWindowsPlatform) {
    throw "This checker only supports Windows."
}

$scoopShims = Join-Path $env:USERPROFILE "scoop\shims"
$scoopGitUsrBin = Join-Path $env:USERPROFILE "scoop\apps\git\current\usr\bin"
$nodeDirs = Get-ChildItem -Path $ToolchainRoot -Directory -Filter "node-v*-win-x64" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { $_.FullName }
$goDirs = Get-ChildItem -Path $ToolchainRoot -Directory -Filter "go*" -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "bin\go.exe") } |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" }
$npmGlobalPrefix = Join-Path $ToolchainRoot "npm-global"

Add-PathForCurrentProcess @($scoopShims, $scoopGitUsrBin)
Add-PathForCurrentProcess @($nodeDirs + $goDirs + @($npmGlobalPrefix))

$preferredNodeDir = $nodeDirs | Select-Object -First 1
if ($preferredNodeDir) {
    $script:PreferredNodePath = Join-Path $preferredNodeDir "node.exe"
    Set-PreferredCommandPath "node" $script:PreferredNodePath
    Set-PreferredCommandPath "npm" (Join-Path $preferredNodeDir "npm.cmd")
}
$preferredGoDir = $goDirs | Select-Object -First 1
if ($preferredGoDir) {
    Set-PreferredCommandPath "go" (Join-Path $preferredGoDir "go.exe")
}
Set-PreferredCommandPath "pnpm" (Join-Path $npmGlobalPrefix "pnpm.cmd")
$script:PreferredPnpmScript = Join-Path $npmGlobalPrefix "node_modules\pnpm\bin\pnpm.cjs"

$ok = $true
$ok = (Write-ToolStatus "git") -and $ok
$ok = (Write-ToolStatus "bash") -and $ok
$ok = (Write-ToolStatus "sed") -and $ok
$ok = (Write-ToolStatus "make") -and $ok
$ok = (Write-ToolStatus "node") -and $ok
$ok = (Write-ToolStatus "npm") -and $ok
$ok = (Write-ToolStatus "pnpm") -and $ok
$ok = (Write-ToolStatus "go" @("version")) -and $ok

if (-not (Test-NodeVersion)) {
    Write-Host "node     INVALID expected Node.js $NodeMajor.x"
    $ok = $false
}
if (-not (Test-PnpmVersion)) {
    Write-Host "pnpm     INVALID expected pnpm $PnpmMajor.x"
    $ok = $false
}
if (-not (Test-GoVersion)) {
    Write-Host "go       INVALID expected Go >= $MinimumGoVersion"
    $ok = $false
}

if (-not $ok) {
    Write-Host ""
    Write-Host "Run scripts/windows/install-build-tools.ps1, then open a new terminal and check again."
    exit 1
}

Write-Host ""
Write-Host "Windows desktop build tools look ready."
