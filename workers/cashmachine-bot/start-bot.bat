@echo off
title Spinora Cash Machine Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA CASH MACHINE BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR cashmachine start-chrome (9226)
echo     [x] Cash Machine tab logged in at agentserver.cashmachine777.com/admin
echo.
echo ============================================================
echo.

set "CASHMACHINE_CDP_URL="
set "CASHMACHINE_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "CASHMACHINE_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9226/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "CASHMACHINE_CDP_URL=http://127.0.0.1:9226"
  echo  Chrome detected on port 9226 ^(cash-machine-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9226.
echo  Run start-unified-chrome.bat OR cashmachine start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %CASHMACHINE_CDP_URL% ...
echo.
call npm start

echo.
echo ============================================================
echo   Bot stopped. Read any error above.
echo ============================================================
pause
