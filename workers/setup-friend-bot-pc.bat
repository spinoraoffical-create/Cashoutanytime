@echo off
title Spinora - Friend bot PC setup
cd /d "%~dp0"

echo.
echo ============================================================
echo   FRIEND BOT PC — one-time setup
echo ============================================================
echo   1. npm install all bots
echo   2. import .env from bot-env-pack\
echo   3. health check
echo ============================================================
echo.

call "%~dp0install-all-bots.bat"
if errorlevel 1 exit /b 1

call "%~dp0import-bot-env-pack.bat"
if errorlevel 1 exit /b 1

call "%~dp0check-all-bots.bat"

echo.
echo Setup done. Next:
echo   start-unified-chrome.bat  ^(log in all tabs^)
echo   start-all-bots-unified.bat
echo.
pause
