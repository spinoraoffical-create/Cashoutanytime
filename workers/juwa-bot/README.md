# Juwa bot — fully automated (with VPN support)

Juwa needs VPN on your PC. The bot uses **your Google Chrome** (with VPN), not Playwright's Chromium.

## Every day — 2 steps

### Step 1 — Open Chrome with VPN
Double-click: **`start-chrome-for-bot.bat`**

- Chrome opens to the Juwa login page
- **Connect your VPN** in that Chrome window (extension or whatever you normally use)
- Confirm you can open https://ht.juwa777.com/login manually

**First time only:** install your VPN extension in this Chrome window. It saves to a separate profile so your normal Chrome is untouched.

### Step 2 — Start the bot
Double-click: **`start-bot.bat`**

Leave **both windows open**. When a user loads wallet on `/games/juwa`, the bot controls that Chrome window.

---

## If VPN is system-wide (WireGuard, Nord app, etc.)

You may not need CDP mode. Remove `JUWA_CDP_URL` from `.env` — the bot will use `chrome-bot-profile` folder instead.

If Juwa still fails, use the 2-step flow above.

---

## Optional: local proxy from VPN app

Some VPN apps expose a local proxy (e.g. `http://127.0.0.1:7890`). Add to `.env`:

```
JUWA_PROXY=http://127.0.0.1:7890
```

---

## Test

1. Spinora running: `npm run dev`
2. `start-chrome-for-bot.bat` → connect VPN
3. `start-bot.bat`
4. User loads $5 on `/games/juwa`
5. Watch Chrome — bot should log in and load credits

Debug screenshots: `workers/juwa-bot/debug/`
