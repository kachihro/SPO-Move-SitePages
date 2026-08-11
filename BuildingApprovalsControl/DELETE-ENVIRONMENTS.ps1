# Delete Power Platform environments in this tenant, with hard protections.
#
# IMPORTANT:
# - Already soft-deleted environments (Admin Center > Deleted) CANNOT be force-purged.
#   Microsoft keeps them for recovery (~7 days sandbox/dev, longer for some Production)
#   then permanently deletes them. Capacity frees after hard-delete completes.
# - This script deletes ACTIVE environments via: pac admin delete
# - poc-cli is always protected unless you pass -AllowDeletePocCli (do not).
# - Default environment cannot be deleted by platform policy.
#
# Usage:
#   .\DELETE-ENVIRONMENTS.ps1 -List
#   .\DELETE-ENVIRONMENTS.ps1 -Name "aal-poc" -WhatIf
#   .\DELETE-ENVIRONMENTS.ps1 -Name "aal-poc" -ConfirmDelete
#   .\DELETE-ENVIRONMENTS.ps1 -Name "aal-poc","Demo-AAL" -ConfirmDelete
#   .\DELETE-ENVIRONMENTS.ps1 -AllExceptProtected -ConfirmDelete

param(
    [switch]$List,
    [string[]]$Name,
    [string[]]$EnvironmentId,
    [switch]$AllExceptProtected,
    [string[]]$ProtectName = @("poc-cli"),
    [switch]$ProtectDefault = $true,
    [switch]$AllowDeletePocCli,
    [switch]$WhatIf,
    [switch]$ConfirmDelete,
    [switch]$Async
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor Cyan
}

function Get-AdminEnvironments {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $raw = & pac admin list 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw ("pac admin list failed:`n{0}" -f (($raw | ForEach-Object { "$_" }) -join "`n"))
        }
        $lines = @($raw | ForEach-Object { "$_" })
    }
    finally {
        $ErrorActionPreference = $old
    }

    $envs = @()
    foreach ($line in $lines) {
        # Active marker optional, then display name, group, GUID, URL, Type, Org GUID
        if ($line -match '^\s*(\*)?\s*(\S.*?)\s+-\s+([0-9a-fA-F-]{36})\s+(https://\S+)\s+(\S+)\s+([0-9a-fA-F-]{36})\s*$') {
            $envs += [pscustomobject]@{
                ActiveMarker    = [bool]$Matches[1]
                DisplayName     = $Matches[2].Trim()
                EnvironmentId   = $Matches[3]
                EnvironmentUrl  = $Matches[4]
                Type            = $Matches[5]
                OrganizationId  = $Matches[6]
            }
        }
    }
    return $envs
}

function Test-IsProtected {
    param(
        [object]$Env,
        [string[]]$ProtectNames,
        [bool]$ProtectDefaultEnv,
        [bool]$AllowPocCli
    )

    $reasons = [System.Collections.Generic.List[string]]::new()

    if (-not $AllowPocCli) {
        if ($Env.DisplayName -match '(?i)^poc-cli$' -or $Env.EnvironmentId -eq "ef4a3b97-4158-e1dd-9f06-75af6c9f86ca") {
            $reasons.Add("protected: poc-cli")
        }
    }

    foreach ($p in $ProtectNames) {
        if ($Env.DisplayName -and ($Env.DisplayName -ieq $p -or $Env.DisplayName -like $p)) {
            $reasons.Add("protected name match: $p")
        }
    }

    if ($ProtectDefaultEnv -and $Env.Type -ieq "Default") {
        $reasons.Add("protected: Default environment")
    }

    return [pscustomobject]@{
        Protected = ($reasons.Count -gt 0)
        Reasons   = ($reasons -join "; ")
    }
}

Write-Section "Power Platform environment delete helper"
Write-Host "Soft-deleted envs (Deleted tab) cannot be force-purged by script/API." -ForegroundColor Yellow
Write-Host "They auto hard-delete after the retention window; capacity frees then." -ForegroundColor Yellow

$envs = Get-AdminEnvironments
if (-not $envs -or $envs.Count -eq 0) {
    throw "No environments parsed from pac admin list. Are you a Power Platform admin?"
}

