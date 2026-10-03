@echo off
setlocal EnableDelayedExpansion
title Spinora - Import bot .env pack
cd /d "%~dp0"

set "PACK=%~dp0bot-env-pack"
set MISSING=0

echo.
echo ============================================================
echo   IMPORT .env from bot-env-pack\ into each bot folder
echo ============================================================
echo.

if not exist "%PACK%" (
  echo   ERROR: bot-env-pack folder not found.
  echo   Copy it from the main bot PC next to this script, then retry.
  pause
  exit /b 1
)

for %%d in (juwa-bot vegas-bot gamevault-bot gameroom-bot cashmachine-bot mr-all-in-one-bot mafia-bot cash-frenzy-bot) do (
  if not exist "%PACK%\%%d\.env" (
    echo   MISSING: bot-env-pack\%%d\.env
    set MISSING=1
  ) else (
    copy /Y "%PACK%\%%d\.env" "%%d\.env" >nul
    echo   OK: %%d\.env
  )
)

echo.
if !MISSING! NEQ 0 (
  echo Pack incomplete.
  pause
  exit /b 1
)

echo.
echo All .env files imported.
echo Unified Chrome mode: start-unified-chrome.bat sets CDP port 9222 at runtime.
echo Run check-all-bots.bat to verify.
echo.
pause
exit /b 0
