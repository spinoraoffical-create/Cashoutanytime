# Spinora Cash Machine Bot

Automates the **Cash Machine** layui agent panel ([agentserver.cashmachine777.com/admin](https://agentserver.cashmachine777.com/admin)) for account creation, load, redeem, and balance checks. Same panel family as Gameroom.

## Setup

```bash
cd workers/cashmachine-bot
npm install
npx playwright install chrome
cp .env.example .env   # fill Supabase + agent credentials
```

## Running

```bat
start-chrome-for-bot.bat   REM Chrome on port 9226
REM Log in as your agent, open Game User → User Management
REM Set CASHMACHINE_CDP_URL=http://127.0.0.1:9226 in .env
start-bot.bat
```

Claims Supabase jobs for game slug `cash-machine`.
