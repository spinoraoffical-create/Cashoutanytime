# Spinora MR All In One Bot

Automates the **MR All In One** layui agent panel ([agentserver.mrallinone777.com/admin](https://agentserver.mrallinone777.com/admin)) for account creation, load, redeem, and balance checks. Same panel family as Gameroom.

## Setup

```bash
cd workers/mr-all-in-one-bot
npm install
npx playwright install chrome
cp .env.example .env   # fill Supabase + agent credentials
```

## Running

```bat
start-chrome-for-bot.bat   REM Chrome on port 9227
REM Log in as your agent, open Game User → User Management
REM Set MRALLINONE_CDP_URL=http://127.0.0.1:9227 in .env
start-bot.bat
```

Claims Supabase jobs for game slug `mr-all-in-one`.
