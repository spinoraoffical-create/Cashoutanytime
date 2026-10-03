@echo off
setlocal EnableDelayedExpansion
title Spinora - Export bot .env pack (for USB / friend PC)
cd /d "%~dp0"

set "PACK=%~dp0bot-env-pack"
set MISSING=0

echo.
echo ============================================================
echo   EXPORT bot .env files to bot-env-pack\
echo   Copy that folder to friend PC, then run import-bot-env-pack.bat
echo ============================================================
echo.

if not exist "%PACK%" mkdir "%PACK%"

for %%d in (juwa-bot vegas-bot gamevault-bot gameroom-bot cashmachine-bot mr-all-in-one-bot mafia-bot cash-frenzy-bot) do (
  if not exist "%%d\.env" (
    echo   MISSING: %%d\.env
    set MISSING=1
  ) else (
    if not exist "%PACK%\%%d" mkdir "%PACK%\%%d"
    copy /Y "%%d\.env" "%PACK%\%%d\.env" >nul
    echo   OK: %%d\.env
  )
)

echo.
if !MISSING! NEQ 0 (
  echo Some .env files missing — fill them on this PC first.
  pause
  exit /b 1
)

echo Pack ready at:
echo   %PACK%
echo.
echo Next: copy the whole "bot-env-pack" folder to friend PC
echo       (USB, OneDrive private folder, etc.) — NEVER commit to GitHub.
echo.
pause
exit /b 0
