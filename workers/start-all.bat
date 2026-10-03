@echo off
title Spinora - Start All (Chrome + Bots)
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA - FULL BOT STARTUP
echo ============================================================
echo   Step 1: Launch all Chrome windows
echo   Step 2: You log in on each panel
echo   Step 3: Launch all bots
echo ============================================================
echo.

call "%~dp0check-all-bots.bat"
if errorlevel 1 exit /b 1

echo.
echo Press any key to open all Chrome windows...
pause >nul

call "%~dp0start-all-chrome.bat"

echo.
echo ============================================================
echo   LOG IN on each Chrome window (VPN for Juwa if needed).
echo   When all panels are ready, press any key to start all bots.
echo ============================================================
pause >nul

call "%~dp0start-all-bots.bat"
