@echo off
title Spinora Gameroom Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA GAMEROOM BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR gameroom start-chrome (9225)
echo     [x] Gameroom tab logged in at agentserver1.gameroom777.com/admin
echo.
echo ============================================================
echo.

set "GAMEROOM_CDP_URL="
set "GAMEROOM_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "GAMEROOM_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9225/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "GAMEROOM_CDP_URL=http://127.0.0.1:9225"
  echo  Chrome detected on port 9225 ^(gameroom-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9225.
echo  Run start-unified-chrome.bat OR gameroom start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %GAMEROOM_CDP_URL% ...
echo.
call npm start

echo.
echo ============================================================
echo   Bot stopped. Read any error above.
echo ============================================================
pause
