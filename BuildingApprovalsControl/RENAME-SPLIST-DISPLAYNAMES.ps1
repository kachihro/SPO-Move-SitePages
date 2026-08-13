# Rename SharePoint list column DisplayName (Title) to match the column InternalName.
#
# Why: EXPORT-DV-TO-SPLIST.ps1 provisions columns using the Dataverse LogicalName as the
# SharePoint InternalName, but takes DisplayName from the Dataverse label — which for some
# attributes is junk (e.g. cr137_accesstoconfinedspacesincluded came across as "No").
# This script re-points every DisplayName at the InternalName so the list reads consistently.
#
# Prerequisites (same as EXPORT-DV-TO-SPLIST.ps1):
#   - PnP.PowerShell (cert / app-only SharePoint) and/or MSAL.PS (device login)
#
# SharePoint auth:
#   A) Certificate (recommended for demoplanb):
#        .\RENAME-SPLIST-DISPLAYNAMES.ps1 -UseCertificate
#        # resolves PlanBDev_PlanBSharePoint.pfx under C:\Repos\CERT or ...\Adelaide Uni\Scripts\CERT
#        # password: prompt, or set $env:PLANB_PFX_PASSWORD
#   B) Device login:
#        .\RENAME-SPLIST-DISPLAYNAMES.ps1   # Get-MsalToken -DeviceCode (Sites.Manage.All)
#
# Usage:
#   .\RENAME-SPLIST-DISPLAYNAMES.ps1 -WhatIf                       # preview only
#   .\RENAME-SPLIST-DISPLAYNAMES.ps1 -UseCertificate
#   .\RENAME-SPLIST-DISPLAYNAMES.ps1 -UseCertificate -ListTitle "Building Activity Application"
#   .\RENAME-SPLIST-DISPLAYNAMES.ps1 -UseCertificate -Include "cr137_*"
#   .\RENAME-SPLIST-DISPLAYNAMES.ps1 -UseCertificate -IncludeTitleField

param(
    [string]$SharePointSiteUrl = "https://demoplanb.sharepoint.com/sites/AALBuildingApprovals",
    [string]$ListTitle = "Building Activity Application",
    # Only touch columns whose InternalName matches one of these wildcard patterns.
    [string[]]$Include = @("*"),
    # Never touch columns whose InternalName matches one of these wildcard patterns.
    [string[]]$Exclude = @(),
    # By default the built-in 'Title' field is left alone (renaming it is rarely wanted).
    [switch]$IncludeTitleField,
    # Also rename SharePoint built-in / base-type columns (Created, Modified, Author, ...).
    [switch]$IncludeSystemFields,
    [switch]$WhatIf,
    # Same tenant switch style as EXPORT-DV-TO-SPLIST.ps1
    [ValidateSet("demoplanb", "uao365", "mymailunisaedu", "adelaideuni", "planbconsulting")]
    [string]$TenantName = "demoplanb",
    [switch]$UseCertificate,
    [string]$ClientId,
    [string]$TenantId,
    [string]$CertName,
    [string]$CertificateThumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

$ExportDir = Join-Path $ProjectRoot "exports"
if (-not (Test-Path $ExportDir)) {
    New-Item -ItemType Directory -Path $ExportDir | Out-Null
}

# --- Tenant / cert defaults (mirrors EXPORT-DV-TO-SPLIST.ps1) ---
$tenantDefaults = @{
    demoplanb = @{
        TenantId = "700c54b9-3ba9-4562-a1a2-2b7cdcc661c6"
        ClientId = "4695d328-582e-4946-b2d1-66798a7565ec"
        CertName = "PlanBDev_PlanBSharePoint"
    }
    uao365 = @{
        TenantId = "b3cddf40-9654-4a26-86a1-779c51f69c48"
        ClientId = "24168867-3e48-4740-91e5-837454b767cc"
        CertName = "AU_PlanBsharepoint"
    }
    mymailunisaedu = @{
        TenantId = "6c2dbd5d-8f60-46c4-a7fe-15a5993fbca5"
        ClientId = "71073c64-f0aa-442a-a564-d9f743df8a28"
        CertName = "UNISA_PlanBSharePoint"
    }
    adelaideuni = @{
        TenantId = "f290baf1-9be9-4d31-9769-f910a2e39609"
        ClientId = "20c271ff-bf14-4670-9079-261299d9575a"
        CertName = "IMO_PlanBSharepoint"
    }
    planbconsulting = @{
        TenantId = "a504cd03-d5f7-44ff-9c01-42b3d10850e9"
        ClientId = "54aca153-1511-44eb-a67f-49d77a81561c"
        CertName = $null
    }
}

$td = $tenantDefaults[$TenantName]
if (-not $TenantId) { $TenantId = $td.TenantId }
if (-not $ClientId) { $ClientId = $td.ClientId }
if (-not $CertName) { $CertName = $td.CertName }

# SharePoint columns that must never be renamed (breaks views / list plumbing).
$script:ProtectedInternalNames = @(
    "ID", "ContentType", "ContentTypeId", "Attachments", "Created", "Modified",
    "Author", "Editor", "FileLeafRef", "FileRef", "FileDirRef", "GUID",
    "_UIVersionString", "AppAuthor", "AppEditor", "Edit", "LinkTitle",
    "LinkTitleNoMenu", "DocIcon", "ItemChildCount", "FolderChildCount",
    "ComplianceAssetId", "_ComplianceFlags", "_ComplianceTag"
)

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor Cyan
}

