# Launch checklist

Date: 13 October 2026  
Use this before you treat the site as ready for players.  
Do not paste secret keys into chat. Do not run a player email campaign from this list.

## Blockers

- [ ] **Game-load refunds.** A load that sits unfinished for about two minutes can be marked failed without putting the wallet money back. Fix `clearStaleRequests` in `src/lib/actions/game-loads.ts` so it uses `refund_game_load_wallet` or `fail_stale_game_loads`. Retest on a disposable player only.
- [ ] **Spam limits.** The app calls `check_rate_limit` with argument names the database function does not use. Update `src/lib/rate-limit.ts` to match `supabase/migrations/20261011000260_anti_spam_multi_account.sql`, then try repeated deposit clicks on a test account.
- [ ] **Cash outs.** In the Supabase SQL editor, confirm `reserve_paydora_payout` exists. If it does not, run `supabase/migrations/20261011000270_paydora_payout_reservation.sql` once. Then cash out $1 on a test account that has an approved ID.
- [ ] **Email key.** In Vercel Production, confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` exist. Send one test to a staff inbox from the newsletter screen. Do not resume the old 77-person campaign until that test arrives.
- [ ] **Newsletter page.** Sign in as Super Admin and open Email campaigns. If it says the tables are not set up, run only these two lines in the SQL editor:

```sql
grant all on table public.newsletter_campaigns to service_role;
grant all on table public.newsletter_campaign_recipients to service_role;
```

- [ ] **Manual cash-out button.** `payoutCashout` can pay any player for anyone with the money permission. Limit it to players that staff member is allowed to see before you add more admins.
- [ ] **ID photos.** New ID uploads are stored as a long text field in `kyc_submissions`. Move them to a private Storage bucket, with a size limit, before you ask more players for IDs.
- [ ] **Automatic posts.** `vercel.json` schedules only the daily SEO job. Leave newsletter, Telegram, and AI blog unscheduled until you want those messages to go out.

## Sign-in

- [ ] Sign up with a new test email and confirm the code is 6 digits. If the email contains 8 digits, set Supabase Email OTP length to 6.
- [ ] Sign in with Google on `https://www.sweeptakehub.com` and refresh. You should stay signed in.
- [ ] Open `/admin` while signed out. You should land on the login page.
- [ ] Sign in as a normal player and open `/admin`. You should be sent away.

## Money

- [ ] Deposit the smallest listed amount on a test player. The wallet should increase once. Refresh the payment page and confirm it does not increase a second time for the same payment.
- [ ] Start a second deposit and cancel it. The wallet should not increase.
- [ ] Cash out is refused when the ID is not approved.
- [ ] A cash-out above the automatic limit stays on hold and does not leave the wallet twice.
- [ ] A failed game load that never reached the game returns the wallet amount.
- [ ] A game load that the provider accepted is not marked successful when the provider said no.

## People and permissions

- [ ] Super Admin sees Overview, Money, Players, Support, Rewards, Marketing, Website, Automation, and Settings.
- [ ] A store creator sees only that store’s players and deposits.
- [ ] A sub-creator sees only players on that sub-creator’s code.
- [ ] A store creator who opens Support is sent to their own inbox, not the Super Admin ticket list.

## Messages and consent

- [ ] A player with email notices off does not receive a campaign.
- [ ] A player with SMS notices off does not receive an offer text.
- [ ] Phone and WhatsApp on the marketing page still sends one person at a time.
- [ ] The public WhatsApp button uses your real number, not `1234567890`.

## Safety

- [ ] From a test connection in Washington, Idaho, Nevada, or Michigan, the site opens the restricted page and deposit checkout is refused.
- [ ] `CRON_SECRET` is set in Vercel. A cron address without the secret returns 401 or 503.
- [ ] `PAYDORA_WEBHOOK_SECRET` is set. Do not send a fake webhook.
- [ ] No `.env.local` file is in git.

## After the blockers

- [ ] Re-run `node scripts/auto-money.test.mjs` and expect it to pass only after the refund path and the test expectations match.
- [ ] Re-run the other scripts listed in `TEST_RESULTS.md`.
- [ ] Deploy only after the money checks above pass on a test account.
