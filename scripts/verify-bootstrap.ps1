[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-FileExists {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (!(Test-Path $Path)) {
        throw ("Missing required file: " + $Path)
    }
}

function Assert-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw ("Required command not found: " + $Name)
    }
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host ("== " + $Name + " ==") -ForegroundColor Cyan
    & $Action
    Write-Host ("OK: " + $Name) -ForegroundColor Green
}

$scriptFile = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptFile
$repoRoot = Split-Path -Parent $scriptDir

Push-Location $repoRoot
try {
    Assert-CommandExists -Name "node"
    Assert-CommandExists -Name "npm"

    $required = @(
        "package.json",
        "tsconfig.json",
        "README.md",
        "LICENSE",
        "src\index.ts"
    )

    foreach ($f in $required) {
        Assert-FileExists -Path $f
    }

    Invoke-Step -Name "npm install" -Action {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw ("npm install failed with exit code " + $LASTEXITCODE) }
    }

    Invoke-Step -Name "npm run build" -Action {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw ("npm run build failed with exit code " + $LASTEXITCODE) }
    }

    Invoke-Step -Name "npm start" -Action {
        & npm start
        if ($LASTEXITCODE -ne 0) { throw ("npm start failed with exit code " + $LASTEXITCODE) }
    }

    Assert-FileExists -Path "dist\index.js"

    Write-Host "Bootstrap verification PASS" -ForegroundColor Green
}
finally {
    Pop-Location
}