# Spinora Mafia Bot

Automates the **Mafia** layui agent panel ([agentserver.mafia77777.com/admin](https://agentserver.mafia77777.com/admin)) for account creation, load, redeem, and balance checks.

## Setup

```bash
cd workers/mafia-bot
npm install
npx playwright install chrome
cp .env.example .env   # fill Supabase + agent credentials
```

## Running

```bat
start-chrome-for-bot.bat   REM Chrome on port 9228
REM Log in as your agent, open Game User → User Management
REM Set MAFIA_CDP_URL=http://127.0.0.1:9228 in .env
start-bot.bat
```

Claims Supabase jobs for game slug `mafia`.
