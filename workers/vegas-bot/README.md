# Spinora Vegas Sweeps Bot

Automates the **Vegas Sweeps** agent panel (`agent.lasvegassweeps.com`) for
account creation, recharge (load), redeem, and balance checks. It polls the same
Supabase queue as the Juwa bot but only claims jobs for the `vegas-sweeps` game.

The infrastructure (queue, Supabase RPCs, notifications, credential rules,
duplicate-username handling) is shared with the Juwa bot. The **only**
game-specific part is `src/vegas-panel.ts` — the Playwright clicks/selectors for
this panel.

## Setup

```bash
cd workers/vegas-bot
npm install
npx playwright install chrome
cp .env.example .env   # then fill in the values
```

Fill `.env`:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same project as Spinora.
- `VEGAS_ADMIN_URL=https://agent.lasvegassweeps.com/login`
- `VEGAS_AGENT_USERNAME`, `VEGAS_AGENT_PASSWORD` — your agent login.

## Verify the selectors first (important)

Because every panel is slightly different, confirm the bot can see the right
fields before running it live:

```bash
# watch the browser
VEGAS_HEADLESS=false npm run probe
```

This logs in, opens User Management, and writes:

- `probe-after-login.png`, `probe-user-management.png`, `probe-new-account.png`
- `probe-user-management.html`, `probe-login.html`
- `TABLE HEADERS`, `CLICKABLE TEXT`, and input lists in the console

If the defaults miss any field/button, set the matching `VEGAS_SEL_*` override
in `.env` (see `.env.example`) using the placeholder/selector you see in the
probe output. Then run a single job:

```bash
npm run run-once
```

## Running

If the panel needs a VPN or a manual CAPTCHA login, drive your own Chrome:

```bat
start-chrome-for-bot.bat        REM opens Chrome on port 9223
REM log in to the panel manually, then set VEGAS_CDP_URL=http://localhost:9223
start-bot.bat
```

Otherwise just:

```bash
npm start
```

## How jobs flow

1. The website inserts a `game_load_requests` row (slug `vegas-sweeps`).
2. This worker calls `claim_next_game_load('vegas-sweeps')`.
3. It performs the panel action and calls `complete_game_load(...)`.
4. The user gets an in-app notification with the result.

`load_type` values handled: `create_account` / `new_account`, `load` / `reload`,
`redeem` (supports redeem-all), and `check_balance`.
