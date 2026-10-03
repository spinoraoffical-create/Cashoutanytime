@echo off
title Spinora - Sync Bot .env Files
cd /d "%~dp0"
node sync-bot-env.mjs
pause
