# Final engineering fix report

Date: 17 October 2026

Branch: `restore/public-game-catalog`

Commit still at: `2f170db003abd97a3d754d7ee7c6df8668c79994`

Production deployment still: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

Nothing was committed, pushed, migrated, deployed, or rotated. No player balance, payment, payout, game transfer, or identity decision was made. The old Spinora project was not contacted.

## Money shutdown

- Original finding: The live site can still start deposits and game transfers. The local switches did not cover staff grants, cash wheel prizes, or a direct database call.
- Root cause: Some credit paths used the ledger kind `adjustment`, which the four switches do not map. `request_game_load` and `request_game_redeem` are granted to signed-in players, so they can be called without the website.
- Code change: `adjustmentDenial` blocks staff grants, staff removals, and cash wheel prizes unless `REAL_VALUE_ADJUSTMENTS` is exactly `on`. A cash prize is refused before the spin is saved. The new SQL file adds fail-closed database triggers and starts every control off.
- Files: `src/lib/compliance/real-value.ts`, `src/lib/wallet/service-mutate.ts`, `src/lib/actions/spin.ts`, `supabase/migrations/20261017000600_real_value_db_guard.sql`.
- Tests: `scripts/real-value-controls.test.mjs` passed. All 39 scripts passed.
- Production status: NOT DEPLOYED. The database file is not applied.
- Remaining risk: Until that SQL is applied, a direct database call can still debit a wallet for a game load.
- Owner approval: Required before deploy and before the SQL file.

## Webhooks

- Original finding: A cancelled or failed `deposit.paid` callback could be credited, and a different amount could be credited. Shutdown handling depended on an unverified Paydora retry.
- Root cause: The status check was bypassed by `or event is deposit.paid`, and the credit used the smaller of two amounts.
- Code change: `src/lib/payments/paydora-webhook-decision.ts` decides credit, hold, ignore, or reverse. The route saves a held event and returns HTTP 200. A later retry does not credit a held payment. Amounts must match. Non-USD is rejected. Missing currency is held.
- Files: `src/app/api/payments/paydora/webhook/route.ts`, `src/lib/payments/auto-settle.ts`, `src/lib/payments/paydora.ts`, `scripts/webhook-reconciliation.test.mjs`, `scripts/auto-money.test.mjs`.
- Tests: `scripts/webhook-reconciliation.test.mjs` passed.
- Production status: NOT DEPLOYED.
- Remaining risk: Paydora's live payload and retry policy are UNVERIFIED. A callback without a currency field will be held, not credited.
- Owner approval: Required before any held row is credited.

## Age and location

- Original finding: Location headers could be treated as proof because a request id was present.
- Root cause: `x-vercel-id` was used as evidence. A caller can send that header when the app is not running on Vercel.
- Code change: Money actions trust location headers only when the server variable `VERCEL` is exactly `1`. Missing country, a missing US state, or a forged header off Vercel stops the money action. Public pages stay open. The blocked-state list is still Washington, Idaho, Nevada, and Michigan.
- Files: `src/lib/compliance/restricted-state.ts`, `src/lib/compliance/real-value.ts`.
- Tests: `scripts/restricted-state.test.mjs` and `scripts/real-value-controls.test.mjs` passed.
- Production status: NOT DEPLOYED.
- Remaining risk: IP location is not legal residence. A VPN can change the state. Counsel has not approved the state list or the age of 18.
- Owner approval: Legal review.

## Identity repair

- Original finding: The draft repair reused the wallet bypass flag.
- Root cause: `app.wallet_update` allows every protected profile column.
- Code change: The unapplied SQL now uses `app.kyc_status_update` and still blocks wallet and role changes.
- Files: `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`, `scripts/kyc-decision.test.mjs`.
- Tests: SQL text and screen copy passed. The function was not executed on a database.
- Production status: BLOCKED.
- Owner approval: Required before the SQL is applied. Do not use the real pending record.

## Stale game loads

- Original finding: An unknown transfer must not be refunded or retried.
- Code change: The unapplied SQL marks a stale open row once and does not refund, close, or retry it. A completed row is not selected.
- Files: `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`, `scripts/stale-load-hold.test.mjs`.
- Tests: In-memory simulation passed. SQL was not applied.
- Production status: BLOCKED.
- Owner approval: Required before the SQL is applied.

## Dependencies

- Original finding: Eight high production findings plus a critical Next.js finding on the old live build.
- Code change: Production dependencies now audit clean. TipTap is 3.32.0. Next.js stays 15.5.28. See `DEPENDENCY_REMEDIATION_REPORT.md`.
- Tests: `npm audit --omit=dev` exit 0. `npx tsc --noEmit` exit 0. `npx next lint` exit 0 with existing warnings. `npm run build` exit 0.
- Production status: NOT DEPLOYED. The live site is still Next.js 15.5.19.
- Owner approval: Required before deploy.

## What was not claimed

Backups, point-in-time recovery, legal approval, Paydora approval, secret rotation, live payments, live payouts, live game transfers, and a phone layout check were not verified. Public URLs returned 200, and `/games?q=juwa` returned 308. That does not prove the new code is live.
