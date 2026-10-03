# Spinora US database setup (drpitkvjcwrbzzufwwjt)

Run each file in **Supabase SQL Editor** in this order:

https://supabase.com/dashboard/project/drpitkvjcwrbzzufwwjt/sql/new

| # | File |
|---|------|
| 1 | `schema.sql` |
| 2 | `signup-email-phone.sql` |
| 3 | `auth-phone.sql` |
| 4 | `auth-email-otp.sql` |
| 5 | `welcome-message.sql` |
| 6 | `chat-attachments.sql` |
| 7 | `deposit-requests.sql` |
| 8 | `deposit-usdt-payment.sql` |
| 9 | `wheel-spins.sql` |
| 10 | `wallets.sql` |
| 11 | `wallet-cashout.sql` |
| 12 | `daily-tasks.sql` |
| 13 | `daily-tasks-realtime.sql` |
| 14 | `task-proof-attachments.sql` |
| 15 | `reviews.sql` |
| 16 | `reviews-admin-comment.sql` |
| 17 | `reviews-public-read.sql` |
| 18 | `message-notifications.sql` |
| 19 | `notifications-rpc.sql` |
| 20 | `admin-presence.sql` |
| 21 | `game-requests-realtime.sql` |

## After SQL — Dashboard settings

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000` (dev) / `https://spinoracasinos.com` (before deploy)
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://spinoracasinos.com/auth/callback`

**Authentication → Providers → Email** — enable + confirm email if used

**SMTP** — copy Resend settings from old project (see `.env.example`)

**Google OAuth** — enable + add callback:
`https://drpitkvjcwrbzzufwwjt.supabase.co/auth/v1/callback`

## Make yourself admin (after first signup)

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL@example.com';
```

## Before production deploy

Update Vercel env vars (do not deploy until SQL + auth are tested locally):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
