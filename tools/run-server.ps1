$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $env:TEMP "hojokin-app-run-server.log"
$ServerLogFile = Join-Path $env:TEMP "hojokin-app-server-output.log"

$env:PORT = "39200"
$env:HOST = "0.0.0.0"
$env:STRICT_PORT = "1"

Set-Location $AppDir
$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NodeExe)) {
  $NodeExe = "node"
}
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$env:PORT/api/health" -TimeoutSec 3
  if ($health.ok -eq $true -and $health.ai_mode -eq "web") {
    Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] already healthy; run-server exits"
    exit 0
  }
} catch {
}
Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] AppDir=$AppDir Node=$NodeExe Port=$env:PORT Host=$env:HOST"
& $NodeExe server.js *>> $ServerLogFile
