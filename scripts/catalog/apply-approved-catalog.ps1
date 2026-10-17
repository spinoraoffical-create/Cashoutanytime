# Applies scripts/catalog/restore-public-catalog.sql to the NEW Supabase project only.
# The database password is typed at a hidden prompt and is not printed.
# This file does not run unless you execute it.

param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"
$Install = "C:\supabase-migration-test\install"
$Catalog = Join-Path $PSScriptRoot "restore-public-catalog.sql"
$Verify = Join-Path $env:TEMP ("catalog-verify-" + [guid]::NewGuid().ToString("n") + ".sql")

if ($DatabaseUrl -match "muetgtzcbecsqigtpfyn") {
  throw "Refusing to run. The old project is not the target."
}

. (Join-Path $Install "Assert-NewProjectUrl.ps1")
. (Join-Path $Install "Docker-Psql.ps1")

Test-NewProjectDatabaseUrl -DatabaseUrl $DatabaseUrl

$verifySql = @'
select
  (select count(*) from public.game_categories where key in ('slots','fishing','table-games','arcade','seasonal')) as categories,
  (select count(*) from public.games where is_active and slug in ('fire-kirin','juwa','orion-stars','game-vault','vegas-sweeps','milky-way','panda-master','cash-frenzy','vblink','mafia','mr-all-in-one','cash-machine')) as active_games,
  (select count(*) from public.games where is_active = false and slug in ('ultrapanda','river-sweeps','lucky-slots','high-stakes','golden-dragon','blue-dragon','dragon-master','gameroom','ace-book','galaxy-games','moolah','vb-game','mega-spin','lucky-lion','pharaohs-treasure','ocean-king','fish-hunter','monster-hunter','buffalo-link')) as inactive_games;
'@
[System.IO.File]::WriteAllText($Verify, $verifySql.Replace("`r`n", "`n"))

Write-Host "This writes only game categories and game catalog rows on the new project."
Write-Host "It does not change users, wallets, or payments."
$password = Read-NewDatabasePassword
if (-not ($password -is [System.Security.SecureString])) {
  throw "The password prompt did not return a password. Nothing was contacted."
}

try {
  Invoke-NewProjectDockerPsql -DatabaseUrl $DatabaseUrl -Password $password -SqlFile $Catalog
  Invoke-NewProjectDockerPsql -DatabaseUrl $DatabaseUrl -Password $password -SqlFile $Verify -ReadOnly
  Write-Host "Catalog script finished. The read-only check printed categories, active_games, and inactive_games."
}
finally {
  Remove-Item -LiteralPath $Verify -ErrorAction SilentlyContinue
}
