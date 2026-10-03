@echo off
title Spinora Mafia Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA MAFIA BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR mafia start-chrome (9228)
echo     [x] Mafia tab logged in at agentserver.mafia77777.com/admin
echo.
echo ============================================================
echo.

set "MAFIA_CDP_URL="
set "MAFIA_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "MAFIA_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9228/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "MAFIA_CDP_URL=http://127.0.0.1:9228"
  echo  Chrome detected on port 9228 ^(mafia-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9228.
echo  Run start-unified-chrome.bat OR mafia start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %MAFIA_CDP_URL% ...
echo.
call npm start

echo.
echo ============================================================
echo   Bot stopped. Read any error above.
echo ============================================================
pause
