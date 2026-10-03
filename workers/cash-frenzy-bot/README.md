# Spinora Cash Frenzy Bot

Automates the **Cash Frenzy** agent panel (`agentserver.cashfrenzy777.com`) for account
creation, recharge (load), redeem, and balance checks. Same **Element Plus "Backend"** UI as
Game Vault — **User List** sidebar, **New Account**, search, **editor → Recharge / Redeem**.
Hosted under `/admin` (do not open `/admin/userManagement`; that route 404s).

## Setup

```bash
cd workers/cash-frenzy-bot
npm install
npx playwright install chrome
cp .env.example .env   # then fill in the values
```

## Running (CAPTCHA — use CDP mode)

```bat
start-chrome-for-bot.bat        REM opens Chrome on port 9229
REM log in manually, then open User List in the sidebar
start-bot.bat
```

Keep **User List** open in bot Chrome. Close any stale tabs on `/admin/userManagement` (404).

## How jobs flow

1. Website queues `game_load_requests` with slug `cash-frenzy`.
2. Worker calls `claim_next_game_load('cash-frenzy')`.
3. Panel action + `complete_game_load(...)`.
4. User gets a notification with credentials or result.
