# Missing configuration checklist

Do not paste any secret into chat. Do not change Production Vercel settings until you approve a production launch.

## Already true

- New Supabase project: `zecitlewsynyioemsqna`
- Schema installed. Super Admin exists. Profile role stays `customer`.
- Old project was not used.

## 1. Game catalog on the live database

Done. The new project now has 5 categories, 12 active games, and 19 inactive games. A second insert was not required. Existing users, profiles, wallet transactions, and provider configs were unchanged.

Rotate the database password in Supabase. It was pasted into chat, so treat it as exposed. Do not paste the new password here.

Supabase → Project `zecitlewsynyioemsqna` → Project Settings → Database → Database password. Choose a new password and save it in your password manager. The website does not use that database password. It uses the Supabase URL and the anon and service-role keys.

## 2. Signup email

In Supabase, project `zecitlewsynyioemsqna`:

1. Authentication → URL Configuration.
2. Site URL: `https://sweeptakehub.com`.
3. Redirect URLs:
   - `https://sweeptakehub.com/auth/callback`
   - `https://www.sweeptakehub.com/auth/callback`
   - `http://localhost:3000/auth/callback`
   - the Preview address plus `/auth/callback`, if you use Preview.
4. Authentication → Emails → SMTP Settings. Turn on Resend for the verified `sweeptakehub.com` sender.
5. Confirm signup template must include `{{ .ConfirmationURL }}`.
6. The signup screen now tells the player to open that link. A code box remains only for an email that also prints a 6-digit code.

Check: register a new test player and open the link in the same browser.

## 3. Leave these empty until you want them live

Vercel project `cashoutanytime`. Add them to Production only when you approve live use. Do not copy them into Preview.

- `PAYDORA_API_KEY`
- `PAYDORA_WEBHOOK_SECRET`
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for app mail
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `TELEGRAM_BOT_TOKEN` and the Telegram chat ids
- `CRON_SECRET`
- `GAME_AUTOMATION_SECRET`
- Each game agent id, username, password, and secret listed in `GAME_PROVIDER_STATUS.md`
- `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` for the AI blog

## 4. Stale-load database change is not approved for the hosted project

`supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql` was tested on the disposable database. It does not refund. Say so in a later message if you want it applied to the new project.

## 5. Git commit

This PC cannot commit. Git reported: author identity unknown. I did not set a name or email. A commit needs your name and email in local Git config, which only you should set.
