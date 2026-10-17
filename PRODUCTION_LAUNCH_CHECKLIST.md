# Production launch checklist

Production is not ready. Do not deploy. Do not enable live money.

## Must be true before a launch review

- [x] Catalog script has been run on `zecitlewsynyioemsqna`: 5 categories, 12 active games, 19 inactive games, 0 duplicates.
- [ ] The live website games page shows those 12 games after a refresh. The database rows are in place. The page was not opened in a browser in this pass.
- [ ] The 19 extra games are still inactive.
- [ ] No old Spinora customer, wallet, or KYC row was imported.
- [ ] Signup confirmation link arrives from the `sweeptakehub.com` sender and opens `/auth/callback`.
- [ ] Super Admin still signs in. Profile role is still `customer`.
- [ ] A store or staff test user cannot open another store's players or approve a payout.
- [ ] Paydora deposit and payout have passed a sandbox or mocked test. Not done.
- [ ] Webhook signature rejection has been shown with a bad signature. Code exists. Live test not done.
- [ ] Each game you want to load has its own agent login, and one non-live test is recorded. Not done.
- [ ] Panda Master stays catalog-only until a provider client exists.
- [ ] Stale-load migration is either approved and applied, or left off the hosted database on purpose. Today it is tested locally only.
- [ ] `fail_stale_game_loads` on the hosted database is still the stub until that approval. Stuck loads there are not marked and are not refunded.
- [ ] Production Vercel points at the new Supabase URL and keys, not the old project.
- [ ] Preview does not contain live Paydora or game passwords.
- [ ] The Paydora webhook URL is changed only when you say so.
- [x] Typecheck, lint, and a local production build passed. The build was not deployed.

## Rollback

- Site: redeploy the previous Vercel production deployment from the Vercel dashboard.
- Catalog: do not drop tables. A later script can delete only the inserted slugs if no player account or load points at them. Do not run that unless you ask.
- Wallet functions: do not replace them with an older copy.

## Launch statement

Do not call the site restored for real-money play. The catalog, email delivery, Paydora, and game providers are still outside this session.
