@echo off
cd /d "%~dp0"
title Niche Hojokin Finder Diagnose
echo ============================================================
echo   Niche Hojokin Finder Diagnose
echo ============================================================
echo.
echo Folder: %CD%
echo Date: %DATE% %TIME%
echo.

echo [1] Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo   NG: Node.js was not found. Install the LTS version from https://nodejs.org/
) else (
  for /f "tokens=*" %%i in ('node --version') do echo   OK: %%i
)

echo.
echo [2] Required files
set MISSING=0
for %%F in (package.json server.js public\index.html public\data\regions.json tools\launcher.ps1 tools\run-server.ps1 tools\keepalive-loop.ps1) do (
  if exist "%%F" (
    echo   OK: %%F
  ) else (
    echo   NG: %%F missing
    set /a MISSING+=1
  )
)

echo.
echo [3] Fixed URL startup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ensure-server.ps1"
if errorlevel 1 (
  echo   NG: startup check failed
) else (
  echo   OK: http://127.0.0.1:39200/
)

echo.
echo [4] Port 39200
netstat -ano | findstr ":39200 " | findstr LISTENING
if errorlevel 1 (
  echo   NG: port 39200 is not listening
) else (
  echo   OK: port 39200 is listening
)

echo.
echo [5] jGrants API
ping -n 1 api.jgrants-portal.go.jp >nul 2>&1
if errorlevel 1 (
  echo   WARN: api.jgrants-portal.go.jp could not be reached
) else (
  echo   OK: reachable
)

echo.
echo Diagnose complete. Use browser-start bat for normal startup.
pause
