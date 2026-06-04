param(
    [string]$SourcePath,
    [string]$OutputDir
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
if (-not $SourcePath) {
    $SourcePath = Join-Path $repoRoot "frontend/src/public/Lazy.png"
}
if (-not $OutputDir) {
    $OutputDir = Join-Path $repoRoot "desktop/windows/resources/icons"
}

$source = Resolve-Path $SourcePath
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-SquarePngBytes {
    param(
        [Parameter(Mandatory = $true)][string]$InputPath,
        [Parameter(Mandatory = $true)][int]$Size
    )

    $sourceImage = [System.Drawing.Image]::FromFile($InputPath)
    try {
        $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

                $paddingScale = 0.9
                $scale = [Math]::Min($Size / $sourceImage.Width, $Size / $sourceImage.Height) * $paddingScale
                $width = [int][Math]::Round($sourceImage.Width * $scale)
                $height = [int][Math]::Round($sourceImage.Height * $scale)
                $x = [int][Math]::Round(($Size - $width) / 2)
                $y = [int][Math]::Round(($Size - $height) / 2)
                $dest = New-Object System.Drawing.Rectangle $x, $y, $width, $height
                $graphics.DrawImage($sourceImage, $dest)
            }
            finally {
                if ($graphics) { $graphics.Dispose() }
            }

            $stream = New-Object System.IO.MemoryStream
            try {
                $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
                return $stream.ToArray()
            }
            finally {
                $stream.Dispose()
            }
        }
        finally {
            if ($bitmap) { $bitmap.Dispose() }
        }
    }
    finally {
        $sourceImage.Dispose()
    }
}

function Write-Ico {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int[]]$Sizes
    )

    $images = @()
    foreach ($size in $Sizes) {
        $images += ,@{
            Size = $size
            Bytes = New-SquarePngBytes -InputPath $source -Size $size
        }
    }

    $fileStream = [System.IO.File]::Create($Path)
    try {
        $writer = New-Object System.IO.BinaryWriter $fileStream
        try {
            $writer.Write([UInt16]0)
            $writer.Write([UInt16]1)
            $writer.Write([UInt16]$images.Count)

            $offset = 6 + (16 * $images.Count)
            foreach ($image in $images) {
                $sizeByte = if ($image.Size -eq 256) { 0 } else { [byte]$image.Size }
                $writer.Write([byte]$sizeByte)
                $writer.Write([byte]$sizeByte)
                $writer.Write([byte]0)
                $writer.Write([byte]0)
                $writer.Write([UInt16]1)
                $writer.Write([UInt16]32)
                $writer.Write([UInt32]$image.Bytes.Length)
                $writer.Write([UInt32]$offset)
                $offset += $image.Bytes.Length
            }

            foreach ($image in $images) {
                $writer.Write([byte[]]$image.Bytes)
            }
        }
        finally {
            if ($writer) { $writer.Dispose() }
        }
    }
    finally {
        if ($fileStream) { $fileStream.Dispose() }
    }
}

$iconPngPath = Join-Path $OutputDir "icon.png"
$iconIcoPath = Join-Path $OutputDir "icon.ico"

[System.IO.File]::WriteAllBytes($iconPngPath, (New-SquarePngBytes -InputPath $source -Size 256))
Write-Ico -Path $iconIcoPath -Sizes @(16, 32, 48, 256)

Write-Host "Generated desktop icons:"
Write-Host "  $iconPngPath"
Write-Host "  $iconIcoPath"
