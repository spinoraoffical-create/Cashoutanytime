@echo off
title Spinora - Chrome for Cash Frenzy Bot (VPN)
cd /d "%~dp0"

set "PROFILE=%LOCALAPPDATA%\SpinoraCashFrenzyBot"
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
echo   CASH FRENZY BOT - CHROME SETUP
echo ============================================================
echo.
echo   This opens a SEPARATE Chrome (not your normal one) on port 9229.
echo.
echo   FIRST TIME:
echo     1. Chrome opens at https://agentserver.cashfrenzy777.com/admin
echo     2. Install VPN extension if the panel needs it
echo     3. Log in (CAPTCHA) — stay on /admin or click User List
echo.
echo   EVERY TIME AFTER:
echo     1. Run this file
echo     2. Make sure you are logged in on /admin or User List
echo     3. Then run start-bot.bat
echo.
echo   NOTE: /admin/player/insert is ONLY the popup form inside New Account.
echo         Do NOT open that URL yourself — the bot handles it automatically.
echo.
echo ============================================================
echo.

start "" "%CHROME%" --remote-debugging-port=9229 --user-data-dir="%PROFILE%" "https://agentserver.cashfrenzy777.com/admin"

echo Chrome started on port 9229. Log in on /admin, then run start-bot.bat
pause
