@echo off
title Spinora - Start All Bots
cd /d "%~dp0"
set "ROOT=%~dp0"

echo.
echo ============================================================
echo   START ALL SPINORA GAME BOTS (8 windows)
echo ============================================================
echo.
echo   Requires start-all-chrome.bat first + logged-in panels.
echo   Each bot polls Supabase every ~10s until you close its window.
echo ============================================================
echo.

call :require_chrome 9222 "Juwa"
if errorlevel 1 exit /b 1
call :require_chrome 9223 "Vegas Sweeps"
if errorlevel 1 exit /b 1
call :require_chrome 9224 "Game Vault"
if errorlevel 1 exit /b 1
call :require_chrome 9225 "Gameroom"
if errorlevel 1 exit /b 1
call :require_chrome 9226 "Cash Machine"
if errorlevel 1 exit /b 1
call :require_chrome 9227 "MR All-in-One"
if errorlevel 1 exit /b 1
call :require_chrome 9228 "Mafia"
if errorlevel 1 exit /b 1
call :require_chrome 9229 "Cash Frenzy"
if errorlevel 1 exit /b 1

echo   All Chrome ports OK. Starting bots...
echo.

start "Spinora Juwa Bot" cmd /k "cd /d "%ROOT%juwa-bot" && set JUWA_CDP_URL=http://127.0.0.1:9222 && set JUWA_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Vegas Bot" cmd /k "cd /d "%ROOT%vegas-bot" && set VEGAS_CDP_URL=http://127.0.0.1:9223 && set VEGAS_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Game Vault Bot" cmd /k "cd /d "%ROOT%gamevault-bot" && set GAMEVAULT_CDP_URL=http://127.0.0.1:9224 && set GAMEVAULT_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Gameroom Bot" cmd /k "cd /d "%ROOT%gameroom-bot" && set GAMEROOM_CDP_URL=http://127.0.0.1:9225 && set GAMEROOM_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Cash Machine Bot" cmd /k "cd /d "%ROOT%cashmachine-bot" && set CASHMACHINE_CDP_URL=http://127.0.0.1:9226 && set CASHMACHINE_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora MR All-in-One Bot" cmd /k "cd /d "%ROOT%mr-all-in-one-bot" && set MRALLINONE_CDP_URL=http://127.0.0.1:9227 && set MRALLINONE_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Mafia Bot" cmd /k "cd /d "%ROOT%mafia-bot" && set MAFIA_CDP_URL=http://127.0.0.1:9228 && set MAFIA_HEADLESS=false && call npm start"
timeout /t 1 /nobreak >nul

start "Spinora Cash Frenzy Bot" cmd /k "cd /d "%ROOT%cash-frenzy-bot" && set CASHFRENZY_CDP_URL=http://127.0.0.1:9229 && set CASHFRENZY_HEADLESS=false && call npm start"

echo.
echo   8 bot windows opened. Leave them running for 24/7 polling.
echo   Disable PC sleep: Settings ^> System ^> Power ^> Never sleep (plugged in).
echo.
pause
exit /b 0

:require_chrome
curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:%~1/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo   ERROR: %~2 Chrome not running on port %~1
  echo   Run start-all-chrome.bat first and log in.
  echo.
  pause
  exit /b 1
)
exit /b 0
