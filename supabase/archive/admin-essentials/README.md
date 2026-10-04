# Spinora Admin Essentials (safe SQL bundle)

**Folder:** `supabase/admin-essentials/`

This bundle adds the **new admin panel tables** on top of your **existing Spinora database**.

## Can Cursor edit my Supabase directly?

**No.** I cannot log into your Supabase project. Only you can paste these files in:

https://supabase.com/dashboard/project/drpitkvjcwrbzzufwwjt/sql/new

## Will my old data be lost?

**No — if you use THIS folder only.**

| Safe (this folder) | Unsafe (do NOT run) |
|---|---|
| Creates **new** tables (`roles`, `support_tickets`, `promotions`, …) | Recreates `profiles` |
| Does **not** drop or truncate anything | Full WinSweeps profiles migration |
| Does **not** touch chat, deposits, wallets | Duplicate wallet / game_load SQL |
| Keeps Spinora `profiles`, `conversations`, `referrals` | Re-run `schema.sql` if DB already works |

Your users, chat history, deposits, wallet loads, and transactions stay as they are.

## Do NOT re-run (Spinora base — already on your DB)

If login + chat + deposits already work, skip everything in `supabase/supabase/MIGRATION-ORDER.md`.

## Paste order (one file → Run → next file)

| # | File |
|---|------|
| 1 | `01-extensions-types.sql` |
| 2 | `02-rbac.sql` |
| 2b | `02b-profile-columns-spinora.sql` |
| 3 | `03-vip.sql` |
| 4 | `04-rewards-ledger.sql` |
| 5 | `05-achievements.sql` |
| 6 | `06-leaderboards.sql` |
| 7 | `07-promotions-banners-broadcasts.sql` |
| 8 | `08-support-cms-audit.sql` |
| 9 | `09-claim-engine.sql` |
| 10 | `10-rls-new-tables-only.sql` |
| 11 | `11-storage-realtime.sql` |
| 12 | `12-seed.sql` |
| 13 | `13-contact-promo-seed.sql` |
| 14 | `14-rate-limiting.sql` |
| 15 | `15-function-grants.sql` |
| 16 | `16-public-profiles-spinora.sql` |
| 17 | `17-games-requests.sql` |
| 18 | `18-blog-seed.sql` |
| 19 | `19-fix-promotions.sql` |
| 20 | `20-requests-user-id.sql` |
| 21 | `21-games-play-urls.sql` |
| 22 | `22-blog-posts-extra.sql` |
| 23 | `23-ticket-messages-realtime.sql` |
| 24 | `24-game-accounts.sql` |
| 25 | `25-game-server-creds.sql` |
| 26 | `26-payment-proofs-bucket.sql` |
| 27 | `27-provision-jobs.sql` |
| 28 | `28-ticket-messages-fix.sql` |
| 29 | `29-grant-fns-bypass.sql` |
| 30 | `30-payment-methods.sql` |
| 31 | `31-geo-cms.sql` |
| 32 | `32-blog-how-to-win.sql` |
| 33 | `33-telegram-links.sql` |
| 34 | `34-widen-requests-payment.sql` |
| 35 | `35-blog-batch2.sql` |
| 36 | `36-faq-wallet-flow.sql` |
| 37 | `37-blog-payment-methods.sql` |
| 38 | `38-geo-tampa.sql` |
| 39 | `39-blog-post-status.sql` |
| 40 | `40-geo-hero-image.sql` |
| 41 | `41-telegram-promo.sql` |
| 42 | `42-player-reviews.sql` |
| 43 | `43-banner-popup.sql` |
| 44 | `44-newsletters.sql` |
| 45 | `45-admin-hard-delete.sql` |
| 46 | `46-blog-next-gen.sql` |
| 47 | `17-profiles-admin-compat.sql` |
| **48** | **`99-grant-admin.sql`** ← edit email first, run last |

## If a file errors

| Error | Action |
|-------|--------|
| `already exists` | Skip that file, continue |
| `relation does not exist` | You skipped a required earlier file — go back |
| `column does not exist` | Share the file name + error for a Spinora tweak |

## After running

1. Edit `99-grant-admin.sql` — put your email
2. Run it
3. Open `/admin` on your site

## What works without this SQL

Even before running anything, these admin pages work with `profiles.role = 'admin'`:

- Live Chat, Deposits, Wallet Loads, Transactions, Fraud

## What needs this SQL

Roles, Promotions, CMS, Support Tickets, Newsletters, Audit Logs, Analytics, etc.
