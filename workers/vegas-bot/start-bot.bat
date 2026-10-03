@echo off
title Spinora Vegas Sweeps Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA VEGAS SWEEPS BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR vegas start-chrome (9223)
echo     [x] Vegas tab logged in at agent.lasvegassweeps.com
echo.
echo ============================================================
echo.

set "VEGAS_CDP_URL="
set "VEGAS_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "VEGAS_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9223/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "VEGAS_CDP_URL=http://127.0.0.1:9223"
  echo  Chrome detected on port 9223 ^(vegas-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9223.
echo  Run start-unified-chrome.bat OR vegas start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %VEGAS_CDP_URL% ...
echo.
call npm start
pause
