# Spinora game bots — start all & health check

## Quick start

### Option A — One Chrome, 8 tabs (recommended)

1. Copy `workers/.env.example` → `workers/.env` and fill Supabase + CAPTCHA keys
2. **`sync-bot-env.bat`** — copies shared keys into all 8 bot `.env` files
3. **`set-bot-credentials.bat`** — agent panel username/password for all games
4. **`smoke-check.bat`** — verify env, deps, Chrome (optional)
5. **`start-unified-chrome.bat`** — one Chrome window, 8 tabs (port 9222)
6. Log in on each tab (VPN on for Juwa tab) — or let bots auto-login via 2Captcha
7. **`start-all-bots-unified.bat`** — all bots share that Chrome

**24/7 auto-restart:** `start-all-advanced-free.bat` (sync → Chrome → watchdog)

**Admin dashboard:** `/admin/bot-status` shows live heartbeats from each bot.

### Option B — Eight separate Chrome windows (original)

1. **`check-all-bots.bat`** — verify `.env`, `node_modules`, Chrome ports
2. **`start-all-chrome.bat`** — open 8 Chrome profiles (ports 9222–9229)
3. Log in on each agent panel (VPN on Juwa)
4. **`start-all-bots.bat`** — start all 8 bot pollers in separate cmd windows

Or run **`start-all.bat`** for the full guided flow (Option B).

## Bot status (code audit)

| Game | Folder | Port | Create | Load | Redeem | Balance | UI type |
|------|--------|------|--------|------|--------|---------|---------|
| Juwa | `juwa-bot` | 9222 | ✅ | ✅ | ✅ | ✅ | Opens https://ht.juwa777.com/login — VPN required |
| Vegas Sweeps | `vegas-bot` | 9223 | ✅ | ✅ | ✅ | ✅ | Opens https://agent.lasvegassweeps.com/login |
| Game Vault | `gamevault-bot` | 9224 | ✅ | ✅ | ✅ | ✅ | Element |
| Gameroom | `gameroom-bot` | 9225 | ✅ | ✅ | ✅ | ✅ | Layui |
| Cash Machine | `cashmachine-bot` | 9226 | ✅ | ✅ | ✅ | ✅ | Layui |
| MR All-in-One | `mr-all-in-one-bot` | 9227 | ✅ | ✅ | ✅ | ✅ | Layui |
| Mafia | `mafia-bot` | 9228 | ✅ | ✅ | ✅ | ✅ | Layui |
| Cash Frenzy | `cash-frenzy-bot` | 9229 | ✅ | ✅ | ✅ | ✅ | Layui iframes |

**Runtime note:** TypeScript strict checks may warn on Supabase client types; bots run via `tsx` and work in production when Chrome is logged in.

**Live panel test:** Queue a $1 load or create-account on the website for each game to confirm end-to-end.

## 24/7 operation

- **`start-all-advanced-free.bat`** — syncs env, starts Chrome + watchdog (auto-restarts crashed bots)
- Leave Chrome + watchdog window open; disable PC sleep when plugged in
- **`smoke-check.bat`** — run anytime to verify config
- Sessions auto-refresh every 60s via session keeper; CAPTCHA via OCR + 2Captcha API
- Monitor live status at **`/admin/bot-status`** (heartbeats every 30s)

## Per-game manual start

Each `workers/<game>-bot/` folder still has `start-chrome-for-bot.bat` and `start-bot.bat` for single-game use.
