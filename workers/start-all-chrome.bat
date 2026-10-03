@echo off
title Spinora - Start All Bot Chrome Windows
cd /d "%~dp0"

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
echo   START ALL BOT CHROME WINDOWS (8 separate profiles)
echo ============================================================
echo.
echo   Port  Game              Opens to
echo   ----  ----------------  ----------------------------------------
echo   9222  Juwa              https://ht.juwa777.com/login (+ VPN)
echo   9223  Vegas Sweeps      https://agent.lasvegassweeps.com/login
echo   9224  Game Vault        agent.gamevault999.com/login
echo   9225  Gameroom          agentserver1.gameroom777.com/admin
echo   9226  Cash Machine      agentserver.cashmachine777.com/admin
echo   9227  MR All-in-One     agentserver.mrallinone777.com/admin
echo   9228  Mafia             agentserver.mafia77777.com/admin
echo   9229  Cash Frenzy       agentserver.cashfrenzy777.com/admin
echo.
echo   Log in to EACH window (VPN where needed), then run start-all-bots.bat
echo ============================================================
echo.

start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\SpinoraJuwaBot" "https://ht.juwa777.com/login"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9223 --user-data-dir="%LOCALAPPDATA%\SpinoraVegasBot" "https://agent.lasvegassweeps.com/login"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9224 --user-data-dir="%LOCALAPPDATA%\SpinoraGameVaultBot" "https://agent.gamevault999.com/login"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9225 --user-data-dir="%LOCALAPPDATA%\SpinoraGameroomBot" "https://agentserver1.gameroom777.com/admin"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9226 --user-data-dir="%LOCALAPPDATA%\SpinoraCashmachineBot" "https://agentserver.cashmachine777.com/admin"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9227 --user-data-dir="%LOCALAPPDATA%\SpinoraMrAllInOneBot" "https://agentserver.mrallinone777.com/admin"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9228 --user-data-dir="%LOCALAPPDATA%\SpinoraMafiaBot" "https://agentserver.mafia77777.com/admin"
timeout /t 2 /nobreak >nul

start "" "%CHROME%" --remote-debugging-port=9229 --user-data-dir="%LOCALAPPDATA%\SpinoraCashFrenzyBot" "https://agentserver.cashfrenzy777.com/admin"

echo.
echo   All 8 Chrome windows launched.
echo   Log in on each panel, then run:  start-all-bots.bat
echo.
pause
