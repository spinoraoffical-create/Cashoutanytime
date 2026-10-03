@echo off
title Spinora Cash Frenzy Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA CASH FRENZY BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR cash-frenzy start-chrome (9229)
echo     [x] Cash Frenzy tab logged in at agentserver.cashfrenzy777.com/admin
echo.
echo ============================================================
echo.

set "CASHFRENZY_CDP_URL="
set "CASHFRENZY_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "CASHFRENZY_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9229/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "CASHFRENZY_CDP_URL=http://127.0.0.1:9229"
  echo  Chrome detected on port 9229 ^(cash-frenzy-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9229.
echo  Run start-unified-chrome.bat OR cash-frenzy start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %CASHFRENZY_CDP_URL% ...
echo.
call npm start
pause
