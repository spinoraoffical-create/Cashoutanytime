# Final go / no-go

Date: 17 October 2026

SWEEPSTAKES HUB — FINAL RELEASE GATE

Local engineering: PASS

Database integration: NOT VERIFIED

Money shutdown: PASS in the local application. NOT VERIFIED in the live database, because the direct-call guard is not applied.

Webhook safety: PASS in isolated tests. NOT VERIFIED against a live Paydora callback.

KYC: FAIL on production. The safer SQL passed text checks only.

Dependency security: PASS for `npm audit --omit=dev` on this copy. NOT DEPLOYED.

Game providers: FAIL for real-value use. Catalog status was read. Load and redeem were not verified.

Backups and monitoring: NOT VERIFIED

Production deployment: NOT DEPLOYED

Legal approval: NOT VERIFIED

Payment-provider approval: NOT VERIFIED

Safety-only release: READY FOR OWNER APPROVAL

Real-money launch: NO-GO

## Answers

1. What was fixed locally: money switches now also stop staff balance edits and cash wheel prizes. Paid callbacks must have a real paid status, the same amount, and USD. Held callbacks are saved and are not credited on a retry. Location headers are ignored unless the server is the Vercel runtime. The identity SQL no longer uses the wide wallet flag. Production dependencies audit clean. The editor imports match TipTap 3.32.

2. What remains: the live site does not have this code. Identity approval is still broken there. Direct game-load calls are still possible until the database guard is applied. Stale loads are not marked for review. Secrets are not rotated. Backups were not opened. No provider load or redeem was proven. A lawyer and Paydora have not approved the business.

3. What is only local: the application code, the dependency updates, the tests, and the three unapplied SQL files.

4. What needs production SQL: the identity file, the stale-load file, and the database money-guard file. Each one needs its own approval.

5. What needs a Vercel deploy: the shutdown build, the age and location checks, the webhook changes, the TipTap and dependency patches, and Next.js 15.5.28.

6. What needs credential rotation: the database password, any exposed Supabase key, the Paydora key and webhook secret, and the game-agent passwords named in `SECRET_ROTATION_CHECKLIST.md`.

7. What needs a lawyer or payment company: the age, the state list, the official rules, any license, and written Paydora approval. A missing currency field will hold a deposit instead of crediting it until Paydora's payload is confirmed.

8. Safest next action: approve the shutdown deploy with every `REAL_VALUE_*` value left unset, and approve the database money-guard SQL in the same decision if you want the shutdown to survive a rollback. Do not turn real money on. Do not test Approve on the real pending identity.

The public website can stay open for browsing. It is not ready to take player money.
