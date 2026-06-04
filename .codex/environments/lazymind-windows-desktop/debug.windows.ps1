$ErrorActionPreference = "Stop"

# Debug action for "lazymind-windows-desktop".
# Build the self-contained Windows runtime, then launch the app from the user's home directory.

$outputDir = Join-Path $HOME "LazyMind"
make windows-desktop LAZYMIND_OUTPUT_DIR="$($outputDir -replace '\\', '/')"

$exe = Join-Path $outputDir "LazyMind.exe"
if (!(Test-Path -LiteralPath $exe)) {
    throw "LazyMind.exe was not found at $exe"
}

& $exe
