param(
  [string]$OutputDirectory = "apps/desktop/assets"
)

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$outputPath = Join-Path $OutputDirectory "icon.ico"
$pngPath = Join-Path $OutputDirectory "icon.png"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-IconBitmap {
  param([int]$Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 512.0
  function S([float]$Value) { return [int][Math]::Round($Value * $scale) }
  function Fill-RoundedRectangle {
    param(
      [System.Drawing.Brush]$Brush,
      [int]$X,
      [int]$Y,
      [int]$Width,
      [int]$Height,
      [int]$Radius
    )

    $diameter = [Math]::Max(1, $Radius * 2)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath($Brush, $path)
    $path.Dispose()
  }

  $background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 35, 56))
  $panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 21, 50, 77))
  $bar = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 216, 231, 243))
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 127, 216, 255))
  $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 51, 198, 166)), (S 30)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $axisPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 216, 231, 243)), (S 24)
  $axisPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $axisPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  Fill-RoundedRectangle $background (S 0) (S 0) (S 512) (S 512) (S 112)
  Fill-RoundedRectangle $panel (S 74) (S 74) (S 364) (S 364) (S 82)
  $graphics.DrawLine($axisPen, (S 126), (S 344), (S 386), (S 344))

  $points = @(
    [System.Drawing.Point]::new((S 126), (S 286)),
    [System.Drawing.Point]::new((S 198), (S 238)),
    [System.Drawing.Point]::new((S 258), (S 270)),
    [System.Drawing.Point]::new((S 386), (S 158))
  )
  $graphics.DrawLines($linePen, $points)

  foreach ($rect in @(
    @(126, 346, 36, 62),
    @(204, 316, 36, 92),
    @(282, 276, 36, 132),
    @(360, 232, 36, 176)
  )) {
    Fill-RoundedRectangle $bar (S $rect[0]) (S $rect[1]) (S $rect[2]) (S $rect[3]) (S 14)
  }

  foreach ($point in $points) {
    $radius = S 18
    $graphics.FillEllipse($cyan, $point.X - $radius, $point.Y - $radius, $radius * 2, $radius * 2)
  }

  $graphics.Dispose()
  return $bitmap
}

$pngImages = foreach ($size in $sizes) {
  $bitmap = New-IconBitmap $size
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($size -eq 256) {
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $bitmap.Dispose()
  $stream.ToArray()
}

$file = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter $file
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)

$directorySize = 6 + ($sizes.Count * 16)
$offset = $directorySize
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $size = $sizes[$i]
  $bytes = $pngImages[$i]
  $directorySizeValue = $size
  if ($size -eq 256) {
    $directorySizeValue = 0
  }
  $writer.Write([byte]$directorySizeValue)
  $writer.Write([byte]$directorySizeValue)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $bytes.Length
}

foreach ($bytes in $pngImages) {
  $writer.Write($bytes)
}

$writer.Dispose()
$file.Dispose()

Write-Host "Wrote $outputPath"
Write-Host "Wrote $pngPath"
