<#
.SYNOPSIS Windows deployment helper for Diagnosis Explorer.
.DESCRIPTION This PowerShell script provides a Windows-friendly entrypoint for verification and basic deployment checks.
#>
param(
    [Parameter(Position=0)]
    [string]$Command = "verify"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

function Write-Info([string]$text) {
    Write-Host "[INFO]  $text" -ForegroundColor Cyan
}
function Write-Ok([string]$text) {
    Write-Host "[OK]    $text" -ForegroundColor Green
}
function Write-Warn([string]$text) {
    Write-Host "[WARN]  $text" -ForegroundColor Yellow
}
function Write-Err([string]$text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

function Wait-For-Health {
    param(
        [string]$Url = 'http://localhost/health',
        [int]$MaxSeconds = 80,
        [int]$IntervalSeconds = 4
    )

    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Ok "API is responding (HTTP 200)"
                return $true
            }
        } catch {
            Write-Host -NoNewline '.'
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
    Write-Host ''
    return $false
}

function Run-Verify {
    Write-Info "Running Docker Compose to start services..."
    try {
        docker compose version > $null 2>&1
    } catch {
        Write-Err "Docker Compose not available. Install Docker Desktop or use Git Bash with Docker Compose support."
        exit 1
    }

    docker compose up -d
    Write-Info "Waiting for backend health endpoint..."
    if (-not (Wait-For-Health -Url 'http://localhost/health' -MaxSeconds 80 -IntervalSeconds 4)) {
        Write-Warn "API did not become healthy within the timeout. Verification may still run."
    }

    Write-Info "Running verification suite with Python..."
    $env:MDP_BASE_URL = 'http://localhost'
    python .\scripts\verify_runner.py
    exit $LASTEXITCODE
}

switch ($Command.ToLower()) {
    'verify' { Run-Verify }
    'help' { Write-Host "Usage: powershell -File .\scripts\deploy.ps1 verify" }
    default { Write-Err "Unknown command '$Command'. Use 'verify' or 'help'."; exit 1 }
}
