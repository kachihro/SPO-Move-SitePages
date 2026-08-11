# Check Dataverse tables that commonly drive File / Database capacity.
# Focused on leftovers from pac pcf push / solution deployments (web resources, PCF controls, temp solutions).
#
# Usage:
#   .\CHECK-STORAGE.ps1
#   .\CHECK-STORAGE.ps1 -EnvironmentUrl "https://orga3a7d35b.crm6.dynamics.com"
#   .\CHECK-STORAGE.ps1 -AllAuthEnvironments
#   .\CHECK-STORAGE.ps1 -Top 40

param(
    [string]$EnvironmentUrl,
    [switch]$AllAuthEnvironments,
    [switch]$SkipAuth,
    [int]$Top = 30
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor Cyan
}

function Format-Bytes {
    param([object]$Bytes)
    if ($null -eq $Bytes -or $Bytes -eq "") { return "0 B" }
    $n = [double]$Bytes
    if ($n -lt 1024) { return ("{0:N0} B" -f $n) }
    if ($n -lt 1MB) { return ("{0:N1} KB" -f ($n / 1KB)) }
    if ($n -lt 1GB) { return ("{0:N2} MB" -f ($n / 1MB)) }
    return ("{0:N2} GB" -f ($n / 1GB))
}

function Invoke-Fetch {
    param(
        [string]$Label,
        [string]$Xml,
        [string]$Env
    )

    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("dv-fetch-{0}.xml" -f [guid]::NewGuid().ToString("N"))
    try {
        Set-Content -Path $tmp -Value $Xml -Encoding UTF8
        Write-Host ""
        Write-Host ("-- {0} --" -f $Label) -ForegroundColor Yellow
        $pacArgs = @("env", "fetch", "--xmlFile", $tmp)
        if ($Env) {
            $pacArgs += @("--environment", $Env)
        }
        & pac @pacArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Host ("Query failed (exit {0}). Attribute/table may be unavailable in this env." -f $LASTEXITCODE) -ForegroundColor DarkYellow
        }
    }
    finally {
        Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
    }
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

function Get-AuthEnvironmentUrls {
    $result = Invoke-PacCapture -PacArgs @("org", "list")
    if ($result.ExitCode -ne 0) {
        throw "pac org list failed. Authenticate first (pac auth create)."
    }

    $urls = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $result.Output) {
        if ($line -match 'https://[^\s]+\.dynamics\.com/?') {
            $urls.Add($Matches[0].TrimEnd('/'))
        }
    }
    return @($urls | Select-Object -Unique)
}

