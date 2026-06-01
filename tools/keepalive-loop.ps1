$ErrorActionPreference = "SilentlyContinue"

$Launcher = Join-Path $PSScriptRoot "launcher.ps1"
$LogFile = Join-Path $env:TEMP "hojokin-app-keepalive.log"
$Mutex = New-Object System.Threading.Mutex($false, "Local\NicheHojokinFinderKeepAlive")

Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] keepalive started"

if (-not $Mutex.WaitOne(0, $false)) {
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] another keepalive is already running"
  exit 0
}

try {
  while ($true) {
    try {
      & $Launcher -NoBrowser -NoKeepAlive -NoInstall
      $code = $LASTEXITCODE
      Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] ensure exit=$code"
    } catch {
      Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] ensure error=$($_.Exception.Message)"
    }
    Start-Sleep -Seconds 10
  }
} finally {
  $Mutex.ReleaseMutex() | Out-Null
  $Mutex.Dispose()
}
