@echo off
title Spinora - Start All Bots (one Chrome, port 9222)
cd /d "%~dp0"
set "ROOT=%~dp0"
set "CDP=http://127.0.0.1:9222"

echo.
echo ============================================================
echo   ALL BOTS — SINGLE CHROME (each bot uses its own tab)
echo ============================================================
echo   Requires start-unified-chrome.bat first.
echo   CAPTCHA + Supabase keys come from each bot .env
echo   (run sync-bot-env.bat if you changed workers\.env)
echo ============================================================
echo.

node sync-bot-env.mjs >nul 2>&1

curl.exe -s -o nul -w "%%{http_code}" %CDP%/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo   ERROR: Unified Chrome not running on port 9222.
  echo   Run start-unified-chrome.bat first.
  pause
  exit /b 1
)

echo   Chrome OK on 9222. Starting all bots...
echo.

start "Spinora Juwa Bot" cmd /k "cd /d "%ROOT%juwa-bot" && set JUWA_CDP_URL=%CDP% && set JUWA_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Vegas Bot" cmd /k "cd /d "%ROOT%vegas-bot" && set VEGAS_CDP_URL=%CDP% && set VEGAS_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Game Vault Bot" cmd /k "cd /d "%ROOT%gamevault-bot" && set GAMEVAULT_CDP_URL=%CDP% && set GAMEVAULT_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Gameroom Bot" cmd /k "cd /d "%ROOT%gameroom-bot" && set GAMEROOM_CDP_URL=%CDP% && set GAMEROOM_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Cash Machine Bot" cmd /k "cd /d "%ROOT%cashmachine-bot" && set CASHMACHINE_CDP_URL=%CDP% && set CASHMACHINE_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora MR All-in-One Bot" cmd /k "cd /d "%ROOT%mr-all-in-one-bot" && set MRALLINONE_CDP_URL=%CDP% && set MRALLINONE_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Mafia Bot" cmd /k "cd /d "%ROOT%mafia-bot" && set MAFIA_CDP_URL=%CDP% && set MAFIA_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Cash Frenzy Bot" cmd /k "cd /d "%ROOT%cash-frenzy-bot" && set CASHFRENZY_CDP_URL=%CDP% && set CASHFRENZY_HEADLESS=false && call npm start"

echo.
echo   8 bots running — all attached to one Chrome on port 9222.
echo.
pause
