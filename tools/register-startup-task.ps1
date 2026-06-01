$ErrorActionPreference = "Stop"

$EnsureScript = Join-Path $PSScriptRoot "ensure-server.ps1"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$Argument = "-NoProfile -ExecutionPolicy Bypass -File `"$EnsureScript`""

$Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument $Argument
$LogonTrigger = New-ScheduledTaskTrigger -AtLogOn
$RepeatingTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "NicheHojokinFinder StartOnLogon" -Action $Action -Trigger $LogonTrigger -Settings $Settings -Description "Start Niche Hojokin Finder at user logon." -Force | Out-Null
Register-ScheduledTask -TaskName "NicheHojokinFinder KeepAlive" -Action $Action -Trigger $RepeatingTrigger -Settings $Settings -Description "Restart Niche Hojokin Finder if localhost:39200 is down." -Force | Out-Null

Write-Host "Registered startup and keep-alive tasks for NicheHojokinFinder."