Write-Section ("Active environments ({0})" -f $envs.Count)
$envs | ForEach-Object {
    $prot = Test-IsProtected -Env $_ -ProtectNames $ProtectName -ProtectDefaultEnv:$ProtectDefault -AllowPocCli:$AllowDeletePocCli
    $flag = if ($prot.Protected) { "PROTECTED" } else { "deletable" }
    $color = if ($prot.Protected) { "Green" } else { "White" }
    Write-Host ("[{0}] {1} | {2} | {3} | {4}" -f $flag, $_.DisplayName, $_.Type, $_.EnvironmentId, $_.EnvironmentUrl) -ForegroundColor $color
    if ($prot.Protected -and $prot.Reasons) {
        Write-Host ("         {0}" -f $prot.Reasons) -ForegroundColor DarkGreen
    }
}

if ($List -and -not $Name -and -not $EnvironmentId -and -not $AllExceptProtected) {
    Write-Section "Soft-deleted environments"
    Write-Host "Listed only in Admin Center: Environments > Deleted."
    Write-Host "No force-purge API. Wait for retention expiry (typically ~7 days)."
    Write-Host "Do NOT recover them if you want capacity back."
    return
}

$targets = @()
if ($AllExceptProtected) {
    foreach ($e in $envs) {
        $prot = Test-IsProtected -Env $e -ProtectNames $ProtectName -ProtectDefaultEnv:$ProtectDefault -AllowPocCli:$AllowDeletePocCli
        if (-not $prot.Protected) { $targets += $e }
    }
}
else {
    foreach ($n in @($Name)) {
        $match = @($envs | Where-Object { $_.DisplayName -ieq $n -or $_.DisplayName -like $n })
        if ($match.Count -eq 0) {
            Write-Host ("WARNING: no active environment named '{0}' (may already be soft-deleted)." -f $n) -ForegroundColor Yellow
        }
        $targets += $match
    }
    foreach ($id in @($EnvironmentId)) {
        $match = @($envs | Where-Object { $_.EnvironmentId -ieq $id })
        if ($match.Count -eq 0) {
            Write-Host ("WARNING: no active environment id '{0}'." -f $id) -ForegroundColor Yellow
        }
        $targets += $match
    }
}

$targets = @($targets | Sort-Object EnvironmentId -Unique)
if ($targets.Count -eq 0) {
    throw "No delete targets. Use -List, or -Name / -EnvironmentId / -AllExceptProtected."
}

Write-Section ("Delete targets ({0})" -f $targets.Count)
$toDelete = @()
foreach ($t in $targets) {
    $prot = Test-IsProtected -Env $t -ProtectNames $ProtectName -ProtectDefaultEnv:$ProtectDefault -AllowPocCli:$AllowDeletePocCli
    if ($prot.Protected) {
        Write-Host ("SKIP {0} ({1})" -f $t.DisplayName, $prot.Reasons) -ForegroundColor Green
        continue
    }
    Write-Host ("DELETE {0} | {1} | {2}" -f $t.DisplayName, $t.Type, $t.EnvironmentId) -ForegroundColor Red
    $toDelete += $t
}

if ($toDelete.Count -eq 0) {
    Write-Host "Nothing to delete after protections." -ForegroundColor Yellow
    return
}

if ($WhatIf -or -not $ConfirmDelete) {
    Write-Section "Dry run"
    Write-Host "Re-run with -ConfirmDelete to actually delete." -ForegroundColor Yellow
    Write-Host "Example:"
    Write-Host ('  .\DELETE-ENVIRONMENTS.ps1 -Name "{0}" -ConfirmDelete' -f $toDelete[0].DisplayName)
    return
}

Write-Section "Deleting"
foreach ($t in $toDelete) {
    Write-Host ("Deleting {0} ({1}) ..." -f $t.DisplayName, $t.EnvironmentId) -ForegroundColor Red
    $args = @("admin", "delete", "--environment", $t.EnvironmentId)
    if ($Async) { $args += "--async" }
    & pac @args
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("FAILED: {0}" -f $t.DisplayName) -ForegroundColor Red
    }
    else {
        Write-Host ("Submitted delete for {0}. It will appear under Deleted, then hard-delete later." -f $t.DisplayName) -ForegroundColor Green
    }
}

Write-Section "Done"
Write-Host "Capacity often lags up to ~24h after hard-delete."
Write-Host "poc-cli was left alone."
