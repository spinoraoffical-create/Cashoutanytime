# Spinora Gameroom Bot

Automates the **Gameroom** agent panel (`agentserver1.gameroom777.com`) for account
creation, recharge (load), redeem, and balance checks. Layui admin panel with iframe
player views.

## Setup

```bash
cd workers/gameroom-bot
npm install
npx playwright install chrome
cp ../bot.env.example .env   # then run sync-bot-env.bat + set-bot-credentials.bat
```

Fill `.env` (or sync from `workers/.env`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same project as Spinora.
- `GAMEROOM_AGENT_USERNAME` / `GAMEROOM_AGENT_PASSWORD` — agent panel login.
- `CAPTCHA_API_KEY` — 2Captcha for auto-login.

## Running (unified Chrome — recommended)

```bat
cd workers
sync-bot-env.bat
start-unified-chrome.bat        REM one Chrome, port 9222
start-all-bots-unified.bat      REM all 8 bots share that Chrome
```

Or single-bot:

```bat
start-chrome-for-bot.bat        REM opens Chrome on port 9225
REM log in to the panel (or let bot auto-login with CAPTCHA)
set GAMEROOM_CDP_URL=http://127.0.0.1:9225
start-bot.bat
```

## Verifying selectors (optional)

```bash
GAMEROOM_HEADLESS=false npm run probe
npx tsx scripts/test-readonly.ts <account>
```

## How jobs flow

1. The website inserts a `game_load_requests` row (slug `gameroom`).
2. This worker calls `claim_next_game_load('gameroom')`.
3. It performs the panel action and calls `complete_game_load(...)`.
4. The user gets an in-app notification with the result.

`load_type` handled: `create_account` / `new_account`, `load` / `reload`,
`redeem` (supports redeem-all), and `check_balance`.
