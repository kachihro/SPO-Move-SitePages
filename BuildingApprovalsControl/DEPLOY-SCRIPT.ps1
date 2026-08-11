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
