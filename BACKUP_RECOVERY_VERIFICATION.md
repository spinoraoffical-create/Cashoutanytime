# Backup recovery verification

Date: 18 October 2026

Database recovery of accounts and application data: VERIFIED IN ISOLATED TEST

Private identity-file bytes: NOT VERIFIED

No production database was changed. The disposable database was deleted after the checks. The old Spinora project was not contacted.

## Where the backup is

Encrypted files, outside git:

`C:\Users\asus\AppData\Local\SweepstakesHubBackups\2026-10-18\`

- `schema.sql.aes`
- `data.sql.aes`
- `app-data.sql.aes`
- `auth-schema.sql.aes`

The decryption key is in a different folder:

`C:\Users\asus\AppData\Local\SweepstakesHubBackups\keys\backup.key`

The key was not printed and was not deleted. Decryption was tested: the schema file and the data file opened and began with the expected PostgreSQL dump header. Plaintext copies were deleted after the restore.

## Auth recovery

The first attempt failed because a stock database image had older login tables than production. This pass dumped the production `auth` schema and restored it into a disposable Postgres 17.11 database, then loaded the auth rows with triggers off so no email was sent.

| Check | Result |
| --- | --- |
| Login users | 5, matching the dump |
| Identities | 8 |
| Sessions present | 4. Session token values were not printed. |
| Password hashes present | 5. The hashes were not printed. |
| Profiles | 5 |
| Profiles missing a login | 0 |
| Logins missing a profile | 0 |
| Auth foreign keys | 24 |
| `auth.uid`, `auth.role`, `auth.email` | Present |
| `auth.role()` reads both the legacy role claim and the JSON claims role | VERIFIED IN ISOLATED TEST |

Auth records are recoverable. That closes the earlier login-restore gap.

## Application data

Public schema restored with exit 0 on the same disposable database. Public rows loaded after the logins. Combined wallet and cash-out totals for the five real profiles stayed 0.00. One payment intent, 13 game-load requests, and 1 identity submission matched the earlier count.

## Private storage

| Bucket | Public |
| --- | --- |
| avatars | Yes |
| cms-media | Yes |
| chat-attachments | No |
| kyc-documents | No |
| payment-proofs | No |
| ticket-attachments | No |

One object exists. It is in the private `kyc-documents` bucket, it is a JPEG, and its stored size is 183,920 bytes. The file name was not printed and no signed link was created.

The installed Supabase CLI refused to download that remote object (`Unsupported operation`). The bytes were not saved. Restore of that identity image is NOT VERIFIED. Do not delete or replace that bucket until a byte copy exists.

## What this backup can and cannot recover

Recoverable in an isolated database: login users, identities, profiles, wallet rows, game-load requests, the identity submission row, payment intent rows, functions, triggers, and policies that were in the public and auth dumps.

Not recoverable from this backup: the JPEG bytes in `kyc-documents`. Point-in-time recovery in the Supabase dashboard was not opened and stays NOT VERIFIED.

## Effect on production changes

Account and financial-row recovery is verified, so the database money guard and the identity SQL no longer fail the backup gate. They still need a separate yes before anyone runs them on production.

The missing image bytes block any action that would delete storage objects. They do not block a schema change that leaves storage alone.
