@echo off
title Spinora Advanced Zero-Cost Game Bot Launcher and Watchdog
color 0A

echo =======================================================
echo    SPINORA ADVANCED GAME BOT WORKER LAUNCHER (FREE)
echo =======================================================
echo.
echo [1/4] Checking environment and network connection...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

echo [2/4] Syncing workers\.env into all 8 bot folders...
node sync-bot-env.mjs
if errorlevel 1 (
    echo [ERROR] sync-bot-env.mjs failed — check workers\.env exists.
    pause
    exit /b 1
)

echo [3/4] Launching Unified Chrome Debugger (Port 9222)...
start "Spinora Unified Chrome" cmd /c "start-unified-chrome.bat"

echo Waiting 5 seconds for Chrome initialization...
timeout /t 5 /nobreak >nul

echo [4/4] Launching Bot Watchdog (Auto-Monitors and Auto-Restarts Bots)...
echo.
node bot-watchdog.mjs

pause
