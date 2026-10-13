# Production launch checklist

Date: 13 October 2026. This is not a statement that the site is ready for real money.

## Do not do these yet

- [ ] Do not push this work until you have read `FIX_REPORT.md`.
- [ ] Do not deploy until the two SQL files below are either run by you or explicitly skipped.
- [ ] Do not email the 77-person campaign.

## SQL waiting for you

Run these only in the Supabase SQL editor, one file at a time, after you accept the effect.

- [ ] `supabase/migrations/20261013000130_hold_unknown_game_loads.sql`  
  Effect: a timed-out game load stays pending. The database stops refunding it automatically. A person has to check the game before the wallet is returned.  
  Recovery: the previous function body is in `supabase/migrations/20261008000160_financial_trust.sql` under `fail_stale_game_loads`. Restoring it brings back the automatic refund.

- [ ] `supabase/migrations/20261013000140_kyc_private_bucket.sql`  
  Effect: creates a private bucket so new ID photos are not stored as text. Old ID rows are left as they are.  
  Recovery: you can remove the `kyc-documents` bucket in Storage if it is empty. Do not delete `kyc_submissions`.

Until the bucket file is run, a new ID upload is refused.

## Still true from the earlier checklist

- [ ] Confirm `reserve_paydora_payout` exists before a real cash out. If it does not, run `supabase/migrations/20261011000270_paydora_payout_reservation.sql` once.
- [ ] Confirm `RESEND_API_KEY` on the host before any email test. Send one staff email only. Do not resume the failed campaign.
- [ ] If Email campaigns says the tables are missing permissions, run only the two `grant` lines in `LAUNCH_CHECKLIST.md`.
- [ ] Leave newsletter, Telegram, and AI blog off the Vercel schedule until you want those messages to go out.
- [ ] `vercel.json` still schedules only `/api/cron/seo-index`.

## After the SQL, on a test player only

- [ ] Load a small amount. If the game accepts it, the wallet stays down and the game balance goes up once.
- [ ] Repeat the same load request. It must not charge a second time while the first row is open.
- [ ] If the game says the account does not exist, the wallet comes back once. Clicking again must not return it twice.
- [ ] If the game connection times out, the row stays pending and the wallet is not returned until a person checks the game.
- [ ] Open another player's deposit status while signed in as a test player. It should say not found.
- [ ] Sign in as a store and try to pay a player who is not on that store's code. It should be refused.

## Test evidence already collected

19 script files passed. `scripts/auto-money.test.mjs` failed on an older wallet-page assertion. TypeScript passed. `npx next lint` exited 0 with existing warnings. `npx next build` exited 0. Details are in `FINANCIAL_TEST_RESULTS.md` and `SECURITY_TEST_RESULTS.md`.

**NOT VERIFIED FOR REAL-MONEY PRODUCTION LAUNCH.**