function Test-StorageForEnvironment {
    param(
        [string]$EnvUrl,
        [int]$TopN
    )

    $envArg = $EnvUrl
    if (-not $envArg) {
        $who = Invoke-PacCapture -PacArgs @("org", "who")
        $who.Output | ForEach-Object { Write-Host $_ }
        if ($who.ExitCode -ne 0) {
            throw "No active pac org. Pass -EnvironmentUrl or run pac auth create."
        }
        $envArg = $null
        $title = "Active pac environment"
    }
    else {
        $title = $EnvUrl
    }

    Write-Section ("Storage check: {0}" -f $title)
    Write-Host "File capacity is often driven by: Notes (annotation), email attachments,"
    Write-Host "web resources (PCF bundles count here), canvas apps, and file/image columns."
    Write-Host "PAC pcf push mainly creates webresources + customcontrol rows in a temp/named solution."

    # --- Aggregates that map to File capacity ---
    Invoke-Fetch -Env $envArg -Label "Notes with documents (annotation) - FILE" -Xml @'
<fetch aggregate="true">
  <entity name="annotation">
    <attribute name="filesize" alias="total_bytes" aggregate="sum" />
    <attribute name="annotationid" alias="row_count" aggregate="count" />
    <filter>
      <condition attribute="isdocument" operator="eq" value="1" />
    </filter>
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Email/activity attachments (activitymimeattachment) - FILE" -Xml @'
<fetch aggregate="true">
  <entity name="activitymimeattachment">
    <attribute name="filesize" alias="total_bytes" aggregate="sum" />
    <attribute name="activitymimeattachmentid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Attachment base (attachment) - FILE" -Xml @'
<fetch aggregate="true">
  <entity name="attachment">
    <attribute name="filesize" alias="total_bytes" aggregate="sum" />
    <attribute name="attachmentid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    # Web resources: no reliable filesize column on all orgs; count + list names (PCF leaves many).
    Invoke-Fetch -Env $envArg -Label "Web resources - count by type (FILE via WebResourceBase)" -Xml @'
<fetch aggregate="true">
  <entity name="webresource">
    <attribute name="webresourceid" alias="row_count" aggregate="count" />
    <attribute name="webresourcetype" alias="type" groupby="true" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Web resources matching PCF / PowerAppsTools / cr137 (sample)" -Xml @'
<fetch>
  <entity name="webresource">
    <attribute name="name" />
    <attribute name="displayname" />
    <attribute name="webresourcetype" />
    <attribute name="createdon" />
    <attribute name="modifiedon" />
    <order attribute="modifiedon" descending="true" />
    <filter type="or">
      <condition attribute="name" operator="like" value="%PowerAppsTools%" />
      <condition attribute="name" operator="like" value="%BuildingApprovals%" />
      <condition attribute="name" operator="like" value="%cr137%" />
      <condition attribute="name" operator="like" value="%.bundle.js%" />
      <condition attribute="name" operator="like" value="%ControlManifest%" />
    </filter>
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Custom controls (PCF) - count" -Xml @'
<fetch aggregate="true">
  <entity name="customcontrol">
    <attribute name="customcontrolid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Custom controls - recent (name/dates)" -Xml @'
<fetch>
  <entity name="customcontrol">
    <attribute name="name" />
    <attribute name="createdon" />
    <attribute name="modifiedon" />
    <order attribute="modifiedon" descending="true" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "PCF web resources (name starts with cc_)" -Xml @'
<fetch aggregate="true">
  <entity name="webresource">
    <attribute name="webresourceid" alias="row_count" aggregate="count" />
    <filter>
      <condition attribute="name" operator="like" value="cc_%" />
    </filter>
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Plugin assemblies - count (binaries can be large)" -Xml @'
<fetch aggregate="true">
  <entity name="pluginassembly">
    <attribute name="pluginassemblyid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Canvas apps - count" -Xml @'
<fetch aggregate="true">
  <entity name="canvasapp">
    <attribute name="canvasappid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Solutions (watch PowerAppsToolsTemp_* from pac pcf push)" -Xml @'
<fetch>
  <entity name="solution">
    <attribute name="uniquename" />
    <attribute name="friendlyname" />
    <attribute name="version" />
    <attribute name="ismanaged" />
    <attribute name="createdon" />
    <attribute name="modifiedon" />
    <order attribute="modifiedon" descending="true" />
    <filter>
      <condition attribute="isvisible" operator="eq" value="1" />
    </filter>
  </entity>
</fetch>
'@

    Invoke-Fetch -Env $envArg -Label "Import jobs - count" -Xml @'
<fetch aggregate="true">
  <entity name="importjob">
    <attribute name="importjobid" alias="row_count" aggregate="count" />
  </entity>
</fetch>
'@

    # App tables for this project (database rows, not file - useful sanity check).
    # Logical name can differ by publisher prefix; try common variants.
    foreach ($entity in @(
            "cr137_buildingapproval",
            "cr137_buildingapprovals",
            "cr137_aalbuildingapproval"
        )) {
        $idAttr = $entity + "id"
        $baXml = @(
            '<fetch aggregate="true">',
            '  <entity name="' + $entity + '">',
            '    <attribute name="' + $idAttr + '" alias="row_count" aggregate="count" />',
            '  </entity>',
            '</fetch>'
        ) -join [Environment]::NewLine
        Invoke-Fetch -Env $envArg -Label ("Building Approvals rows ({0}) - DATABASE" -f $entity) -Xml $baXml
    }

    $largestNotesXml = @"
<fetch>
  <entity name="annotation">
    <attribute name="filename" />
    <attribute name="filesize" />
    <attribute name="mimetype" />
    <attribute name="createdon" />
    <attribute name="objecttypecode" />
    <attribute name="subject" />
    <order attribute="filesize" descending="true" />
    <filter>
      <condition attribute="isdocument" operator="eq" value="1" />
      <condition attribute="filesize" operator="gt" value="0" />
    </filter>
  </entity>
</fetch>
"@
    Invoke-Fetch -Env $envArg -Label ("Largest note documents (requested top {0}; API may page)" -f $TopN) -Xml $largestNotesXml

    Write-Host ""
    Write-Host 'Tips:' -ForegroundColor Green
    Write-Host '1) Admin Center -> Capacity -> environment -> sort by File = ground truth for which table is 2GB.'
    Write-Host '2) If WebResourceBase is huge: old pac pcf push / PowerAppsToolsTemp solutions / unused web resources.'
    Write-Host '3) Reclaimed File capacity can take up to ~24h to show after deletes.'
    Write-Host '4) Byte totals above use entity filesize where available; web resources are counted by row, not bytes (API limitation).'
}

# --- Auth ---
if (-not $SkipAuth) {
    if ($EnvironmentUrl) {
        Write-Host ("Authenticating to {0} ..." -f $EnvironmentUrl) -ForegroundColor Cyan
        pac auth create --environment $EnvironmentUrl
        if ($LASTEXITCODE -ne 0) { throw "pac auth create failed." }
    }
    else {
        Write-Host "Using current pac auth profile." -ForegroundColor Yellow
        pac auth who
        if ($LASTEXITCODE -ne 0) {
            throw "No active pac auth profile. Re-run with -EnvironmentUrl <url>."
        }
    }
}

if ($AllAuthEnvironments) {
    $urls = Get-AuthEnvironmentUrls
    if (-not $urls -or $urls.Count -eq 0) {
        throw "No environment URLs found from pac org list."
    }
    Write-Host ("Will check {0} environment(s) from pac org list." -f $urls.Count) -ForegroundColor Cyan
    foreach ($url in $urls) {
        Test-StorageForEnvironment -EnvUrl $url -TopN $Top
    }
}
else {
    Test-StorageForEnvironment -EnvUrl $EnvironmentUrl -TopN $Top
}

Write-Section "Done"
Write-Host ("Sample sizes: {0} / {1} / {2}" -f (Format-Bytes 1500), (Format-Bytes 2MB), (Format-Bytes 2GB))
