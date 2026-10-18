# Production execution result

Date: 18 October 2026

Public safety release: the approved steps A through F were executed and checked. This is not a real-money launch.

Real-money deposits: NO-GO

Game loads: NO-GO for every provider

Redemptions: NO-GO

Payouts: NO-GO

Full real-money launch: NO-GO

No customer balance changed. No real identity decision was made. No provider was called. No storage file was deleted or replaced. The old Spinora project was not contacted. Credentials were not rotated.

## Actions

| Action | Result | When (UTC) |
| --- | --- | --- |
| A. Stop new Paydora checkouts | COMPLETED | Key removed, then the current site was republished. Checked at 05:54. |
| B. Pause the eight active providers | COMPLETED | 05:55:41 |
| C. Database financial guard, all controls off | COMPLETED | Applied, then checked at 05:56:37 and again at 05:58:39 |
| D. Deploy the safety-fixed website | COMPLETED | Deployment created 05:59:09 |
| E. KYC decision repair | COMPLETED | Checked at 06:03:46 |
| F. Stale-load repair | COMPLETED | Checked at 06:04:35 |

## What was deployed

- Vercel project: `cashoutanytime`
- Production domain: `https://www.sweeptakehub.com` and `https://sweeptakehub.com`
- Deployment now serving that domain: `dpl_HdYKxe2bJKWUuyjuG5WpBEDV1Ti8`
- The domain was inspected after the deploy and that id was the one attached to it.
- Git base: `2f170db003abd97a3d754d7ee7c6df8668c79994` on `restore/public-game-catalog`
- The safety fixes were still uncommitted. Vercel uploaded that working tree. There is no separate commit hash for the safety fixes.

Step A first republished the previous application as `dpl_6DCEjNPS1j9GDbmBMX7fbYqBxVQS` so the running site lost the Paydora API key before the new build went out. Step D then replaced that with the safety-fixed build.

## Money controls

All five application switches are absent from the Vercel production environment, so the new code keeps them off.

| Control | Value |
| --- | --- |
| `REAL_VALUE_DEPOSITS` | Absent |
| `REAL_VALUE_GAME_LOADS` | Absent |
| `REAL_VALUE_REDEMPTIONS` | Absent |
| `REAL_VALUE_PAYOUTS` | Absent |
| `REAL_VALUE_ADJUSTMENTS` | Absent |
| Database `deposits` | off |
| Database `game_loads` | off |
| Database `redemptions` | off |
| Database `payouts` | off |
| Database `adjustments` | off |

`PAYDORA_API_KEY` is no longer in the production environment. `PAYDORA_WEBHOOK_SECRET` is still there. Removing the key from Vercel does not revoke it at Paydora. That revocation still needs a separate rotation approval.

The three guard triggers exist and are enabled:

- `trg_real_value_wallet_ledger` on `wallet_ledger`
- `trg_real_value_game_load` on `game_load_requests`
- `trg_real_value_paydora_event` on `paydora_processed_events`

A rolled-back production probe raised `real value off` for a deposit ledger row, an adjustment ledger row, a paid load, a redeem, a Paydora credit, and a Paydora debit. A payout-void credit and a refund debit were accepted by the guard and then rolled back. After that probe, processed Paydora events were still 0 and the ledger was still 0.

## Provider pause

The live pause table originally allowed only Fire Kirin, Milky Way, and Orion Stars. Those three were already paused. The check was widened so the eight active providers could be stored, and those eight were set to paused. Game catalog flags were not turned off, so the public catalog still lists them.

Paused: Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, Mafia, Fire Kirin, Milky Way, Orion Stars. None are unpaused. 11 paused, 0 resumed.

The Juwa-style fulfillment code does not read this pause table. Paid loads and redeems are stopped by the database guard and, on the new website, by the absent application switches. A zero-amount account request can still be inserted. That path does not debit the wallet. It was left that way because the reviewed guard allows it.

No provider API was called.

## KYC

`admin_decide_kyc` now uses the narrow `app.kyc_status_update` flag. The profile guard recognizes that flag. Execute is granted to `service_role` and not to `anon` or `authenticated`.

The one real submission is still pending. It was not approved or rejected. Its file was not opened. Storage still has 1 object.

## Stale loads

