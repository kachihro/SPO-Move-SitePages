# Export a Dataverse table schema and create a matching SharePoint list.
# Uses Dynamics LogicalName as SharePoint InternalName; maps attribute types to SP field types.
#
# Prerequisites:
#   - Power Platform CLI (pac) authenticated to the target environment
#   - Azure CLI (az) signed in (Dataverse Web API bearer token)
#   - PnP.PowerShell (cert / app-only SharePoint) and/or MSAL.PS (device login)
#
# SharePoint auth (same pattern as Adelaide Uni\Scripts):
#   A) Certificate (recommended for demoplanb):
#        .\EXPORT-DV-TO-SPLIST.ps1 -UseCertificate
#        # resolves PlanBDev_PlanBSharePoint.pfx under C:\Repos\CERT or ...\Adelaide Uni\Scripts\CERT
#        # password: prompt, or set $env:PLANB_PFX_PASSWORD (same idea as EXTGUEST_PFX_PASSWORD)
#   B) Device login:
#        .\EXPORT-DV-TO-SPLIST.ps1   # Get-MsalToken -DeviceCode (Sites.Manage.All)
#
# Usage:
#   .\EXPORT-DV-TO-SPLIST.ps1 -WhatIf
#   .\EXPORT-DV-TO-SPLIST.ps1 -UseCertificate
#   .\EXPORT-DV-TO-SPLIST.ps1 -UseCertificate -Force
#   .\EXPORT-DV-TO-SPLIST.ps1 -TenantName demoplanb -UseCertificate
#   .\EXPORT-DV-TO-SPLIST.ps1 -CertificatePath "C:\Repos\CERT\PlanBDev_PlanBSharePoint.pfx"

param(
    [string]$EnvironmentId = "ef4a3b97-4158-e1dd-9f06-75af6c9f86ca",
    [string]$EntityMetadataId = "56cb0a04-59b5-4065-bb28-5c26b924d8e6",
    [string]$EnvironmentUrl,
    [string]$SharePointSiteUrl = "https://demoplanb.sharepoint.com/sites/AALBuildingApprovals",
    [string]$ListTitle,
    [switch]$WhatIf,
    [switch]$Force,
    [switch]$SkipAuth,
    # Same tenant switch style as Adelaide Uni\Scripts\_CUTOVER\SPO\Create-ListItems.ps1
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

# --- Tenant / cert defaults (mirrors Adelaide Uni Scripts tenant switch) ---
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

    # Non-interactive support (same idea as EXTGUEST_PFX_PASSWORD in Adelaide Uni scripts)
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

# SharePoint internal name max length
$script:SpInternalNameMaxLen = 32

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor Cyan
}

