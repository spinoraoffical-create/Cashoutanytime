@echo off
title Spinora - Live Bot Check
cd /d "%~dp0"
node scripts/check-bots-live.mjs
echo.
pause
