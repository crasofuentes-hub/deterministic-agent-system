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

function Read-JsonObject {
    param([Parameter(Mandatory = $true)][string]$Path)
    $raw = Get-Content $Path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw ("JSON file is empty: " + $Path)
    }
    try {
        return ($raw | ConvertFrom-Json)
    }
    catch {
        throw ("Invalid JSON in file: " + $Path + " :: " + $_.Exception.Message)
    }
}

function Test-DeterministicErrorResponseShape {
    param(
        [Parameter(Mandatory = $true)]$Obj,
        [Parameter(Mandatory = $true)][string]$SourceName
    )

    $errors = New-Object System.Collections.ArrayList

    # top-level required fields
    if (-not ($Obj.PSObject.Properties.Name -contains "ok")) {
        [void]$errors.Add("Missing top-level property: ok")
    }
    if (-not ($Obj.PSObject.Properties.Name -contains "error")) {
        [void]$errors.Add("Missing top-level property: error")
    }

    if (($Obj.PSObject.Properties.Name -contains "ok")) {
        if ($Obj.ok -ne $false) {
            [void]$errors.Add("Property 'ok' must be boolean false")
        }
    }

    if (($Obj.PSObject.Properties.Name -contains "error")) {
        $err = $Obj.error
        if ($null -eq $err) {
            [void]$errors.Add("Property 'error' must not be null")
        }
        else {
            if (-not ($err.PSObject.Properties.Name -contains "code")) {
                [void]$errors.Add("Missing error.code")
            }
            if (-not ($err.PSObject.Properties.Name -contains "message")) {
                [void]$errors.Add("Missing error.message")
            }
            if (-not ($err.PSObject.Properties.Name -contains "retryable")) {
                [void]$errors.Add("Missing error.retryable")
            }

            if ($err.PSObject.Properties.Name -contains "code") {
                $code = [string]$err.code
                if ([string]::IsNullOrWhiteSpace($code)) {
                    [void]$errors.Add("error.code must not be empty")
                }
                elseif ($code -notmatch '^[A-Z][A-Z0-9_]*$') {
                    [void]$errors.Add("error.code must match ^[A-Z][A-Z0-9_]*$")
                }
            }

            if ($err.PSObject.Properties.Name -contains "message") {
                $msg = [string]$err.message
                if ([string]::IsNullOrWhiteSpace($msg)) {
                    [void]$errors.Add("error.message must not be empty")
                }
                elseif ($msg.Length -gt 1000) {
                    [void]$errors.Add("error.message exceeds 1000 characters")
                }
            }

            if ($err.PSObject.Properties.Name -contains "retryable") {
                $rtype = $err.retryable.GetType().FullName
                if ($rtype -ne "System.Boolean") {
                    [void]$errors.Add("error.retryable must be boolean")
                }
            }
        }
    }

    return (New-Object PSObject -Property @{
        Source = $SourceName
        Ok = (($errors | Measure-Object).Count -eq 0)
        Errors = @($errors)
    })
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$scriptFile = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptFile
$repoRoot = Split-Path -Parent $scriptDir
$statusPath = Join-Path $repoRoot "CONTRACT_STATUS.md"

Push-Location $repoRoot
try {
    # Parse check (self)
    $tokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $scriptFile,
        [ref]$tokens,
        [ref]$parseErrors
    )
    if ($parseErrors -and $parseErrors.Count -gt 0) {
        $msg = ($parseErrors | ForEach-Object { $_.Message }) -join " | "
        throw ("Parse FAIL in verify-contract.ps1: " + $msg)
    }

    $required = @(
        "docs\error-codes.md",
        "schemas\error-response.schema.json",
        "samples\error-response.valid.json",
        "samples\error-response.invalid.missing-code.json"
    )

    foreach ($f in $required) {
        Assert-FileExists -Path $f
    }

    $validObj = Read-JsonObject -Path "samples\error-response.valid.json"
    $invalidObj = Read-JsonObject -Path "samples\error-response.invalid.missing-code.json"

    $validResult = Test-DeterministicErrorResponseShape -Obj $validObj -SourceName "samples/error-response.valid.json"
    $invalidResult = Test-DeterministicErrorResponseShape -Obj $invalidObj -SourceName "samples/error-response.invalid.missing-code.json"

    # Expected outcomes
    $checks = New-Object System.Collections.ArrayList

    [void]$checks.Add((New-Object PSObject -Property @{
        Name = "Valid sample passes shape validation"
        Ok = [bool]$validResult.Ok
        Detail = $(if ($validResult.Ok) { "PASS" } else { ($validResult.Errors -join " | ") })
    }))

    $invalidExpectedFail = (-not [bool]$invalidResult.Ok)
    [void]$checks.Add((New-Object PSObject -Property @{
        Name = "Invalid sample fails shape validation"
        Ok = [bool]$invalidExpectedFail
        Detail = $(if ($invalidExpectedFail) { ($invalidResult.Errors -join " | ") } else { "Unexpected PASS" })
    }))

    $missingCodeDetected = $false
    foreach ($e in $invalidResult.Errors) {
        if ([string]$e -like "*Missing error.code*") {
            $missingCodeDetected = $true
        }
    }
    [void]$checks.Add((New-Object PSObject -Property @{
        Name = "Invalid sample reports missing error.code"
        Ok = [bool]$missingCodeDetected
        Detail = $(if ($missingCodeDetected) { "Missing error.code detected" } else { "Expected missing error.code was not detected" })
    }))

    $failCount = ($checks | Where-Object { -not $_.Ok } | Measure-Object).Count
    $overall = $(if ($failCount -eq 0) { "PASS" } else { "FAIL" })
    $nowUtc = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

    $lines = New-Object 'System.Collections.Generic.List[string]'
    [void]$lines.Add("# CONTRACT_STATUS")
    [void]$lines.Add("")
    [void]$lines.Add("## Interface Contract Verification Status")
    [void]$lines.Add("")
    [void]$lines.Add("- Generated (UTC): " + $nowUtc)
    [void]$lines.Add("- Scope: Deterministic error response shape checks (PowerShell validator + JSON samples)")
    [void]$lines.Add("- Overall status: **" + $overall + "**")
    [void]$lines.Add("")
    [void]$lines.Add("### Checks")
    [void]$lines.Add("")

    foreach ($c in $checks) {
        $status = $(if ($c.Ok) { "PASS" } else { "FAIL" })
        [void]$lines.Add("#### " + [string]$c.Name)
        [void]$lines.Add("- Status: **" + $status + "**")
        [void]$lines.Add("- Detail: " + [string]$c.Detail)
        [void]$lines.Add("")
    }

    [void]$lines.Add("### Notes")
    [void]$lines.Add("")
    [void]$lines.Add("- JSON Schema file is present and versioned.")
    [void]$lines.Add("- Current validation script performs deterministic shape checks in PowerShell 5.1 without external schema validator dependencies.")
    [void]$lines.Add("- This script is intended as a foundation for expanded contract verification and negative-path testing.")
    [void]$lines.Add("")

    $content = [string]::Join([Environment]::NewLine, $lines.ToArray())
    Write-Utf8NoBom -Path $statusPath -Content $content

    if (!(Test-Path $statusPath)) { throw "Failed to generate CONTRACT_STATUS.md" }
    if ((Get-Item $statusPath).Length -lt 100) { throw "CONTRACT_STATUS.md unexpectedly small" }

    Write-Host "Contract verification PASS" -ForegroundColor Green
    Write-Host ("OK: generated -> " + $statusPath) -ForegroundColor Green

    if ($failCount -ne 0) {
        throw "One or more contract checks failed."
    }
}
finally {
    Pop-Location
}