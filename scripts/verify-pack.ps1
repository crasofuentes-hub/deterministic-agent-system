Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "== VERIFY PACK ==" -ForegroundColor Cyan

Get-ChildItem -File -Filter "*.tgz" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { throw "build failed (npm run build exit=$LASTEXITCODE)" }

$packJson = npm pack --json | Out-String
if (-not $packJson.Trim()) { throw "npm pack --json returned empty output" }

$items = $packJson | ConvertFrom-Json
if (-not $items -or $items.Count -lt 1) { throw "npm pack --json returned no items" }

$tgz = $items[0].filename
if (-not $tgz) { throw "npm pack output missing filename" }
if (!(Test-Path $tgz)) { throw "tgz not found: $tgz" }

Write-Host "OK: packed -> $tgz" -ForegroundColor Green

Write-Host "`n== TAR CONTENTS ==" -ForegroundColor Cyan
$contents = (tar -tf $tgz)
$contents | Out-Host

$must = @("package/README.md","package/LICENSE","package/package.json")
foreach ($m in $must) { if ($contents -notcontains $m) { throw "missing from tarball: $m" } }

$hasDist = $false
foreach ($c in $contents) { if ($c -like "package/dist/*") { $hasDist = $true; break } }
if (-not $hasDist) { throw "tarball missing package/dist/*" }

foreach ($bad in @("package/src/","package/tests/","package/scripts/","package/.git/")) {
  foreach ($c in $contents) {
    if ($c -like ($bad + "*")) { throw "tarball contains disallowed path: $c" }
  }
}

Write-Host "`nOK: pack contents minimal and clean" -ForegroundColor Green
