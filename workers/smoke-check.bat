@echo off
title Spinora - Bot Smoke Check
cd /d "%~dp0"
node scripts\smoke-check.mjs
pause
