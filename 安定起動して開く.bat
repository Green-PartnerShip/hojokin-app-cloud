@echo off
cd /d "%~dp0"
title Niche Hojokin Finder Stable Start
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launcher.ps1"
if errorlevel 1 pause
