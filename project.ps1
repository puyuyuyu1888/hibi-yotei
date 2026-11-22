param([ValidateSet('install','dev','build','test','preview','browser-install','e2e','icons')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$projectRoot = (Get-Location).Path
New-Item -ItemType Directory -Force -Path '.cache/tmp','.cache/config','.cache/data','.tools' | Out-Null
$env:TEMP = "$projectRoot\.cache\tmp"
$env:TMP = $env:TEMP
$env:XDG_CACHE_HOME = "$projectRoot\.cache"
$env:XDG_CONFIG_HOME = "$projectRoot\.cache\config"
$env:XDG_DATA_HOME = "$projectRoot\.cache\data"
$env:XDG_STATE_HOME = "$projectRoot\.cache\state"
$env:PNPM_HOME = "$projectRoot\.tools"
$env:npm_config_cache = "$projectRoot\.cache\npm"
$env:npm_config_userconfig = "$projectRoot\.npmrc"
$env:npm_config_prefix = "$projectRoot\.tools"
$env:PLAYWRIGHT_BROWSERS_PATH = "$projectRoot\.cache\browsers"
$env:PLAYWRIGHT_SKIP_BROWSER_GC = '1'
if ($Task -eq 'browser-install') { node node_modules/@playwright/test/cli.js install chromium; exit $LASTEXITCODE }
$pnpmCli = Join-Path (Split-Path (Get-Command node).Source -Parent) '../node_modules/pnpm/bin/pnpm.cjs'
if ($Task -eq 'install') {
  if (Test-Path -LiteralPath $pnpmCli) { node $pnpmCli install --ignore-scripts } else { npm.cmd install --ignore-scripts }
} else {
  $script = if ($Task -eq 'e2e') { 'test:e2e' } else { $Task }
  if (Test-Path -LiteralPath $pnpmCli) { node $pnpmCli run $script } else { npm.cmd run $script }
}
exit $LASTEXITCODE
