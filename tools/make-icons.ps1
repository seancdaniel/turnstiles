# Build the PWA / home-screen icon set from the 1254px source art.
#
# The source is gold line-work on an OPAQUE WHITE background, while every icon
# here wants it on the site's navy. So white is converted to alpha rather than
# being chopped at a threshold: a hard cut leaves a white fringe on every
# antialiased edge of what is very fine line-work, and this logo is almost
# entirely fine line-work.
#
# LockBits rather than GetPixel: 1254 x 1254 is 1.57M pixels and GetPixel would
# take minutes (see NOTES on how image work is done in this project).

Add-Type -AssemblyName System.Drawing

$src     = "C:\Users\SeanDaniel\Pictures\Turnstiles Images\Turnstiles Logo.png"
$outDir  = "C:\Users\SeanDaniel\Desktop\Turnstiles\img"

# sampled from the existing favicon so the new icons match what is already shipping
$favicon = [System.Drawing.Image]::FromFile("$outDir\favicon.png")
$fb      = New-Object System.Drawing.Bitmap $favicon
# (6,6) sits OUTSIDE the favicon's rounded corner and is fully transparent,
# which silently produced black icons on the first run. Sample mid-edge.
$navy    = $fb.GetPixel(64, 10)
$fb.Dispose(); $favicon.Dispose()
"navy sampled from favicon.png: #{0:X2}{1:X2}{2:X2}" -f $navy.R, $navy.G, $navy.B

# ---- 1. white background -> alpha, once, at full resolution ----
$img = [System.Drawing.Image]::FromFile($src)
$w = $img.Width; $h = $img.Height
$cut = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($cut)
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($img, 0, 0, $w, $h)
$g.Dispose(); $img.Dispose()

$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $cut.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = $w * $h * 4
$buf = New-Object byte[] $bytes
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $bytes)

for ($i = 0; $i -lt $bytes; $i += 4) {
  $b = $buf[$i]; $gr = $buf[$i+1]; $r = $buf[$i+2]
  # distance from white drives opacity, so soft edges stay soft
  $m = $b; if ($gr -lt $m) { $m = $gr }; if ($r -lt $m) { $m = $r }
  $a = 255 - $m
  if ($a -le 0) { $buf[$i+3] = 0; continue }
  # un-premultiply so the gold keeps its colour instead of going muddy
  $buf[$i]   = [byte][Math]::Min(255, [int](($b  - (255 - $a)) * 255 / $a))
  $buf[$i+1] = [byte][Math]::Min(255, [int](($gr - (255 - $a)) * 255 / $a))
  $buf[$i+2] = [byte][Math]::Min(255, [int](($r  - (255 - $a)) * 255 / $a))
  $buf[$i+3] = [byte]$a
}
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $bytes)
$cut.UnlockBits($data)

# ---- 2. draw it onto navy at each size ----
# `inset` is the share of the canvas the mark occupies. Maskable icons get a
# smaller one because Android crops adaptive icons to whatever shape the
# launcher likes, and only the middle ~80% is guaranteed to survive.
function Emit($name, $size, $inset, $rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gg = [System.Drawing.Graphics]::FromImage($bmp)
  $gg.SmoothingMode = 'AntiAlias'
  $gg.InterpolationMode = 'HighQualityBicubic'
  $gg.PixelOffsetMode = 'HighQuality'
  $gg.Clear([System.Drawing.Color]::Transparent)

  $brush = New-Object System.Drawing.SolidBrush $navy
  if ($rounded) {
    $r = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $r*2, $r*2, 180, 90)
    $path.AddArc($size-$r*2, 0, $r*2, $r*2, 270, 90)
    $path.AddArc($size-$r*2, $size-$r*2, $r*2, $r*2, 0, 90)
    $path.AddArc(0, $size-$r*2, $r*2, $r*2, 90, 90)
    $path.CloseFigure()
    $gg.FillPath($brush, $path)
    $path.Dispose()
  } else {
    $gg.FillRectangle($brush, 0, 0, $size, $size)
  }
  $brush.Dispose()

  $m = [int]($size * $inset)
  $off = [int](($size - $m) / 2)
  $gg.DrawImage($cut, $off, $off, $m, $m)
  $gg.Dispose()
  $bmp.Save("$outDir\$name", [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "  wrote $name  ({0}x{0}, mark at {1:P0}{2})" -f $size, $inset, $(if ($rounded) {", rounded"} else {""})
}

# iOS never uses transparency and rounds the corners itself, so this one is a
# flat square. Android gets a square plus a maskable variant.
Emit "apple-touch-icon.png"    180 0.78 $false
Emit "icon-192.png"            192 0.78 $false
Emit "icon-512.png"            512 0.78 $false
Emit "icon-maskable-512.png"   512 0.58 $false

$cut.Dispose()
"done"
