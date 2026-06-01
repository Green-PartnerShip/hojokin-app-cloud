@echo off
cd /d "%~dp0"
title Niche Hojokin Finder LAN

set "PORT=39200"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$ip=[System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notlike '127.*' -and $_.IPAddressToString -notlike '169.254.*' } | Select-Object -First 1; if($ip){$ip.IPAddressToString}else{'IP_NOT_FOUND'}"`) do set "LAN_IP=%%i"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launcher.ps1"
if errorlevel 1 pause & exit /b 1

echo.
echo LAN URL : http://%LAN_IP%:%PORT%/
echo PC URL  : http://127.0.0.1:%PORT%/
echo.
echo The background keepalive is running.
pause
