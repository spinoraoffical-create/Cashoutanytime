# Secret rotation checklist

Date: 17 October 2026

Do not paste any secret into chat, git, or this file. Confirm each item by name and date only.

This checklist does not rotate anything. Production values were not read.

## Database

- [ ] Supabase database password for project `zecitlewsynyioemsqna`
- [ ] Confirm the old password no longer connects
- [ ] Confirm the application still uses the URL, anon key, and service-role key, not the database password

## Supabase API keys

- [ ] `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production and Preview
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` if it was ever copied outside Vercel
- [ ] Redeploy only after the owner approves a release. Rotating a key without a deploy leaves the old key in the running deployment.

## Payments

- [ ] `PAYDORA_API_KEY`
- [ ] `PAYDORA_WEBHOOK_SECRET`

## Game agent secrets

Rotate the password, secret, or agent id for each name that exists in production. Usernames can stay if the provider requires them. Do not print the new values.

- [ ] Juwa: `JUWA_AGENT_ID`, `JUWA_SECRET_KEY`
- [ ] Game Vault: `GAMEVAULT_AGENT_ID`, `GAMEVAULT_SECRET_KEY`
- [ ] Vegas Sweeps: `VEGAS_AGENT_ID`, `VEGAS_SECRET_KEY`
- [ ] Cash Frenzy: `CASHFRENZY_AGENT_PASSWORD`
- [ ] Cash Machine: `CASHMACHINE_AGENT_PASSWORD`
- [ ] Game Room: `GAMEROOM_AGENT_PASSWORD`
- [ ] Mr All In One: `MRALLINONE_AGENT_PASSWORD`
- [ ] Fire Kirin: `FIREKIRIN_AGENT_PASSWORD`
- [ ] Milky Way: `MILKYWAY_AGENT_PASSWORD`
- [ ] Orion Stars: `ORIONSTARS_AGENT_PASSWORD`

## After rotation

- [ ] Record the date next to each name in the password manager
- [ ] Run one read-only balance check per provider without printing the secret
- [ ] Leave real deposits, loads, redemptions, and payouts off