function Resolve-PlanBCertificatePath {
    param(
        [string]$Name,
        [string]$ExplicitPath
    )
    if ($ExplicitPath) {
        if (-not (Test-Path -LiteralPath $ExplicitPath)) {
            throw "Certificate file not found: $ExplicitPath"
        }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }
    if (-not $Name) { return $null }

    $candidates = @(
        (Join-Path "C:\Repos\CERT" "$Name.pfx"),
        (Join-Path "C:\Repos\PlanB\_CERT" "$Name.pfx"),
        (Join-Path "C:\Repos\PlanB\Adelaide Uni\Scripts\CERT" "$Name.pfx"),
        (Join-Path "C:\Repos\PlanB\Adelaide Uni\CERT" "$Name.pfx")
    )
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    return $null
}

function Get-PlanBCertificatePassword {
    param(
        [SecureString]$ExplicitPassword,
        [string]$Name
    )
    if ($ExplicitPassword) { return $ExplicitPassword }

    foreach ($envName in @("PLANB_PFX_PASSWORD", "EXTGUEST_PFX_PASSWORD", "PFX_PASSWORD")) {
        $plain = [Environment]::GetEnvironmentVariable($envName)
        if (-not [string]::IsNullOrWhiteSpace($plain)) {
            Write-Host ("Using PFX password from env:{0}" -f $envName) -ForegroundColor DarkGray
            return (ConvertTo-SecureString -String $plain -AsPlainText -Force)
        }
    }

    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        return (Read-Host "Enter PFX password ($Name)" -AsSecureString)
    }

    throw "PFX password required. Set `$env:PLANB_PFX_PASSWORD or pass -CertificatePassword (interactive Read-Host unavailable)."
}

