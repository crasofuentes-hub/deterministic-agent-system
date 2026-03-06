Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Consola estable
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

# No colores / no terminal smart
$env:FORCE_COLOR = "0"
$env:TERM = "dumb"

# Reporter ASCII (TAP)
$reporter = @("--test-reporter","tap")

# Permite pasar rutas/patrones de tests como args; si no pasan nada, corre "npm test" en TAP-friendly mode.
if ($args.Count -gt 0) {
  node --test @reporter @args
  exit $LASTEXITCODE
}

# Default: suite completa (node --test recursivo sobre tests/ si tu npm test ya es determinista, puedes cambiarlo luego)
node --test @reporter tests
exit $LASTEXITCODE