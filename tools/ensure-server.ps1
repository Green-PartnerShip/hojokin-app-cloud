$Launcher = Join-Path $PSScriptRoot "launcher.ps1"
& $Launcher -NoBrowser -NoKeepAlive -NoInstall
exit $LASTEXITCODE
