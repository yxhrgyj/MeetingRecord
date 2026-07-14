@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-model-tunnel.ps1"
echo.
echo Tunnel stopped. Press any key to close this window.
pause >nul