function Invoke-PacCapture {
    param([string[]]$PacArgs)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & pac @PacArgs 2>&1
        return @{
            ExitCode = $LASTEXITCODE
            Output   = @($output | ForEach-Object { "$_" })
        }
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-LocalizedLabel {
    param($LocalizedLabelsContainer)
    if ($null -eq $LocalizedLabelsContainer) { return $null }
    $labels = $LocalizedLabelsContainer.LocalizedLabels
    if ($labels -and $labels.Count -gt 0) {
        $en = $labels | Where-Object { $_.LanguageCode -eq 1033 } | Select-Object -First 1
        if ($en -and $en.Label) { return [string]$en.Label }
        if ($labels[0].Label) { return [string]$labels[0].Label }
    }
    if ($LocalizedLabelsContainer.UserLocalizedLabel -and $LocalizedLabelsContainer.UserLocalizedLabel.Label) {
        return [string]$LocalizedLabelsContainer.UserLocalizedLabel.Label
    }
    return $null
}

function Get-RequiredLevelValue {
    param($RequiredLevel)
    if ($null -eq $RequiredLevel) { return "None" }
    if ($RequiredLevel -is [string]) { return $RequiredLevel }
    if ($RequiredLevel.Value) { return [string]$RequiredLevel.Value }
    return "None"
}

function Resolve-EnvironmentUrl {
    param(
        [string]$EnvId,
        [string]$EnvUrl
    )

    if ($EnvUrl) {
        return $EnvUrl.TrimEnd('/')
    }

    Write-Host "Resolving environment URL for $EnvId ..." -ForegroundColor Cyan
    $result = Invoke-PacCapture -PacArgs @("admin", "list")
    if ($result.ExitCode -ne 0) {
        throw ("pac admin list failed:`n{0}" -f ($result.Output -join "`n"))
    }

    foreach ($line in $result.Output) {
        if ($line -match $EnvId -and $line -match '(https://[^\s]+\.dynamics\.com)') {
            return $Matches[1].TrimEnd('/')
        }
    }

    $who = Invoke-PacCapture -PacArgs @("org", "who")
    foreach ($line in $who.Output) {
        if ($line -match '(https://[^\s]+\.dynamics\.com)') {
            Write-Host "Falling back to active pac org URL." -ForegroundColor Yellow
            return $Matches[1].TrimEnd('/')
        }
    }

    throw "Could not resolve EnvironmentUrl for EnvironmentId $EnvId. Pass -EnvironmentUrl explicitly."
}

function Get-DataverseAccessToken {
    param([string]$OrgUrl)

    Write-Host "Acquiring Dataverse access token via az ..." -ForegroundColor Cyan
    $resource = $OrgUrl.TrimEnd('/')
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $raw = & az account get-access-token --resource $resource --query accessToken -o tsv 2>&1
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace("$raw")) {
            throw ("az account get-access-token failed. Sign in with 'az login'. Details:`n{0}" -f ($raw | ForEach-Object { "$_" } | Out-String))
        }
        return ("$raw").Trim()
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Invoke-DataverseGet {
    param(
        [string]$OrgUrl,
        [string]$Token,
        [string]$RelativeUrl
    )

    $uri = "{0}/api/data/v9.2/{1}" -f $OrgUrl.TrimEnd('/'), $RelativeUrl.TrimStart('/')
    $headers = @{
        Authorization    = "Bearer $Token"
        Accept           = "application/json"
        "OData-MaxVersion" = "4.0"
        "OData-Version"  = "4.0"
    }

    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}

function Get-OptionLabels {
    param($AttributeMeta)

    $options = @()
    $sets = @()
    if ($AttributeMeta.OptionSet) { $sets += $AttributeMeta.OptionSet }
    if ($AttributeMeta.GlobalOptionSet) { $sets += $AttributeMeta.GlobalOptionSet }

    foreach ($set in $sets) {
        if (-not $set.Options) { continue }
        foreach ($opt in $set.Options) {
            $label = Get-LocalizedLabel $opt.Label
            if ([string]::IsNullOrWhiteSpace($label)) { $label = [string]$opt.Value }
            $options += [pscustomobject]@{
                Value = $opt.Value
                Label = $label
            }
        }
    }
    return $options
}

function ConvertTo-SafeSpInternalName {
    param(
        [string]$LogicalName,
        [hashtable]$UsedNames
    )

    # SharePoint: must start with letter; letters, numbers, underscore only; max 32 chars
    $name = $LogicalName -replace '[^A-Za-z0-9_]', '_'
    if ($name -notmatch '^[A-Za-z]') {
        $name = "f_$name"
    }
    if ($name.Length -gt $script:SpInternalNameMaxLen) {
        $name = $name.Substring(0, $script:SpInternalNameMaxLen)
    }

    $candidate = $name
    $i = 2
    while ($UsedNames.ContainsKey($candidate.ToLowerInvariant())) {
        $suffix = "_$i"
        $trimTo = $script:SpInternalNameMaxLen - $suffix.Length
        if ($trimTo -lt 1) { $trimTo = 1 }
        $candidate = $name.Substring(0, [Math]::Min($name.Length, $trimTo)) + $suffix
        $i++
    }

    $UsedNames[$candidate.ToLowerInvariant()] = $true
    return $candidate
}

function Get-SharePointFieldMapping {
    param($Attribute)

    $type = [string]$Attribute.AttributeType
    if ($Attribute.AttributeTypeName -and $Attribute.AttributeTypeName.Value) {
        # Prefer typed name when present (e.g. Virtual)
        $typeName = [string]$Attribute.AttributeTypeName.Value
        if ($typeName -and $typeName -ne "Virtual") {
            # keep AttributeType for mapping; Virtual handled below
        }
    }

    $displayName = Get-LocalizedLabel $Attribute.DisplayName
    if ([string]::IsNullOrWhiteSpace($displayName)) {
        $displayName = $Attribute.LogicalName
    }

    $requiredLevel = Get-RequiredLevelValue $Attribute.RequiredLevel
    $required = ($requiredLevel -eq "ApplicationRequired")

    $maxLength = $null
    if ($null -ne $Attribute.MaxLength) { $maxLength = [int]$Attribute.MaxLength }

    $dateOnly = $false
    if ($Attribute.Format -eq "DateOnly" -or ($Attribute.Format -and "$($Attribute.Format)" -eq "DateOnly")) {
        $dateOnly = $true
    }
    if ($Attribute.DateTimeBehavior -and $Attribute.DateTimeBehavior.Value -eq "DateOnly") {
        $dateOnly = $true
    }

    $choices = @()
    if ($Attribute.PSObject.Properties.Name -contains "ResolvedChoices" -and $Attribute.ResolvedChoices) {
        $choices = @($Attribute.ResolvedChoices | ForEach-Object { $_.Label })
    }

    $spType = $null
    $skipReason = $null

    switch -Regex ($type) {
        '^(String)$' {
            if ($maxLength -and $maxLength -gt 255) {
                $spType = "Note"
            }
            else {
                $spType = "Text"
            }
        }
        '^(Memo)$' { $spType = "Note" }
        '^(Integer|BigInt)$' { $spType = "Number" }
        '^(Decimal|Double)$' { $spType = "Number" }
        '^(Money)$' { $spType = "Currency" }
        '^(Boolean)$' { $spType = "Boolean" }
        '^(DateTime)$' { $spType = "DateTime" }
        '^(Picklist|Status|State)$' { $spType = "Choice" }
        '^(MultiSelectPicklist)$' { $spType = "MultiChoice" }
        '^(Lookup|Customer|Owner)$' { $spType = "Text" }
        '^(Uniqueidentifier)$' { $spType = "Text" }
        '^(File|Image)$' {
            $skipReason = "File/Image requires library handling; skipped"
        }
        '^(Virtual|PartyList|EntityName|CalendarRules|ManagedProperty)$' {
            $skipReason = "AttributeType '$type' has no SharePoint equivalent"
        }
        default {
            $skipReason = "Unhandled AttributeType '$type'"
        }
    }

    # Skip composed attributes (e.g. yomi of another field)
    if ($Attribute.AttributeOf) {
        $skipReason = "Composed attribute (AttributeOf=$($Attribute.AttributeOf))"
        $spType = $null
    }

    return [pscustomobject]@{
        LogicalName       = $Attribute.LogicalName
        SchemaName        = $Attribute.SchemaName
        DisplayName       = $displayName
        AttributeType     = $type
        Required          = $required
        MaxLength         = $maxLength
        DateOnly          = $dateOnly
        Choices           = $choices
        SharePointType    = $spType
        SkipReason        = $skipReason
        IsCustomAttribute = [bool]$Attribute.IsCustomAttribute
        IsPrimaryId       = [bool]$Attribute.IsPrimaryId
        IsPrimaryName     = [bool]$Attribute.IsPrimaryName
    }
}

function New-FieldXml {
    param(
        [pscustomobject]$Mapped,
        [string]$InternalName
    )

    $id = [guid]::NewGuid().ToString()
    $display = [System.Security.SecurityElement]::Escape($Mapped.DisplayName)
    $required = if ($Mapped.Required) { "TRUE" } else { "FALSE" }
    $name = [System.Security.SecurityElement]::Escape($InternalName)

    switch ($Mapped.SharePointType) {
        "Text" {
            $max = 255
            if ($Mapped.MaxLength -and $Mapped.MaxLength -gt 0 -and $Mapped.MaxLength -le 255) {
                $max = $Mapped.MaxLength
            }
            return "<Field Type='Text' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' MaxLength='$max' />"
        }
        "Note" {
            return "<Field Type='Note' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' NumLines='6' RichText='FALSE' />"
        }
        "Number" {
            $decimals = if ($Mapped.AttributeType -match '^(Decimal|Double)$') { "2" } else { "0" }
            return "<Field Type='Number' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' Decimals='$decimals' />"
        }
        "Currency" {
            return "<Field Type='Currency' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' Decimals='2' />"
        }
        "Boolean" {
            return "<Field Type='Boolean' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required'><Default>0</Default></Field>"
        }
        "DateTime" {
            $format = if ($Mapped.DateOnly) { "DateOnly" } else { "DateTime" }
            return "<Field Type='DateTime' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' Format='$format' />"
        }
        "Choice" {
            $choiceXml = ($Mapped.Choices | ForEach-Object {
                    $c = [System.Security.SecurityElement]::Escape([string]$_)
                    "    <CHOICE>$c</CHOICE>"
                }) -join "`n"
            if ([string]::IsNullOrWhiteSpace($choiceXml)) { $choiceXml = "    <CHOICE>Option1</CHOICE>" }
            return "<Field Type='Choice' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required' Format='Dropdown'><CHOICES>`n$choiceXml`n  </CHOICES></Field>"
        }
        "MultiChoice" {
            $choiceXml = ($Mapped.Choices | ForEach-Object {
                    $c = [System.Security.SecurityElement]::Escape([string]$_)
                    "    <CHOICE>$c</CHOICE>"
                }) -join "`n"
            if ([string]::IsNullOrWhiteSpace($choiceXml)) { $choiceXml = "    <CHOICE>Option1</CHOICE>" }
            return "<Field Type='MultiChoice' Name='$name' StaticName='$name' ID='{$id}' DisplayName='$display' Required='$required'><CHOICES>`n$choiceXml`n  </CHOICES></Field>"
        }
        default {
            throw "Cannot build Field XML for SharePointType '$($Mapped.SharePointType)'"
        }
    }
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

    # Same Connect-PnPOnline shape as Adelaide Uni\Scripts\_CUTOVER\SPO\Create-ListItems.ps1
    if ($CertificateThumbprint) {
        Connect-PnPOnline -Url $SharePointSiteUrl -ClientId $ClientId -Tenant $TenantId -Thumbprint $CertificateThumbprint
    }
    else {
        Connect-PnPOnline -Url $SharePointSiteUrl -ClientId $ClientId -Tenant $TenantId `
            -CertificatePath $pfx -CertificatePassword $pwd
    }

    $script:UsePnPProvisioning = $true
    Write-Host ("PnP connected to {0}" -f $SharePointSiteUrl) -ForegroundColor Green
}

function Connect-GraphForSharePoint {
    $script:GraphBearerToken = $null
    $script:UsePnPProvisioning = $false

    # Cert mode when -UseCertificate or an explicit cert path/thumbprint is supplied
    if ($UseCertificate -or $CertificateThumbprint -or $CertificatePath) {
        Connect-SharePointWithCertificate
        return
    }

    Write-Host "Connecting to Microsoft Graph for SharePoint provisioning ..." -ForegroundColor Cyan
    Import-Module MSAL.PS -ErrorAction Stop

    # Microsoft Graph PowerShell public client (device code + Sites.* scopes)
    $defaultPublicClientId = "14d82eec-204b-4c2f-b7e8-296a70dab67e"

    Write-Host ""
    Write-Host "Device login: follow the MSAL prompt (https://microsoft.com/devicelogin)." -ForegroundColor Yellow
    Write-Host "Consent to Sites.Manage.All (+ Sites.ReadWrite.All) when prompted." -ForegroundColor Yellow
    Write-Host ("Using Microsoft Graph PowerShell public client: {0}" -f $defaultPublicClientId) -ForegroundColor DarkGray
    Write-Host "Tip: use -UseCertificate for PlanB app-only (same as Adelaide Uni Scripts)." -ForegroundColor DarkGray
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

    # Build absolute Graph URL
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

    # DELETE / 204 often returns empty body — don't fail on that
    try {
        return Invoke-RestMethod @params
    }
    catch {
        $response = $_.Exception.Response
        if ($response -and [int]$response.StatusCode -eq 204) {
            return $null
        }
        # Some hosts throw on empty 200/204 content
        if ($Method -eq "DELETE" -and $_.Exception.Message -match 'Unexpected character|empty|null') {
            return $null
        }
        throw
    }
}

function Get-GraphSiteId {
    param([string]$SiteUrl)

    $uri = [uri]$SiteUrl
    $hostname = $uri.Host
    $path = $uri.AbsolutePath.TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "/" }
    $graphUri = "/v1.0/sites/${hostname}:${path}"
    $site = Invoke-Graph -Method GET -Uri $graphUri
    return $site.id
}

function ConvertTo-GraphColumn {
    param(
        [pscustomobject]$Mapped,
        [string]$InternalName
    )

    $col = [ordered]@{
        name        = $InternalName
        displayName = $Mapped.DisplayName
        description = "Dataverse:$($Mapped.LogicalName) ($($Mapped.AttributeType))"
        required    = [bool]$Mapped.Required
    }

    switch ($Mapped.SharePointType) {
        "Text" {
            $max = 255
            if ($Mapped.MaxLength -and $Mapped.MaxLength -gt 0 -and $Mapped.MaxLength -le 255) {
                $max = [int]$Mapped.MaxLength
            }
            $col.text = @{ maxLength = $max }
        }
        "Note" {
            $col.text = @{
                allowMultipleLines = $true
                textType           = "plain"
            }
        }
        "Number" {
            $decimals = if ($Mapped.AttributeType -match '^(Decimal|Double)$') { 2 } else { 0 }
            $col.number = @{ decimalPlaces = "$decimals" }
        }
        "Currency" {
            $col.currency = @{ locale = "en-AU" }
        }
        "Boolean" {
            $col.boolean = @{}
        }
        "DateTime" {
            $fmt = if ($Mapped.DateOnly) { "dateOnly" } else { "dateTime" }
            $col.dateTime = @{ format = $fmt }
        }
        "Choice" {
            $choices = @($Mapped.Choices | ForEach-Object { [string]$_ } | Where-Object { $_ })
            if ($choices.Count -eq 0) { $choices = @("Option1") }
            $col.choice = @{
                allowTextEntry = $false
                choices        = $choices
                displayAs      = "dropDownMenu"
            }
        }
        "MultiChoice" {
            $choices = @($Mapped.Choices | ForEach-Object { [string]$_ } | Where-Object { $_ })
            if ($choices.Count -eq 0) { $choices = @("Option1") }
            $col.choice = @{
                allowTextEntry = $false
                choices        = $choices
                displayAs      = "checkBoxes"
            }
        }
        default {
            throw "Cannot build Graph column for SharePointType '$($Mapped.SharePointType)'"
        }
    }

    return $col
}

# --- Main ---

Write-Section "Dataverse schema → SharePoint list"

# 1. Auth
if (-not $SkipAuth) {
    if ($EnvironmentUrl) {
        Write-Host "Authenticating pac to $EnvironmentUrl ..." -ForegroundColor Cyan
        pac auth create --environment $EnvironmentUrl
        if ($LASTEXITCODE -ne 0) { throw "pac auth create failed." }
    }
    else {
        Write-Host "Using current pac auth profile (pass -EnvironmentUrl to switch)." -ForegroundColor Yellow
        pac auth who
        if ($LASTEXITCODE -ne 0) {
            throw "No active pac auth profile. Re-run with -EnvironmentUrl <org url>."
        }
    }
}

$orgUrl = Resolve-EnvironmentUrl -EnvId $EnvironmentId -EnvUrl $EnvironmentUrl
Write-Host ("Dataverse org: {0}" -f $orgUrl) -ForegroundColor Green

$token = Get-DataverseAccessToken -OrgUrl $orgUrl

# 2. Entity + attributes
Write-Section "Fetching entity metadata"
$entitySelect = "LogicalName,SchemaName,DisplayName,PrimaryNameAttribute,PrimaryIdAttribute,MetadataId"
$entityPath = "EntityDefinitions($EntityMetadataId)?`$select=$entitySelect"
$entity = Invoke-DataverseGet -OrgUrl $orgUrl -Token $token -RelativeUrl $entityPath

$entityLogicalName = $entity.LogicalName
$entityDisplayName = Get-LocalizedLabel $entity.DisplayName
if ([string]::IsNullOrWhiteSpace($entityDisplayName)) { $entityDisplayName = $entityLogicalName }
if (-not $ListTitle) { $ListTitle = $entityDisplayName }

Write-Host ("Entity: {0} ({1})" -f $entityDisplayName, $entityLogicalName) -ForegroundColor Green
Write-Host ("Primary name: {0} | Primary id: {1}" -f $entity.PrimaryNameAttribute, $entity.PrimaryIdAttribute)

# MaxLength/Format/DateTimeBehavior are NOT on base AttributeMetadata — fetch via typed casts below.
$attrSelect = "LogicalName,SchemaName,DisplayName,AttributeType,AttributeTypeName,RequiredLevel,IsValidForCreate,IsValidForUpdate,IsCustomAttribute,IsPrimaryId,IsPrimaryName,AttributeOf"
$attrsPath = "EntityDefinitions($EntityMetadataId)/Attributes?`$select=$attrSelect"
$attrsResponse = Invoke-DataverseGet -OrgUrl $orgUrl -Token $token -RelativeUrl $attrsPath
$attributes = @($attrsResponse.value)

Write-Host ("Attributes returned: {0}" -f $attributes.Count) -ForegroundColor Cyan

# Enrich typed attributes (options + MaxLength / DateTime format)
Write-Host "Fetching typed attribute metadata (choices, string length, datetime format) ..." -ForegroundColor Cyan
$choiceByLogical = @{}
$stringMetaByLogical = @{}
$dateMetaByLogical = @{}

$typedQueries = @(
    @{ Cast = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"; Select = "LogicalName"; Expand = "OptionSet(`$select=Options),GlobalOptionSet(`$select=Options)" },
    @{ Cast = "Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata"; Select = "LogicalName"; Expand = "OptionSet(`$select=Options),GlobalOptionSet(`$select=Options)" },
    @{ Cast = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"; Select = "LogicalName"; Expand = "OptionSet" },
    @{ Cast = "Microsoft.Dynamics.CRM.StatusAttributeMetadata"; Select = "LogicalName"; Expand = "OptionSet(`$select=Options)" },
    @{ Cast = "Microsoft.Dynamics.CRM.StateAttributeMetadata"; Select = "LogicalName"; Expand = "OptionSet(`$select=Options)" },
    @{ Cast = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; Select = "LogicalName,MaxLength,Format"; Expand = $null },
    @{ Cast = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; Select = "LogicalName,MaxLength"; Expand = $null },
    @{ Cast = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; Select = "LogicalName,Format,DateTimeBehavior"; Expand = $null }
)

foreach ($q in $typedQueries) {
    $path = "EntityDefinitions($EntityMetadataId)/Attributes/$($q.Cast)?`$select=$($q.Select)"
    if ($q.Expand) {
        $path += "&`$expand=$($q.Expand)"
    }
    try {
        $typed = Invoke-DataverseGet -OrgUrl $orgUrl -Token $token -RelativeUrl $path
        foreach ($item in @($typed.value)) {
            if ($q.Cast -match 'Picklist|Boolean|Status|State') {
                $choiceByLogical[$item.LogicalName] = Get-OptionLabels $item
            }
            elseif ($q.Cast -match 'String|Memo') {
                $stringMetaByLogical[$item.LogicalName] = $item
            }
            elseif ($q.Cast -match 'DateTime') {
                $dateMetaByLogical[$item.LogicalName] = $item
            }
        }
    }
    catch {
        Write-Host ("Warning: typed attribute query failed for {0}: {1}" -f $q.Cast, $_.Exception.Message) -ForegroundColor DarkYellow
    }
}

foreach ($a in $attributes) {
    if ($choiceByLogical.ContainsKey($a.LogicalName)) {
        $a | Add-Member -NotePropertyName ResolvedChoices -NotePropertyValue $choiceByLogical[$a.LogicalName] -Force
    }
    if ($stringMetaByLogical.ContainsKey($a.LogicalName)) {
        $sm = $stringMetaByLogical[$a.LogicalName]
        $a | Add-Member -NotePropertyName MaxLength -NotePropertyValue $sm.MaxLength -Force
        if ($sm.Format) { $a | Add-Member -NotePropertyName Format -NotePropertyValue $sm.Format -Force }
    }
    if ($dateMetaByLogical.ContainsKey($a.LogicalName)) {
        $dm = $dateMetaByLogical[$a.LogicalName]
        if ($dm.Format) { $a | Add-Member -NotePropertyName Format -NotePropertyValue $dm.Format -Force }
        if ($dm.DateTimeBehavior) { $a | Add-Member -NotePropertyName DateTimeBehavior -NotePropertyValue $dm.DateTimeBehavior -Force }
    }
}

# 3. Map columns
Write-Section "Mapping columns to SharePoint fields"
$usedInternalNames = @{}
# Reserve SharePoint system names
@("Title", "ID", "ContentType", "Attachments", "Modified", "Created", "Author", "Editor", "FileLeafRef") | ForEach-Object {
    $usedInternalNames[$_.ToLowerInvariant()] = $true
}

$mapped = @()
$skipped = @()

foreach ($a in ($attributes | Sort-Object LogicalName)) {
    $m = Get-SharePointFieldMapping -Attribute $a
    if ($m.SkipReason) {
        $skipped += $m
        continue
    }

    $internal = ConvertTo-SafeSpInternalName -LogicalName $m.LogicalName -UsedNames $usedInternalNames
    $m | Add-Member -NotePropertyName SharePointInternalName -NotePropertyValue $internal -Force
    $m | Add-Member -NotePropertyName InternalNameTruncated -NotePropertyValue ($internal -ne $m.LogicalName) -Force
    $mapped += $m
}

Write-Host ("Mappable columns: {0}" -f $mapped.Count) -ForegroundColor Green
Write-Host ("Skipped columns:  {0}" -f $skipped.Count) -ForegroundColor Yellow

foreach ($s in $skipped) {
    Write-Host ("  SKIP {0} ({1}): {2}" -f $s.LogicalName, $s.AttributeType, $s.SkipReason) -ForegroundColor DarkYellow
}

foreach ($m in $mapped) {
    $trunc = if ($m.InternalNameTruncated) { " [internal truncated → $($m.SharePointInternalName)]" } else { "" }
    Write-Host ("  {0} :: {1} → {2}{3}" -f $m.LogicalName, $m.AttributeType, $m.SharePointType, $trunc)
}

# 4. Write export JSON
$schemaPath = Join-Path $ExportDir ("{0}-schema.json" -f $entityLogicalName)
$exportObject = [ordered]@{
    ExportedAt           = (Get-Date).ToString("o")
    EnvironmentId        = $EnvironmentId
    EnvironmentUrl       = $orgUrl
    EntityMetadataId     = $EntityMetadataId
    LogicalName          = $entityLogicalName
    DisplayName          = $entityDisplayName
    PrimaryNameAttribute = $entity.PrimaryNameAttribute
    PrimaryIdAttribute   = $entity.PrimaryIdAttribute
    SharePointSiteUrl    = $SharePointSiteUrl
    ListTitle            = $ListTitle
    Columns              = $mapped
    Skipped              = $skipped
}
$exportObject | ConvertTo-Json -Depth 8 | Set-Content -Path $schemaPath -Encoding UTF8
Write-Host ("Wrote schema export: {0}" -f $schemaPath) -ForegroundColor Green

if ($WhatIf) {
    Write-Section "WhatIf — no SharePoint changes"
    Write-Host ("Would create list '{0}' on {1}" -f $ListTitle, $SharePointSiteUrl)
    Write-Host ("Would add {0} columns." -f $mapped.Count)
    Write-Host "Re-run without -WhatIf to provision."
    return
}

# 5. SharePoint provision
Write-Section "Provisioning SharePoint list"
Connect-GraphForSharePoint

$created = 0
$failed = @()
$listUrl = $null

if ($script:UsePnPProvisioning) {
    $existing = Get-PnPList -Identity $ListTitle -ErrorAction SilentlyContinue
    if ($existing) {
        if ($Force) {
            Write-Host ("Removing existing list '{0}' (-Force) ..." -f $ListTitle) -ForegroundColor Yellow
            Remove-PnPList -Identity $ListTitle -Force
        }
        else {
            throw ("List '{0}' already exists on {1}. Pass -Force to delete and recreate." -f $ListTitle, $SharePointSiteUrl)
        }
    }

    Write-Host ("Creating list '{0}' (PnP) ..." -f $ListTitle) -ForegroundColor Cyan
    New-PnPList -Title $ListTitle -Template GenericList -OnQuickLaunch | Out-Null

    foreach ($m in $mapped) {
        $internal = $m.SharePointInternalName
        try {
            $xml = New-FieldXml -Mapped $m -InternalName $internal
            Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml | Out-Null
            $created++
            Write-Host ("  + {0} ({1})" -f $internal, $m.SharePointType) -ForegroundColor Green
        }
        catch {
            $msg = $_.Exception.Message
            $failed += [pscustomobject]@{ LogicalName = $m.LogicalName; InternalName = $internal; Error = $msg }
            Write-Host ("  ! FAILED {0}: {1}" -f $internal, $msg) -ForegroundColor Red
        }
    }

    $web = Get-PnPWeb
    $list = Get-PnPList -Identity $ListTitle
    $listUrl = "{0}{1}" -f $web.Url.TrimEnd('/'), $list.RootFolder.ServerRelativeUrl
}
else {
    $siteId = Get-GraphSiteId -SiteUrl $SharePointSiteUrl
    Write-Host ("Graph site id: {0}" -f $siteId) -ForegroundColor Cyan

    $listsUri = "/v1.0/sites/$siteId/lists?`$select=id,displayName,webUrl,name"
    $lists = Invoke-Graph -Method GET -Uri $listsUri
    $existing = @($lists.value | Where-Object { $_.displayName -eq $ListTitle }) | Select-Object -First 1

    if ($existing) {
        if ($Force) {
            Write-Host ("Removing existing list '{0}' (-Force) ..." -f $ListTitle) -ForegroundColor Yellow
            Invoke-Graph -Method DELETE -Uri "/v1.0/sites/$siteId/lists/$($existing.id)" | Out-Null
            Start-Sleep -Seconds 3
        }
        else {
            throw ("List '{0}' already exists on {1}. Pass -Force to delete and recreate." -f $ListTitle, $SharePointSiteUrl)
        }
    }

    Write-Host ("Creating list '{0}' (Graph) ..." -f $ListTitle) -ForegroundColor Cyan
    $createBody = @{
        displayName = $ListTitle
        description = "Provisioned from Dataverse entity $entityLogicalName"
        list        = @{ template = "genericList" }
    }
    $newList = Invoke-Graph -Method POST -Uri "/v1.0/sites/$siteId/lists" -Body $createBody
    $listId = $newList.id
    $listUrl = $newList.webUrl
    Write-Host ("Created list id: {0}" -f $listId) -ForegroundColor Green

    $columnsUri = "/v1.0/sites/$siteId/lists/$listId/columns"

    foreach ($m in $mapped) {
        $internal = $m.SharePointInternalName
        try {
            $colBody = ConvertTo-GraphColumn -Mapped $m -InternalName $internal
            Invoke-Graph -Method POST -Uri $columnsUri -Body $colBody | Out-Null
            $created++
            Write-Host ("  + {0} ({1})" -f $internal, $m.SharePointType) -ForegroundColor Green
        }
        catch {
            $msg = $_.Exception.Message
            if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
                $msg = $_.ErrorDetails.Message
            }
            $failed += [pscustomobject]@{ LogicalName = $m.LogicalName; InternalName = $internal; Error = $msg }
            Write-Host ("  ! FAILED {0}: {1}" -f $internal, $msg) -ForegroundColor Red
        }
    }
}

Write-Section "Done"
Write-Host ("List URL:     {0}" -f $listUrl) -ForegroundColor Green
Write-Host ("Columns added: {0} / {1}" -f $created, $mapped.Count)
Write-Host ("Skipped:       {0}" -f $skipped.Count)
Write-Host ("Failed:        {0}" -f $failed.Count)
Write-Host ("Schema JSON:   {0}" -f $schemaPath)

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed columns:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.InternalName, $_.Error) -ForegroundColor Red }
    exit 1
}
