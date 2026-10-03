@echo off
title Spinora Juwa Bot
cd /d "%~dp0"

echo.
echo ============================================================
echo   SPINORA JUWA BOT
echo ============================================================
echo.
echo   BEFORE this works you need:
echo     [x] start-chrome-for-bot.bat was run
echo     [x] VPN is ON in that Chrome window
echo     [x] https://ht.juwa777.com/login shows LOGIN page (no error)
echo.
echo ============================================================
echo.

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo  ERROR: Bot Chrome is not running.
  echo  Run start-chrome-for-bot.bat first.
  echo.
  pause
  exit /b 1
)

npm start
pause