function Connect-SharePointWithCertificate {
    Write-Host "Connecting to SharePoint with app-only certificate (PnP) ..." -ForegroundColor Cyan
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        throw "PnP.PowerShell module not found. Install-Module PnP.PowerShell -Scope CurrentUser"
    }
    Import-Module PnP.PowerShell -ErrorAction Stop

    if (-not $ClientId) { throw "App-only cert auth requires ClientId (set -TenantName or -ClientId)." }
    if (-not $TenantId) { throw "App-only cert auth requires TenantId (set -TenantName or -TenantId)." }

    $pfx = $null
    if (-not $CertificateThumbprint) {
        $pfx = Resolve-PlanBCertificatePath -Name $CertName -ExplicitPath $CertificatePath
        if (-not $pfx) {
            throw ("Certificate not found for '{0}'. Place {0}.pfx under C:\Repos\CERT or pass -CertificatePath." -f $CertName)
        }
        Write-Host ("Cert: {0}" -f $pfx) -ForegroundColor Cyan
        Write-Host ("App:  ClientId={0} TenantId={1}" -f $ClientId, $TenantId) -ForegroundColor DarkGray
    }

    $pwd = Get-PlanBCertificatePassword -ExplicitPassword $CertificatePassword -Name $(if ($CertName) { $CertName } else { "certificate" })

    if ($CertificateThumbprint) {
        Connect-PnPOnline -Url $SharePointSiteUrl -ClientId $ClientId -Tenant $TenantId -Thumbprint $CertificateThumbprint
    }
    else {
        Connect-PnPOnline -Url $SharePointSiteUrl -ClientId $ClientId -Tenant $TenantId `
            -CertificatePath $pfx -CertificatePassword $pwd
    }

    $script:UsePnP = $true
    Write-Host ("PnP connected to {0}" -f $SharePointSiteUrl) -ForegroundColor Green
}

function Connect-GraphForSharePoint {
    $script:GraphBearerToken = $null
    $script:UsePnP = $false

    if ($UseCertificate -or $CertificateThumbprint -or $CertificatePath) {
        Connect-SharePointWithCertificate
        return
    }

    Write-Host "Connecting to Microsoft Graph for SharePoint ..." -ForegroundColor Cyan
    Import-Module MSAL.PS -ErrorAction Stop

    $defaultPublicClientId = "14d82eec-204b-4c2f-b7e8-296a70dab67e"

    Write-Host ""
    Write-Host "Device login: follow the MSAL prompt (https://microsoft.com/devicelogin)." -ForegroundColor Yellow
    Write-Host "Consent to Sites.Manage.All (+ Sites.ReadWrite.All) when prompted." -ForegroundColor Yellow
    Write-Host "Tip: use -UseCertificate for PlanB app-only." -ForegroundColor DarkGray
    Write-Host ""

    $msalParams = @{
        ClientId   = $defaultPublicClientId
        Scopes     = @(
            "https://graph.microsoft.com/Sites.Manage.All"
            "https://graph.microsoft.com/Sites.ReadWrite.All"
        )
        DeviceCode = $true
    }
    if ($TenantId) { $msalParams.TenantId = $TenantId }

    $token = Get-MsalToken @msalParams
    if (-not $token -or -not $token.AccessToken) {
        throw "Device login failed — no access token returned."
    }
    $script:GraphBearerToken = $token.AccessToken
    $account = $null
    if ($token.Account) { $account = $token.Account.Username }
    Write-Host ("Graph device login OK{0}" -f $(if ($account) { " as $account" } else { "" })) -ForegroundColor Green
}

function Invoke-Graph {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body
    )

    if (-not $script:GraphBearerToken) {
        throw "No Graph bearer token. Connect-GraphForSharePoint must run first."
    }

    $absolute = $Uri
    if ($Uri -notmatch '^https://') {
        $absolute = "https://graph.microsoft.com" + $(if ($Uri.StartsWith("/")) { $Uri } else { "/$Uri" })
    }

    $headers = @{
        Authorization = "Bearer $($script:GraphBearerToken)"
        Accept        = "application/json"
    }

    $params = @{
        Method  = $Method
        Uri     = $absolute
        Headers = $headers
    }

    if ($null -ne $Body) {
        $headers["Content-Type"] = "application/json"
        if ($Body -is [string]) {
            $params.Body = $Body
        }
        else {
            $params.Body = ($Body | ConvertTo-Json -Depth 12 -Compress)
        }
    }

    return Invoke-RestMethod @params
}

function Get-GraphSiteId {
    param([string]$SiteUrl)

    $uri = [uri]$SiteUrl
    $hostname = $uri.Host
    $path = $uri.AbsolutePath.TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "/" }
    return (Invoke-Graph -Method GET -Uri "/v1.0/sites/${hostname}:${path}").id
}

function Test-WildcardMatch {
    param(
        [string]$Value,
        [string[]]$Patterns
    )
    foreach ($p in $Patterns) {
        if ($Value -like $p) { return $true }
    }
    return $false
}

# Decide whether a column should be renamed, and why not when it shouldn't.
function Get-RenamePlan {
    param(
        [string]$InternalName,
        [string]$CurrentDisplayName,
        [bool]$IsSystem,
        [bool]$IsReadOnly,
        [bool]$IsHidden
    )

    $skip = $null

    if ($script:ProtectedInternalNames -contains $InternalName) {
        $skip = "Protected SharePoint column"
    }
    elseif ($InternalName -eq "Title" -and -not $IncludeTitleField) {
        $skip = "Built-in Title field (pass -IncludeTitleField to rename)"
    }
    elseif ($IsSystem -and -not $IncludeSystemFields) {
        $skip = "System / base-type column (pass -IncludeSystemFields to rename)"
    }
    elseif ($IsReadOnly) {
        $skip = "Read-only column"
    }
    elseif ($IsHidden) {
        $skip = "Hidden column"
    }
    elseif (-not (Test-WildcardMatch -Value $InternalName -Patterns $Include)) {
        $skip = "Not matched by -Include"
    }
    elseif ($Exclude.Count -gt 0 -and (Test-WildcardMatch -Value $InternalName -Patterns $Exclude)) {
        $skip = "Matched by -Exclude"
    }
    elseif ($CurrentDisplayName -ceq $InternalName) {
        $skip = "Already matches InternalName"
    }

    return [pscustomobject]@{
        InternalName = $InternalName
        OldDisplay   = $CurrentDisplayName
        NewDisplay   = $InternalName
        SkipReason   = $skip
    }
}

# --- Main ---

Write-Section "Rename SharePoint column DisplayName → InternalName"
Write-Host ("Site: {0}" -f $SharePointSiteUrl)
Write-Host ("List: {0}" -f $ListTitle)
if ($WhatIf) { Write-Host "Mode: WhatIf (no changes will be written)" -ForegroundColor Yellow }

Connect-GraphForSharePoint

$plans = @()
$renamed = @()
$failed = @()

if ($script:UsePnP) {
    $list = Get-PnPList -Identity $ListTitle -ErrorAction SilentlyContinue
    if (-not $list) {
        throw ("List '{0}' not found on {1}." -f $ListTitle, $SharePointSiteUrl)
    }

    $fields = Get-PnPField -List $ListTitle
    Write-Host ("Columns on list: {0}" -f @($fields).Count) -ForegroundColor Cyan

    foreach ($f in $fields) {
        $plan = Get-RenamePlan -InternalName $f.InternalName -CurrentDisplayName $f.Title `
            -IsSystem ([bool]$f.FromBaseType) -IsReadOnly ([bool]$f.ReadOnlyField) -IsHidden ([bool]$f.Hidden)
        $plans += $plan
    }

    foreach ($p in ($plans | Where-Object { -not $_.SkipReason })) {
        if ($WhatIf) { continue }
        try {
            Set-PnPField -List $ListTitle -Identity $p.InternalName -Values @{ Title = $p.NewDisplay } | Out-Null
            $renamed += $p
            Write-Host ("  ~ {0}: '{1}' → '{2}'" -f $p.InternalName, $p.OldDisplay, $p.NewDisplay) -ForegroundColor Green
        }
        catch {
            $msg = $_.Exception.Message
            $failed += [pscustomobject]@{ InternalName = $p.InternalName; Error = $msg }
            Write-Host ("  ! FAILED {0}: {1}" -f $p.InternalName, $msg) -ForegroundColor Red
        }
    }
}
else {
    $siteId = Get-GraphSiteId -SiteUrl $SharePointSiteUrl
    Write-Host ("Graph site id: {0}" -f $siteId) -ForegroundColor Cyan

    $lists = Invoke-Graph -Method GET -Uri "/v1.0/sites/$siteId/lists?`$select=id,displayName,name,webUrl"
    $list = @($lists.value | Where-Object { $_.displayName -eq $ListTitle -or $_.name -eq $ListTitle }) | Select-Object -First 1
    if (-not $list) {
        throw ("List '{0}' not found on {1}." -f $ListTitle, $SharePointSiteUrl)
    }
    $listId = $list.id

    $columns = Invoke-Graph -Method GET -Uri "/v1.0/sites/$siteId/lists/$listId/columns"
    $cols = @($columns.value)
    Write-Host ("Columns on list: {0}" -f $cols.Count) -ForegroundColor Cyan

    foreach ($c in $cols) {
        # Graph doesn't expose FromBaseType; treat the standard "_Hidden"/"Base Columns" groups as system.
        $isSystem = ($c.columnGroup -in @("_Hidden", "Base Columns", "Core Contact and Calendar Columns", "Core Document Columns", "Core Task and Issue Columns"))
        $plan = Get-RenamePlan -InternalName $c.name -CurrentDisplayName $c.displayName `
            -IsSystem $isSystem -IsReadOnly ([bool]$c.readOnly) -IsHidden ([bool]$c.hidden)
        $plan | Add-Member -NotePropertyName ColumnId -NotePropertyValue $c.id -Force
        $plans += $plan
    }

    foreach ($p in ($plans | Where-Object { -not $_.SkipReason })) {
        if ($WhatIf) { continue }
        try {
            Invoke-Graph -Method PATCH -Uri "/v1.0/sites/$siteId/lists/$listId/columns/$($p.ColumnId)" `
                -Body @{ displayName = $p.NewDisplay } | Out-Null
            $renamed += $p
            Write-Host ("  ~ {0}: '{1}' → '{2}'" -f $p.InternalName, $p.OldDisplay, $p.NewDisplay) -ForegroundColor Green
        }
        catch {
            $msg = $_.Exception.Message
            if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
            $failed += [pscustomobject]@{ InternalName = $p.InternalName; Error = $msg }
            Write-Host ("  ! FAILED {0}: {1}" -f $p.InternalName, $msg) -ForegroundColor Red
        }
    }
}

