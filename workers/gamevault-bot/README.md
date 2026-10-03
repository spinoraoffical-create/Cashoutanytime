# Spinora Game Vault Bot

Automates the **Game Vault** agent panel (`agent.gamevault999.com`) for account
creation, recharge (load), redeem, and balance checks. Same "Backend" panel
software as the Vegas Sweeps bot, so the logic is shared. It polls the same
Supabase queue but only claims jobs for the `game-vault` game.

## Setup

```bash
cd workers/gamevault-bot
npm install
npx playwright install chrome
cp .env.example .env   # then fill in the values
```

Fill `.env`:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same project as Spinora.
- `GAMEVAULT_ADMIN_URL=https://agent.gamevault999.com/login`
- `GAMEVAULT_AGENT_USERNAME` (used only to pre-fill the login form)

## Running (the panel needs a CAPTCHA, so use CDP mode)

```bat
start-chrome-for-bot.bat        REM opens Chrome on port 9224
REM log in to the panel manually (type the captcha)
REM set GAMEVAULT_CDP_URL=http://127.0.0.1:9224 in .env
start-bot.bat
```

If the Chrome session expires, re-run `start-chrome-for-bot.bat`, log in again,
then restart `start-bot.bat`.

## Verifying selectors (optional)

```bash
GAMEVAULT_HEADLESS=false npm run probe          # login + user list dump
node scripts/probe-dialogs.mjs                  # capture create/recharge/redeem dialogs (CDP)
npx tsx scripts/test-readonly.ts <account>      # read a balance (no money moves)
```

## How jobs flow

1. The website inserts a `game_load_requests` row (slug `game-vault`).
2. This worker calls `claim_next_game_load('game-vault')`.
3. It performs the panel action and calls `complete_game_load(...)`.
4. The user gets an in-app notification with the result.

`load_type` handled: `create_account` / `new_account`, `load` / `reload`,
`redeem` (supports redeem-all), and `check_balance`.
