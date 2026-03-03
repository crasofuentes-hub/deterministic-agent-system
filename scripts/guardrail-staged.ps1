param(
  [Parameter(Mandatory=$true)]
  [string[]]$Expected
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Fuerza arrays SIEMPRE (aunque haya 0 o 1 línea)
$staged = @((git diff --name-only --cached) | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$wt     = @((git status --porcelain)        | ForEach-Object { $_.Trim() } | Where-Object { $_ })

Write-Host ("STAGED_LEN=" + $staged.Length) -ForegroundColor Cyan
Write-Host ("WT_LEN=" + $wt.Length) -ForegroundColor Cyan

# Caso A: no hay staged -> NO evaluar missing/extra contra staged
if ($staged.Length -eq 0) {

  # A1: repo totalmente limpio -> validar que HEAD contiene los esperados
  if ($wt.Length -eq 0) {
    $headFiles = @((git show --name-only --pretty="format:" HEAD) | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $missingInHead = @($Expected | Where-Object { $headFiles -notcontains $_ })

    if ($missingInHead.Length -gt 0) {
      throw ("HEAD NO contiene esperados: " + ($missingInHead -join ", "))
    }

    Write-Host "OK: no hay staged; repo limpio; HEAD contiene los esperados." -ForegroundColor Green
    exit 0
  }

  # A2: hay cambios sin stagear, pero staged vacío -> guardrail de staged no aplica
  Write-Host "OK: no hay staged; hay cambios sin stagear; guardrail de staged NO aplica." -ForegroundColor Green
  exit 0
}

# Caso B: hay staged -> aplicar guardrail exacto
$extra   = @($staged   | Where-Object { $Expected -notcontains $_ })
$missing = @($Expected | Where-Object { $staged   -notcontains $_ })

if ($missing.Length -gt 0) { throw ("Faltan staged esperados: " + ($missing -join ", ")) }
if ($extra.Length   -gt 0) { throw ("Hay staged extra NO permitidos: " + ($extra -join ", ")) }

Write-Host "OK: staged coincide exactamente con lo esperado." -ForegroundColor Green
exit 0