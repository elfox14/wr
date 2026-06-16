param(
  [string]$ApiUrl = "https://worldcup.mcprim.com/api/admin/official-squads/reconcile",
  [string]$OfficialSquadsFile = ".\official-squads-2026.json",
  [string]$AdminSecret = $env:ADMIN_API_SECRET,
  [switch]$Apply,
  [string]$ReportPrefix = ".\official-squads-reconcile"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OfficialSquadsFile)) {
  throw "Official squads file not found: $OfficialSquadsFile"
}

if (-not $AdminSecret) {
  throw "Admin secret is missing. Pass -AdminSecret or set `$env:ADMIN_API_SECRET."
}

function Invoke-Reconcile($payloadObject) {
  $payload = $payloadObject | ConvertTo-Json -Depth 20
  return Invoke-RestMethod -Uri $ApiUrl -Method POST -Headers @{ "x-admin-secret" = $AdminSecret } -ContentType "application/json" -Body $payload
}

$official = Get-Content $OfficialSquadsFile -Raw | ConvertFrom-Json
if (-not $official.teams -or $official.teams.Count -eq 0) {
  throw "The official squads file must contain a non-empty teams array."
}

# 1) Always run a safe dry run first for every team.
$official.dryRun = $true
$dryResult = Invoke-Reconcile $official
$dryJsonPath = "$ReportPrefix-dryrun.json"
$dryResult | ConvertTo-Json -Depth 20 | Set-Content $dryJsonPath -Encoding UTF8

$rows = @()
foreach ($result in $dryResult.results) {
  $safeToApply = $false
  if ($result.ok -eq $true -and $result.officialCount -eq 26 -and (($result.matchedExisting + $result.created) -eq $result.officialCount)) {
    $safeToApply = $true
  }

  $rows += [PSCustomObject]@{
    teamCode = $result.team.code
    teamName = $result.team.name
    ok = $result.ok
    officialCount = $result.officialCount
    matchedExisting = $result.matchedExisting
    created = $result.created
    hiddenUnavailable = $result.hiddenUnavailable
    safeToApply = $safeToApply
    note = if ($safeToApply) { "READY" } else { "REVIEW_REQUIRED" }
  }
}

$csvPath = "$ReportPrefix-dryrun-summary.csv"
$rows | Export-Csv $csvPath -NoTypeInformation -Encoding UTF8

Write-Host "Dry run complete."
Write-Host "JSON report: $dryJsonPath"
Write-Host "CSV summary: $csvPath"
$rows | Format-Table -AutoSize

$safeCodes = @($rows | Where-Object { $_.safeToApply -eq $true } | ForEach-Object { $_.teamCode })
$reviewRows = @($rows | Where-Object { $_.safeToApply -ne $true })

if ($reviewRows.Count -gt 0) {
  $reviewPath = "$ReportPrefix-review-required.csv"
  $reviewRows | Export-Csv $reviewPath -NoTypeInformation -Encoding UTF8
  Write-Host "Review required report: $reviewPath"
}

if (-not $Apply) {
  Write-Host "No changes were applied because -Apply was not passed."
  Write-Host "To apply only safe teams, rerun with -Apply."
  exit 0
}

if ($safeCodes.Count -eq 0) {
  Write-Host "No safe teams to apply."
  exit 0
}

# 2) Apply only teams that passed dry run safety rules.
$applyTeams = @($official.teams | Where-Object { $safeCodes -contains $_.teamCode })
$applyPayload = [PSCustomObject]@{
  dryRun = $false
  teams = $applyTeams
}

$applyResult = Invoke-Reconcile $applyPayload
$applyJsonPath = "$ReportPrefix-apply.json"
$applyResult | ConvertTo-Json -Depth 20 | Set-Content $applyJsonPath -Encoding UTF8

Write-Host "Apply complete for safe teams only."
Write-Host "Applied teams: $($safeCodes -join ', ')"
Write-Host "Apply JSON report: $applyJsonPath"
$applyResult.results | Select-Object @{Name='teamCode';Expression={$_.team.code}}, @{Name='teamName';Expression={$_.team.name}}, officialCount, matchedExisting, created, hiddenUnavailable | Format-Table -AutoSize