$toRename = @($plans | Where-Object { -not $_.SkipReason })
$skipped = @($plans | Where-Object { $_.SkipReason })

if ($WhatIf) {
    Write-Section "WhatIf — planned renames"
    foreach ($p in $toRename) {
        Write-Host ("  {0}: '{1}' → '{2}'" -f $p.InternalName, $p.OldDisplay, $p.NewDisplay)
    }
}

Write-Section "Skipped"
foreach ($s in $skipped) {
    Write-Host ("  SKIP {0} ('{1}'): {2}" -f $s.InternalName, $s.OldDisplay, $s.SkipReason) -ForegroundColor DarkYellow
}

# Report (also acts as the undo source — OldDisplay is the pre-run DisplayName)
$reportPath = Join-Path $ExportDir ("rename-displaynames-{0}.csv" -f ($ListTitle -replace '[^A-Za-z0-9]', ''))
$plans |
    Select-Object InternalName, OldDisplay, NewDisplay, SkipReason,
        @{ n = "Action"; e = { if ($_.SkipReason) { "Skipped" } elseif ($WhatIf) { "WouldRename" } else { "Renamed" } } } |
    Export-Csv -Path $reportPath -NoTypeInformation -Encoding UTF8

Write-Section "Done"
Write-Host ("Columns inspected: {0}" -f $plans.Count)
Write-Host ("{0}: {1}" -f $(if ($WhatIf) { "Would rename" } else { "Renamed" }), $(if ($WhatIf) { $toRename.Count } else { $renamed.Count }))
Write-Host ("Skipped:           {0}" -f $skipped.Count)
Write-Host ("Failed:            {0}" -f $failed.Count)
Write-Host ("Report CSV:        {0}" -f $reportPath)

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed columns:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.InternalName, $_.Error) -ForegroundColor Red }
    exit 1
}
