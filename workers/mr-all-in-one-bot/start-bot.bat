@echo off
title Spinora MR All In One Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA MR ALL IN ONE BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR mr-all-in-one start-chrome (9227)
echo     [x] MR All In One tab logged in at agentserver.mrallinone777.com/admin
echo.
echo ============================================================
echo.

set "MRALLINONE_CDP_URL="
set "MRALLINONE_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "MRALLINONE_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9227/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "MRALLINONE_CDP_URL=http://127.0.0.1:9227"
  echo  Chrome detected on port 9227 ^(mr-all-in-one-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9227.
echo  Run start-unified-chrome.bat OR mr-all-in-one start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %MRALLINONE_CDP_URL% ...
echo.
call npm start

echo.
echo ============================================================
echo   Bot stopped. Read any error above.
echo ============================================================
pause
