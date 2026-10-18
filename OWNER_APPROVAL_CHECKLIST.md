# Owner approval checklist

Date: 17 October 2026

The shutdown order in this file is superseded. Use `RELEASE_APPROVAL_SUMMARY.md` and approve one step at a time. Do not approve a deploy before the database guard.

Say yes or no to each line. Nothing below has been done.

## Release

- [ ] Approve a deploy of the local shutdown build, with all `REAL_VALUE_*` values left unset.
- [ ] Refuse a rollback to deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` while the Paydora key remains.
- [ ] Approve `supabase/migrations/20261017000600_real_value_db_guard.sql` only if you want the database itself to keep money off even if the website is rolled back.
- [ ] Approve `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql` so Approve and Reject can save.
- [ ] Approve `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql` so an unfinished game load can be marked for review without a refund.

## Secrets

Follow `SECRET_ROTATION_CHECKLIST.md`. Do not paste new values into chat. Report only the secret name and the date.

- [ ] Database password
- [ ] Supabase service-role key, if it was exposed
- [ ] Paydora API key and webhook secret
- [ ] Each game-agent password named in the checklist

## Lawyer

- [ ] Confirm the minimum age. The code uses 18.
- [ ] Confirm the blocked states. The code still uses Washington, Idaho, Nevada, and Michigan.
- [ ] Confirm whether official sweepstakes rules, a no-purchase entry, and a free entry method are required.
- [ ] Confirm whether any license or registration is required.
- [ ] Do not treat the privacy page, terms page, or FAQ as legal approval.

## Payment company

- [ ] Get written Paydora approval for this business before any real deposit or payout.
- [ ] Confirm the live webhook currency field. Until a payload shows USD, the local code holds the callback instead of crediting it.

## Backups and alerts

- [ ] In Supabase, for `zecitlewsynyioemsqna`, confirm backups or point-in-time recovery. Do not restore over the live database.
- [ ] Decide whether signup mail, password-reset mail, payment alerts, and game-transfer alerts are required before launch. Those provider keys were not added.

## Real money

- [ ] Leave deposits, game loads, redemptions, payouts, and staff balance edits off.
- [ ] Turn on one switch at a time only after the deploy, the database guard, the secret rotation, the lawyer, and Paydora are done.
