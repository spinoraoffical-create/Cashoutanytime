@echo off
title Spinora - Check All Bots
cd /d "%~dp0"
setlocal EnableDelayedExpansion

echo.
echo ============================================================
echo   SPINORA - BOT HEALTH CHECK
echo ============================================================
echo   Checks .env, npm deps, agent login, and unified Chrome (port 9222).
echo   Does NOT log into agent panels — you still verify those manually.
echo ============================================================
echo.

set "PASS=0"
set "WARN=0"
set "FAIL=0"

call :check_bot "Juwa"           "juwa-bot"           9222 "JUWA_CDP_URL"
call :check_bot "Vegas Sweeps"   "vegas-bot"          9223 "VEGAS_CDP_URL"
call :check_bot "Game Vault"     "gamevault-bot"      9224 "GAMEVAULT_CDP_URL"
call :check_bot "Gameroom"       "gameroom-bot"       9225 "GAMEROOM_CDP_URL"
call :check_bot "Cash Machine"   "cashmachine-bot"    9226 "CASHMACHINE_CDP_URL"
call :check_bot "MR All-in-One"  "mr-all-in-one-bot"  9227 "MRALLINONE_CDP_URL"
call :check_bot "Mafia"          "mafia-bot"          9228 "MAFIA_CDP_URL"
call :check_bot "Cash Frenzy"    "cash-frenzy-bot"    9229 "CASHFRENZY_CDP_URL"

echo.
echo ============================================================
echo   SUMMARY: !PASS! ready  ^|  !WARN! warnings  ^|  !FAIL! need fix
echo ============================================================
echo.
if !FAIL! GTR 0 (
  echo   Fix FAIL items above, then run sync-bot-env.bat and smoke-check.bat
) else if !WARN! GTR 0 (
  echo   Run set-bot-credentials.bat, start-unified-chrome.bat, start-all-bots-unified.bat
) else (
  echo   All bots ready. Run start-all-advanced-free.bat for 24/7 mode.
)
echo.
pause
exit /b 0

:check_bot
set "BOT_NAME=%~1"
set "BOT_DIR=%~2"
set "BOT_PORT=%~3"
set "CDP_VAR=%~4"
set "STATUS=OK"
set "DETAIL="

if not exist "%BOT_DIR%\package.json" (
  set "STATUS=FAIL"
  set "DETAIL=missing folder"
  set /a FAIL+=1
  goto :print_row
)

if not exist "%BOT_DIR%\.env" (
  set "STATUS=WARN"
  set "DETAIL=no .env — copy from .env.example"
  set /a WARN+=1
  goto :print_row
)

findstr /i "SUPABASE_SERVICE_ROLE_KEY" "%BOT_DIR%\.env" | findstr /v "your_service_role" >nul
if errorlevel 1 (
  set "STATUS=WARN"
  set "DETAIL=.env missing real SUPABASE_SERVICE_ROLE_KEY"
  set /a WARN+=1
  goto :print_row
)

findstr /i "AGENT_USERNAME PANEL_USERNAME" "%BOT_DIR%\.env" | findstr /v "^#" | findstr /v "your_" >nul
if errorlevel 1 (
  set "STATUS=WARN"
  set "DETAIL=no agent login — run set-bot-credentials.bat"
  set /a WARN+=1
  goto :print_row
)

if not exist "%BOT_DIR%\node_modules" (
  set "STATUS=WARN"
  set "DETAIL=run npm install in %BOT_DIR%"
  set /a WARN+=1
  goto :print_row
)

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:9222/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  set "STATUS=WARN"
  set "DETAIL=Unified Chrome not on port 9222 yet"
  set /a WARN+=1
) else (
  set /a PASS+=1
  set "DETAIL=Chrome OK on 9222 (unified mode)"
)
goto :print_row

:print_row
echo   [!STATUS!] !BOT_NAME!  ^(!BOT_DIR!^)  —  !DETAIL!
exit /b 0
