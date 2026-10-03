@echo off
title Spinora Game Vault Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA GAME VAULT BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] Unified Chrome (port 9222) OR gamevault start-chrome (9224)
echo     [x] Game Vault tab logged in at agent.gamevault999.com
echo.
echo ============================================================
echo.

set "GAMEVAULT_CDP_URL="
set "GAMEVAULT_HEADLESS=false"

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "GAMEVAULT_CDP_URL=http://127.0.0.1:9222"
  echo  Chrome detected on port 9222 ^(unified — all tabs^).
  goto :start_bot
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9224/json/version 2>nul | findstr /r "^200$" >nul
if not errorlevel 1 (
  set "GAMEVAULT_CDP_URL=http://127.0.0.1:9224"
  echo  Chrome detected on port 9224 ^(gamevault-only^).
  goto :start_bot
)

echo  ERROR: No bot Chrome found on port 9222 or 9224.
echo  Run start-unified-chrome.bat OR gamevault start-chrome-for-bot.bat first.
echo.
pause
exit /b 1

:start_bot
echo  Connecting bot to %GAMEVAULT_CDP_URL% ...
echo.
call npm start
pause
