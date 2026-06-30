@echo off
cd /d "%~dp0"

echo 会议记录助手启动中...
echo.

start http://localhost:3001
node server.js
