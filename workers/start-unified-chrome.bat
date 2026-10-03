@echo off
setlocal EnableDelayedExpansion
title Spinora - One Chrome, All Game Panels (tabs)
cd /d "%~dp0"

set "PORT=9222"
set "PROFILE=%LOCALAPPDATA%\SpinoraAllBots"
set "CDP=http://127.0.0.1:%PORT%"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
  echo Could not find Google Chrome.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   ONE CHROME — ALL 8 GAME PANELS (separate tabs)
echo ============================================================
echo   Single window, port %PORT%, profile SpinoraAllBots
echo.
echo   Tab 1 Juwa          https://ht.juwa777.com/login  (VPN ON)
echo   Tab 2 Vegas Sweeps  https://agent.lasvegassweeps.com/login
echo   Tab 3 Game Vault    https://agent.gamevault999.com/login
echo   Tab 4 Gameroom      https://agentserver1.gameroom777.com/admin
echo   Tab 5 Cash Machine  https://agentserver.cashmachine777.com/admin
echo   Tab 6 MR All-in-One https://agentserver.mrallinone777.com/admin
echo   Tab 7 Mafia         https://agentserver.mafia77777.com/admin
echo   Tab 8 Cash Frenzy   https://agentserver.cashfrenzy777.com/admin
echo.
echo   Log in on EACH tab. Juwa: turn VPN ON in this Chrome first.
echo   OR skip manual login — run start-all-bots-unified.bat and bots
echo   will auto-login each tab (read CAPTCHA) on startup.
echo   Then run:  start-all-bots-unified.bat
echo ============================================================
echo.

node "%~dp0scripts\patch-chrome-prefs.mjs" "%PROFILE%" 2>nul

curl.exe -s -o nul -w "%%{http_code}" %CDP%/json/version 2>nul | findstr /r "^200$" >nul
if errorlevel 1 (
  echo   Starting unified Chrome on port %PORT%...
  start "" "%CHROME%" --remote-debugging-port=%PORT% --user-data-dir="%PROFILE%" "about:blank"
  echo   Waiting for Chrome debug port...
  set /a TRIES=0
  :wait_port
  timeout /t 2 /nobreak >nul
  curl.exe -s -o nul -w "%%{http_code}" %CDP%/json/version 2>nul | findstr /r "^200$" >nul
  if not errorlevel 1 goto :port_ready
  set /a TRIES+=1
  if !TRIES! LSS 15 goto :wait_port
  echo   ERROR: Chrome did not open debug port %PORT% in time.
  pause
  exit /b 1
) else (
  echo   Chrome already on port %PORT% — will add any missing tabs...
)

:port_ready
echo.
echo   Disabling Chrome password breach popups for bot profile...
node "%~dp0scripts\patch-chrome-prefs.mjs" "%PROFILE%" 2>nul
echo.
echo   Opening all 8 panel tabs (Juwa + Vegas Sweeps + 6 others)...
echo.

cd /d "%~dp0juwa-bot"
if not exist "node_modules\playwright" (
  echo   Running npm install in juwa-bot first...
  call npm install
)

set SPINORA_CDP_URL=%CDP%
node scripts\open-unified-tabs.mjs
set "TAB_EXIT=!ERRORLEVEL!"

cd /d "%~dp0"
echo.
if !TAB_EXIT! NEQ 0 (
  echo   Tab script failed. Close other Chrome on port 9222 and retry.
) else (
  echo   Done — one Chrome window, 8 tabs. Run start-all-bots-unified.bat
  echo   (bots auto-login + read CAPTCHA on each tab at startup).
)
echo.
pause
exit /b !TAB_EXIT!
