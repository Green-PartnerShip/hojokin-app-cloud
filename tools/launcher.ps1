param(
  [switch]$NoBrowser,
  [switch]$NoKeepAlive,
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $PSScriptRoot
$Port = 39200
$Url = "http://127.0.0.1:$Port/"
$RunScript = Join-Path $PSScriptRoot "run-server.ps1"
$KeepAliveScript = Join-Path $PSScriptRoot "keepalive-loop.ps1"
$LogFile = Join-Path $env:TEMP "hojokin-app-launcher.log"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Write-LaunchLog {
  param([string]$Message)
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format s)] $Message"
}

function Get-NodeExe {
  $defaultNode = "C:\Program Files\nodejs\node.exe"
  if (Test-Path -LiteralPath $defaultNode) { return $defaultNode }

  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  throw "Node.js was not found. Install the Node.js LTS version, then run this launcher again."
}

function Test-AppHealth {
  foreach ($healthUrl in @("http://127.0.0.1:$Port/api/health", "http://localhost:$Port/api/health")) {
    try {
      $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
      if ($response.ok -eq $true -and $response.ai_mode -eq "web") { return $true }
    } catch {
    }
  }
  return $false
}

function Wait-AppHealth {
  param([int]$Seconds = 30)

  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    if (Test-AppHealth) { return $true }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Test-AppPage {
  try {
    $page = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return ($page.StatusCode -eq 200 -and $page.Content -match "claude\.ai/new\?q=" -and $page.Content -match "chatgpt\.com/\?q=")
  } catch {
    return $false
  }
}

function Ensure-Dependencies {
  if ($NoInstall) { return }

  $NodeExe = Get-NodeExe
  Push-Location $AppDir
  try {
    & $NodeExe -e "require.resolve('express'); require.resolve('axios'); require.resolve('dotenv');" *> $null
    if ($LASTEXITCODE -eq 0) { return }

    Write-LaunchLog "dependencies missing; running npm install"
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
    if (-not $npm -or -not $npm.Source) { throw "npm was not found. Reinstall the Node.js LTS version." }

    & $npm.Source install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
  } finally {
    Pop-Location
  }
}

function Get-AppListenerProcesses {
  $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge $Port -and $_.LocalPort -le ($Port + 50) }

  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    if (-not $processId) { continue }

    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    $cmdLine = [string]$proc.CommandLine
    $isExactServerScript = $cmdLine -match "(^|[\\/\s`"'])server\.js($|[`"'\s])"
    $isNodeServer = $proc.Name -match "^node(\.exe)?$" -and $isExactServerScript
    if ($isNodeServer) {
      [pscustomobject]@{
        ProcessId = $processId
        Port = $connection.LocalPort
        CommandLine = $cmdLine
      }
    }
  }
}

function Stop-UnhealthyAppProcesses {
  $isHealthy = Test-AppHealth
  $listeners = @(Get-AppListenerProcesses)

  foreach ($listener in $listeners) {
    $shouldKeep = $isHealthy -and $listener.Port -eq $Port
    if ($shouldKeep) { continue }

    Write-LaunchLog "stopping app listener pid=$($listener.ProcessId) port=$($listener.Port)"
    Stop-Process -Id $listener.ProcessId -Force -ErrorAction SilentlyContinue
  }

  if (-not $isHealthy) {
    $portListeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $portListeners) {
      if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {
        Write-LaunchLog "stopping non-healthy fixed-port listener pid=$($listener.OwningProcess)"
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

function Restart-KeepAlive {
  if ($NoKeepAlive) { return }

  $existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { [string]$_.CommandLine -match "keepalive-loop\.ps1" }

  foreach ($proc in $existing) {
    if ($proc.ProcessId -ne $PID) {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

  Start-Process -FilePath $PowerShellExe -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", $KeepAliveScript
  ) -WorkingDirectory $AppDir -WindowStyle Hidden | Out-Null

  Write-LaunchLog "keepalive restarted"
}

function Start-AppServer {
  if (Test-AppHealth) {
    Stop-UnhealthyAppProcesses
    return
  }

  Stop-UnhealthyAppProcesses

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    Write-LaunchLog "starting server attempt=$attempt"
    Start-Process -FilePath $PowerShellExe -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", $RunScript
    ) -WorkingDirectory $AppDir -WindowStyle Hidden | Out-Null

    if (Wait-AppHealth -Seconds 25) {
      Stop-UnhealthyAppProcesses
      return
    }

    Stop-UnhealthyAppProcesses
    Start-Sleep -Seconds 1
  }

  throw "The app server did not become healthy. Log: $LogFile"
}

function Open-AppBrowser {
  if ($NoBrowser) { return }

  if (-not (Test-AppPage)) {
    if (-not (Wait-AppHealth -Seconds 10)) {
      throw "The app page could not be verified after startup."
    }
  }

  Start-Process $Url
  Write-LaunchLog "opened $Url"
}

try {
  Write-LaunchLog "launcher started NoBrowser=$NoBrowser NoKeepAlive=$NoKeepAlive"
  if (-not $NoBrowser) { Write-Host "Starting Niche Hojokin Finder. Please wait..." }
  Ensure-Dependencies
  if (-not $NoBrowser) { Write-Host "Checking the local server..." }
  Start-AppServer
  Restart-KeepAlive
  if (-not (Test-AppPage)) { throw "The app page verification failed." }
  if (-not $NoBrowser) { Write-Host "Opening http://127.0.0.1:39200/ ..." }
  Open-AppBrowser
  Write-LaunchLog "launcher completed"
  exit 0
} catch {
  Write-LaunchLog "launcher failed: $($_.Exception.Message)"
  if (-not $NoBrowser) {
    Write-Host ""
    Write-Host "Niche Hojokin Finder could not start."
    Write-Host $_.Exception.Message
    Write-Host "Log: $LogFile"
    Write-Host ""
  }
  exit 1
}
