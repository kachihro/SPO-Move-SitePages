# Deploy BuildingApprovalsControl PCF to a Dataverse environment.
# Run from anywhere; this script cds to the project root (where the .pcfproj lives).
#
# Usage:
#   .\DEPLOY-SCRIPT.ps1
#   .\DEPLOY-SCRIPT.ps1 -EnvironmentUrl "https://orga3a7d35b.crm6.dynamics.com"
#   .\DEPLOY-SCRIPT.ps1 -SolutionUniqueName "BuildingApprovalsSolution"

param(
    [string]$EnvironmentUrl,
    [string]$PublisherPrefix = "cr137",
    [string]$SolutionUniqueName,
    [switch]$SkipAuth,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path (Join-Path $ProjectRoot "BuildingApprovalsControl.pcfproj"))) {
    Write-Error "BuildingApprovalsControl.pcfproj not found in $ProjectRoot. Run this script from the PCF project root."
}

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan

# 1. Authenticate (interactive unless skipped / already authenticated)
if (-not $SkipAuth) {
    if ($EnvironmentUrl) {
        Write-Host "Authenticating to $EnvironmentUrl ..." -ForegroundColor Cyan
        pac auth create --environment $EnvironmentUrl
    }
    else {
        Write-Host "No -EnvironmentUrl supplied. Using current pac auth profile." -ForegroundColor Yellow
        pac auth who
        if ($LASTEXITCODE -ne 0) {
            Write-Error "No active pac auth profile. Re-run with -EnvironmentUrl <url>."
        }
    }
}

# 2. Install + build
if (-not $SkipBuild) {
    Write-Host "npm install ..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed." }

    Write-Host "npm run build ..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed." }
}

# 3. Push PCF
# Prefer --solution-unique-name once BuildingApprovalsSolution exists in the target env.
# Until then, --publisher-prefix creates/updates PowerAppsToolsTemp_<prefix>.
#
# pac pcf push deletes and recreates obj\PowerAppsToolsTemp_<prefix>. A second push
# (or a leftover MSBuild) while that folder is in use produces MSB4025 (cdsproj
# vanished mid-restore) and "used by another process".
$overlapping = @(Get-CimInstance Win32_Process -Filter "Name = 'pac.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'pcf push' })
if ($overlapping.Count -gt 0) {
    Write-Error "Another pac pcf push is already running (PID $($overlapping.ProcessId -join ', ')). Wait for it to finish, then retry."
}

$tempWrapper = Join-Path $ProjectRoot "obj\PowerAppsToolsTemp_$PublisherPrefix"
if (Test-Path -LiteralPath $tempWrapper) {
    Write-Host "Removing leftover temp wrapper $tempWrapper ..." -ForegroundColor Cyan
    $removed = $false
    for ($i = 1; $i -le 5; $i++) {
        try {
            Remove-Item -LiteralPath $tempWrapper -Recurse -Force -ErrorAction Stop
            $removed = $true
            break
        }
        catch {
            Write-Host "Temp wrapper locked, retry $i/5 ..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    if (-not $removed) {
        Write-Error "Could not remove $tempWrapper (file in use). Close other pac/MSBuild windows and retry."
    }
}

Write-Host "Pushing PCF ..." -ForegroundColor Cyan
if ($SolutionUniqueName) {
    pac pcf push --solution-unique-name $SolutionUniqueName
}
else {
    pac pcf push --publisher-prefix $PublisherPrefix
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "pac pcf push failed."
}

Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "Load the control on a Power Pages page to verify end-to-end (local harness does not hit Dataverse)."