`fail_stale_game_loads` now contains the hold-for-review wording and is no longer the old function that only returned 0. The function was not called. Load rows are unchanged: 12 completed, 1 failed, 0 held-for-review notes. There was no open pending or processing row to mark.

## Balances and payments

| Check | Before | After |
| --- | --- | --- |
| Profiles | 5 | 5 |
| Wallet total | 0.00 | 0.00 |
| Cash-out total | 0.00 | 0.00 |
| Bonus total | 0.00 | 0.00 |
| Ledger rows | 0 | 0 |
| Game-load rows | 13 | 13 |
| Payment intents | 1 | 1 |
| Webhook events | 0 | 0 |
| Processed Paydora events | 0 | 0 |
| Payout requests | 0 | 0 |
| Storage objects | 1 | 1 |

The one payment intent is still uncredited. Id `0c70e8b2-7e6f-466a-820c-d9879fbff66d`, provider Paydora, external id `6ad2f76612536669727a47b6`, amount 10.99, created 2026-10-17 04:19:51 UTC, final credit empty. There is no webhook row for it. Do not credit it from the browser. A later signed callback can still arrive. The guard will refuse the wallet credit. That payment needs a manual decision later. It was not refunded and it was not deleted.

## Domain checks

| Page or call | Result |
| --- | --- |
| `/`, `/play`, `/login`, `/privacy`, `/terms`, `/faq`, `/robots.txt`, `/sitemap.xml` | 200 |
| `/play` catalog | 8 games: Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Mafia, Mr All In One, Cash Machine, Game Room |
| `/admin` without a session | 307 to `/login?redirect=%2Fadmin` |
| Paydora methods | 500, deposits unavailable. This call fails before a Paydora charge can be created. |
| Paydora create, signed out | 401 |
| Paydora payout, signed out | 401 |
| Paydora webhook with an empty body | 401 INVALID SIGNATURE. The webhook secret is still in use. Nothing was credited. |

A signed-in admin, staff, or store session was not opened. Unsigned admin traffic is sent to login. That does not prove a staff password login.

## Tests before the production changes

- 39 application tests passed.
- TypeScript passed.
- ESLint passed with the existing warnings.
- Production build passed locally and again on Vercel.
- Production dependency audit found 0 issues.

## Backup

The encrypted backup from earlier today still decrypts. The key remains in a separate folder. Login recovery was already verified in an isolated database. The private identity image bytes are still not in the backup. Storage was not changed.

## Emergency recovery

Do not drop the guard triggers. Dropping one reopens that money path.

Do not put `PAYDORA_API_KEY` back.

Do not promote `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`. That deployment was built while the Paydora API key was still configured.

If the new website cannot be browsed, the last instance created after the key was removed and before this build is `dpl_6DCEjNPS1j9GDbmBMX7fbYqBxVQS`. Leave the guard in place either way.

To undo the identity function later, reapply `supabase/migrations/20261014000160_admin_decide_kyc.sql`. That restores the function that currently rolls back. Do not try it on the real pending submission.

To resume a provider, set its pause row back to false. The pause function still only accepts Fire Kirin, Milky Way, and Orion Stars, so the other eight need a direct update. Do not resume them in this release.

## Remaining real-money blockers

1. Paydora deposit and payout lifecycles are NOT VERIFIED. No sandbox payment was sent.
2. No game provider load, redeem, or reconciliation test was run. Every provider stays NO-GO.
3. No legal approval was found. Age 18 and the state list in the code are not legal approval.
4. The identity image bytes are not backed up. Do not delete storage.
5. Secrets are not rotated. The Paydora API key was removed from Vercel only. It was not revoked at Paydora.
6. One uncredited Paydora intent remains. It needs a manual decision if Paydora shows a captured payment.
7. Signed-in admin, staff, store, and player screens were not opened.
8. Point-in-time recovery in the Supabase dashboard was not opened.

H, I, J, K, and L were not approved and were not turned on.

## Exact next owner action

Do not enable deposits, loads, redemptions, payouts, or staff adjustments yet.

The next useful owner step is a Paydora sandbox, or a written merchant confirmation, plus one signed test webhook that shows the event name, status, currency, and amount. Until that exists, deposits and payouts stay off.
