@echo off
setlocal EnableDelayedExpansion
title Spinora - npm install all bots
cd /d "%~dp0"

echo.
echo ============================================================
echo   npm install — all 8 Spinora bots
echo ============================================================
echo.

set FAIL=0
for %%d in (juwa-bot vegas-bot gamevault-bot gameroom-bot cashmachine-bot mr-all-in-one-bot mafia-bot cash-frenzy-bot) do (
  echo === %%d ===
  if not exist "%%d\package.json" (
    echo   FAIL: folder %%d not found
    set FAIL=1
  ) else (
    pushd "%%d"
    call npm install
    if errorlevel 1 set FAIL=1
    popd
  )
  echo.
)

if !FAIL! NEQ 0 (
  echo One or more installs failed.
  pause
  exit /b 1
)

echo All bots installed.
pause
exit /b 0
