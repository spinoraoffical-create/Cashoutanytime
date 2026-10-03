@echo off
title Spinora - Chrome for Cash Machine Bot (VPN)
cd /d "%~dp0"

set "PROFILE=%LOCALAPPDATA%\SpinoraCashmachineBot"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
  echo Could not find Google Chrome.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   CASH MACHINE BOT - CHROME SETUP
echo ============================================================
echo.
echo   This opens a SEPARATE Chrome (not your normal one) on port 9226.
echo.
echo   FIRST TIME:
echo     1. Chrome opens - install your VPN extension if the panel needs it
echo     2. Turn VPN ON in that Chrome (if required)
echo     3. Go to: https://agentserver.cashmachine777.com/admin
echo     4. Log in as Cashmachine98 manually (handles the CAPTCHA)
echo     5. Open Game User -^> User Management (leave that tab open)
echo.
echo   EVERY TIME AFTER:
echo     1. Run this file
echo     2. Make sure /admin is logged in with User Management open
echo     3. Then run start-bot.bat
echo.
echo ============================================================
echo.

start "" "%CHROME%" --remote-debugging-port=9226 --user-data-dir="%PROFILE%" "https://agentserver.cashmachine777.com/admin"

echo Chrome started on port 9226. Log in at /admin, open User Management, then run start-bot.bat
echo CASHMACHINE_CDP_URL=http://127.0.0.1:9226 should be set in .env
pause
