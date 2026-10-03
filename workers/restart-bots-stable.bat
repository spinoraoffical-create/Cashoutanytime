@echo off
title Spinora - Stable Bot Restart (manual login first)
color 0E
cd /d "%~dp0"

echo.
echo ============================================================
echo   STABLE BOT RESTART — read this before continuing
echo ============================================================
echo.
echo   1. Press Ctrl+C in the watchdog window if it is still running.
echo   2. Keep ONE Chrome open (port 9222) from start-unified-chrome.bat
echo   3. MANUALLY log in on EVERY tab (do NOT rely on auto-CAPTCHA):
echo        - Juwa (VPN ON) -^> HomeDetail / dashboard
echo        - Vegas -^> userManagement
echo        - Game Vault -^> logged IN (not /login)
echo        - Gameroom -^> User Management open
echo        - Cash Machine -^> User Management open
echo        - MR All-in-One -^> User Management open
echo        - Mafia -^> User Management open
echo        - Cash Frenzy -^> /admin/player/index with NEW ACCOUNT button
echo.
echo   4. Add to workers\.env (recommended after manual login):
echo        CAPTCHA_AUTO=false
echo        SESSION_CHECK_MS=300000
echo.
echo   5. Then this script syncs env and starts watchdog (staggered).
echo ============================================================
echo.
pause

node sync-bot-env.mjs
if errorlevel 1 (
  echo sync-bot-env failed
  pause
  exit /b 1
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo.
  echo Chrome not on port 9222. Run start-unified-chrome.bat first.
  pause
  exit /b 1
)

echo.
echo Starting watchdog with staggered bot launch...
node bot-watchdog.mjs
