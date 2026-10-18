# Sweepstakes Hub final production release

Date: 18 October 2026

Public safety release: **NO-GO**. It is prepared and was not published.

Real-money deposits: **NO-GO**

Game loads: **NO-GO for every provider**

Redemptions: **NO-GO**

Payouts: **NO-GO**

Full real-money launch: **NO-GO**

Nothing was deployed. No production SQL was applied. No provider was called. No customer payment was sent. No real identity decision was made. Credentials were not rotated. The old Spinora project was not contacted.

## Owner decision

Say yes or no to one letter. One yes does not approve the next letter.

| Letter | Action | Decision if you say nothing |
| --- | --- | --- |
| A | Remove the Paydora API key and republish the current website so a new checkout cannot start. Do not publish the new build in this step. | Not done |
| B | Pause Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, and Mafia. | Not done |
| C | Apply only the database money guard. All five rows stay off. | Not done |
| D | Publish the reviewed build to `https://www.sweeptakehub.com` only after A, B, and C are verified. All five switches stay unset. | Not done |
| E | Apply the identity repair. Do not use the real pending submission as the test. | Not done |
| F | Apply the stale-load repair. | Not done |
| G | Rotate credentials one name at a time. Database password, Supabase service-role key, Paydora API key, Paydora webhook secret, and each game-agent secret in `SECRET_ROTATION_CHECKLIST.md`. | Not done |
| H | Enable deposits. | No |
| I | Enable loads for one named provider. | No |
| J | Enable redemptions. | No |
| K | Enable payouts. | No |
| L | Enable staff balance edits. | No |

H through L are not available today.

## Work completed this pass

| Item | Class |
| --- | --- |
| Login schema and 5 users restored in an isolated database, each matched to a profile | VERIFIED IN ISOLATED TEST |
| Decryption of the existing backup checked, then plaintext deleted | VERIFIED IN ISOLATED TEST |
| Encryption key moved out of the backup folder and kept | VERIFIED IN ISOLATED TEST |
| Auth role function reads the JSON role when the legacy claim is empty | VERIFIED IN ISOLATED TEST |
| Three SQL files applied on that restored production schema, controls start off | VERIFIED IN ISOLATED TEST |
| Two overlapping deposit credits created one credit of 25 and one duplicate. Balance became 125, not 150. | VERIFIED IN ISOLATED TEST |
| Two overlapping 80 loads against a 125 balance: one load saved, the other returned insufficient balance. Final balance 45. One row. The five real profiles stayed at 0.00. | VERIFIED IN ISOLATED TEST |
| Private JPEG metadata: bucket `kyc-documents`, not public, 183,920 bytes | VERIFIED IN ISOLATED TEST for metadata only |
| JPEG bytes | NOT VERIFIED. The CLI cannot download the remote object. |
| Paydora checkout, webhook, refund, and payout against Paydora | NOT VERIFIED |
| Game-provider load, redeem, and reconciliation | NOT VERIFIED |
| Legal approval | NOT VERIFIED |
| Production deployment of the new build | NOT VERIFIED. Not done. |

Same-day results that were not repeated: 39 application tests passed, TypeScript passed, ESLint passed with existing warnings, the production build passed, and the production dependency audit found 0 issues.

## Backup status

Details are in `BACKUP_RECOVERY_VERIFICATION.md`.

Database accounts and application rows can be recovered. The identity image bytes cannot yet be recovered from the backup. Do not delete storage.

## Production deployment

No new deployment was published. The last recorded production deployment is `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`. The domain was not switched.

All five application switches remain absent, which means off in the new code. The live site does not use them.

## Database migrations applied to production

None.

Tested only on the disposable copy:

- `supabase/migrations/20261017000600_real_value_db_guard.sql`
- `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`
- `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`

## KYC

The production Approve and Reject path is still broken until E is approved and applied. On the restored copy, the narrow identity flag cannot change a wallet, and a second trigger named `protect_wallet_columns` also blocks wallet edits. The real pending submission was not touched. Its JPEG was not opened.

## Paydora

Owner-reported only. Credentials are not proof. No sandbox payment was available without using the live merchant, so no test payment was sent.

Before H or K can be considered, Paydora needs to supply:

1. A sandbox base URL and a test key, or written confirmation that this merchant account may process sweepstakes deposits and payouts.
2. One signed test webhook showing the event name, status field, currency field, and amount field.
3. Whether a callback is retried after HTTP 200.
4. The payout statuses for accepted, rejected, and timed out.

Until those exist, deposits and payouts stay NOT VERIFIED. Opening a checkout URL would not change that.

One payment intent row exists. It has no status column. Its amount was not credited through a webhook row: the backup has 0 webhook rows and 0 processed Paydora events. Do not credit it from the browser.

## Game providers

No provider was contacted. Catalog and pause flags are unchanged from the restored production data.

| Provider | Catalog | Paused | Load and redeem |
| --- | --- | --- | --- |
| Juwa | Active | No | NOT VERIFIED |
| Game Vault | Active | No | NOT VERIFIED |
| Vegas Sweeps | Active | No | NOT VERIFIED |
| Cash Frenzy | Active | No | NOT VERIFIED |
| Cash Machine | Active | No | NOT VERIFIED |
| Game Room | Active | No | NOT VERIFIED |
| Mr All In One | Active | No | NOT VERIFIED |
| Mafia | Active | No | NOT VERIFIED |
| Fire Kirin | Inactive | Yes | NOT VERIFIED |
| Milky Way | Inactive | Yes | NOT VERIFIED |
| Orion Stars | Inactive | Yes | NOT VERIFIED |
| Panda Master | Inactive | No | NOT VERIFIED |
| VBlink | Inactive | No | NOT VERIFIED |

A failed provider cannot be isolated as “verified except this one” because none passed a load and redeem test. Real-value loads and redemptions stay off for all of them.

## Secrets

No value was printed and nothing was rotated. Rotation still needs a separate yes for each name in `SECRET_ROTATION_CHECKLIST.md`. Rotating a key without a new deployment leaves the old key in the running site.

## Legal

No lawyer letter, license, registration, official rules approval, or free-entry method was found. The terms page says 18 or older. That is not legal approval. The undeployed code blocks Washington, Idaho, Nevada, and Michigan for money actions. Do not treat that list as a legal opinion.

Engineering cannot close this gate. Counsel has to confirm age, the state list, sweepstakes rules, free entry, prize redemption, identity checks, and whether a license is required.

## Real-money switches

| Switch | Production |
| --- | --- |
| `REAL_VALUE_DEPOSITS` | Absent, so off in the new code. Not enforced on the live site. |
| `REAL_VALUE_GAME_LOADS` | Absent |
| `REAL_VALUE_REDEMPTIONS` | Absent |
| `REAL_VALUE_PAYOUTS` | Absent |
| `REAL_VALUE_ADJUSTMENTS` | Absent |
| Database control rows | Not created on production |

## Remaining blockers

1. A, B, C, and D have no yes, so the safety release is not live.
2. The identity JPEG has no byte backup.
3. Paydora deposit and payout lifecycles are not verified.
4. No game provider load or redeem is verified.
5. Legal approval is missing.
6. Secrets are not rotated.
7. Production identity approval is still broken until E.
8. Production stale loads still return 0 until F.
9. Signed-in admin, staff, and store screens were not opened in this pass.

## Exact next owner action

Reply with **A** if new Paydora checkouts on the current website should be stopped. Do not reply with a general “launch” line. H, I, J, K, and L cannot be turned on in this state.
