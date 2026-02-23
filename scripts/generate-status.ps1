[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $ok = $false
    $errText = ""

    try {
        $null = & $Action
        $ok = $true
    }
    catch {
        $ok = $false
        if ($_.Exception -and $_.Exception.Message) {
            $errText = [string]$_.Exception.Message
        }
        else {
            $errText = "Unknown error"
        }
    }
    finally {
        $sw.Stop()
    }

    return (New-Object PSObject -Property @{
        Name = $Name
        Ok = $ok
        DurationMs = [int][Math]::Round($sw.Elapsed.TotalMilliseconds, 0)
        Error = $errText
    })
}

function Escape-MarkdownInlineCode {
    param([string]$Text)
    if ($null -eq $Text) { return "" }
    # Evita romper markdown simple; no usa backticks en parser-sensitive concatenations
    return ($Text -replace '[\r\n]+', ' ' -replace '\|', '/')
}

$scriptFile = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptFile
$repoRoot = Split-Path -Parent $scriptDir
$outPath = Join-Path $repoRoot "BOOTSTRAP_STATUS.md"

Push-Location $repoRoot
try {
    $results = New-Object System.Collections.ArrayList

    [void]$results.Add((Invoke-Step -Name "PowerShell Parse Check: scripts\verify-bootstrap.ps1" -Action {
        $tokens = $null
        $errors = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile(
            (Join-Path $repoRoot "scripts\verify-bootstrap.ps1"),
            [ref]$tokens,
            [ref]$errors
        )
        if ($errors -and $errors.Count -gt 0) {
            $msg = ($errors | ForEach-Object { $_.Message }) -join " | "
            throw ("Parse errors in verify-bootstrap.ps1: " + $msg)
        }
    }))

    [void]$results.Add((Invoke-Step -Name "powershell -File scripts\verify-bootstrap.ps1" -Action {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\verify-bootstrap.ps1")
        if ($LASTEXITCODE -ne 0) {
            throw ("verify-bootstrap.ps1 failed with exit code " + [string]$LASTEXITCODE)
        }
    }))

    $gitCommit = ""
    try {
        $gitCommit = (git rev-parse HEAD).Trim()
    }
    catch {
        $gitCommit = ""
    }

    $failedCount = ($results | Where-Object { -not $_.Ok } | Measure-Object).Count
    $allOk = ($failedCount -eq 0)
    if ($allOk) {
        $overall = "PASS"
    }
    else {
        $overall = "FAIL"
    }

    $nowUtc = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

    $lines = New-Object 'System.Collections.Generic.List[string]'
    [void]$lines.Add("# BOOTSTRAP_STATUS")
    [void]$lines.Add("")
    [void]$lines.Add("## Deterministic Agent System Bootstrap Verification Status")
    [void]$lines.Add("")
    [void]$lines.Add("- Generated (UTC): " + $nowUtc)
    if ($gitCommit) {
        [void]$lines.Add("- Git commit: " + $gitCommit)
    }
    [void]$lines.Add("- Overall status: **" + $overall + "**")
    [void]$lines.Add("")
    [void]$lines.Add("### Results")
    [void]$lines.Add("")

    foreach ($r in $results) {
        if ($r.Ok) {
            $status = "PASS"
        }
        else {
            $status = "FAIL"
        }

        [void]$lines.Add("#### " + [string]$r.Name)
        [void]$lines.Add("- Status: **" + $status + "**")
        [void]$lines.Add("- DurationMs: " + [string]$r.DurationMs)

        if ((-not $r.Ok) -and $r.Error) {
            $safeErr = Escape-MarkdownInlineCode -Text ([string]$r.Error)
            [void]$lines.Add("- Error: " + $safeErr)
        }

        [void]$lines.Add("")
    }

    [void]$lines.Add("### Notes")
    [void]$lines.Add("")
    [void]$lines.Add("- Status generated with PowerShell 5.1-safe script.")
    [void]$lines.Add("- Output encoded as UTF-8 without BOM.")
    [void]$lines.Add("- Parse validation is performed before execution of the verification script.")
    [void]$lines.Add("")

    $content = [string]::Join([Environment]::NewLine, $lines.ToArray())
    Write-Utf8NoBom -Path $outPath -Content $content

    if (!(Test-Path $outPath)) {
        throw ("Failed to create status file: " + $outPath)
    }

    $size = (Get-Item $outPath).Length
    if ($size -lt 100) {
        throw ("Status file is unexpectedly small: " + [string]$size + " bytes")
    }

    Write-Host ("OK: status generated -> " + $outPath) -ForegroundColor Green

    if (-not $allOk) {
        throw "One or more bootstrap verification steps failed."
    }
}
finally {
    Pop-Location
}