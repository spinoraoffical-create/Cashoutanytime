# Database verification report

Date: 13 October 2026.

The configured project host is `muetgtzcbecsqigtpfyn.supabase.co`. No database password is configured in the local environment, so this check used the Supabase API only. No function was called. No row was updated. No file was downloaded. The two SQL files you already ran were not run again.

## 1. What was verified on the live project

| Item | Result |
|---|---|
| KYC bucket `kyc-documents` | Present. `public` is false. Size limit is 5 MB. Allowed types are JPEG, PNG, WebP, and PDF. |
| Anonymous access to that bucket | Refused. The public object address returned status 400. |
| These functions exist in the API | `fail_stale_game_loads`, `fail_my_stale_game_load`, `cancel_my_game_load`, `cancel_game_load_service`, `refund_game_load_wallet`, `reserve_paydora_payout`, `begin_paydora_provider_attempt`, `fail_paydora_payout`, `record_paydora_payout_submitted` |

## 2. What was verified only from source code

The API lists function names. It does not return the SQL inside them.

**NOT VERIFIED** from the live database:

- The text of `fail_stale_game_loads`
- The text of `cancel_my_game_load`
- The text of `refund_game_load_wallet`
- The text of the cash-out reservation functions
- Storage policies on `storage.objects`
- Row security policies on `kyc_submissions`

The repository copies say:

- `refund_game_load_wallet` returns without paying twice when `wallet_refunded` is already true, and it returns without paying when `game_api_debited` is already true.
- `cancel_my_game_load` refunds a pending `load` or `reload`, then marks the row cancelled. The two files you ran do not replace this function.
- `reserve_paydora_payout` locks one player, amount, method, and destination, and reuses an open payout instead of creating a second one.
- `fail_paydora_payout` returns the cash-out wallet only when the row is still `reserved`, and a second call reports a duplicate.
- The payout route does not call that failure function when the provider result is a timeout or an unknown error.

## 3. Are the two migrations active?

The KYC bucket settings match `20261013000140_kyc_private_bucket.sql`. That file's effect is visible.

`fail_stale_game_loads` exists. Whether it is the new version that returns 0 and does not refund is **NOT VERIFIED**. Run the read-only query below and look for `RETURN 0`.

## 4. Is game-load cancellation safe?

No. A player can press Cancel on a pending load. The repository function refunds the wallet and marks the row cancelled even when the game provider may already have accepted the credit. `refund_game_load_wallet` does not block that case unless `game_api_debited` was saved first. A timeout does not save that flag.

The same refund exists on `cancel_game_load_service`. The Cancel button tries the player function first, and if that errors it tries the service function.

A new file is ready and was not run:

`supabase/migrations/20261013000150_hold_pending_game_load_cancel.sql`

It keeps the same function names. For a pending load or reload it stops and changes nothing. Create, balance check, and redeem can still be cancelled. Run it only after you accept that a player can no longer self-cancel a money load. A person then has to match the game result before the wallet moves.

## 5. Is KYC storage secure?

The bucket is private, and an anonymous request could not read it. New uploads in the app go through the signed-in server action, which writes a path that starts with that player's id. Reviewers with `kyc.manage` receive a link that expires in 120 seconds. Old ID rows were not deleted and were not moved. Some of those old rows can still hold the photo as text.

Storage policy rows and the `kyc_submissions` row policies were **NOT VERIFIED** on the live database. The KYC migration you ran does not create storage policies. With no allow policy, normal users cannot read the bucket directly. The service role used by the server can.

## 6. Are cash-out reservations working?

The four reservation functions are present in the API. Their live text is **NOT VERIFIED**. No cash out was sent. From source, a second payout for the same open amount and destination reuses the first row, and an unknown provider result stays pending instead of being paid again.

## 7. Remaining critical issue

Player Cancel can still return wallet money for a pending load after the game may have accepted it. That stays until you run `20261013000150_hold_pending_game_load_cancel.sql` and the read-only check shows the new exception text.

## 8. Is another migration necessary?

Yes. One file, named above. It was not executed.

## 9. Is this ready for staging?

Not for a staging test that loads a game or cashes out. The private ID bucket is in place. Money movement is not confirmed against the live function text, and Cancel is still unsafe in the repository definition.

## Tests

19 script files passed. `scripts/auto-money.test.mjs` failed at line 61.

Line 58 passed: `game-loads.ts` does not mark a row with `status: "failed"`.

Line 61 expects `src/app/dashboard/wallet/page.tsx` not to contain `DepositPageClient`. The page imports that component and renders it. The assertion was not removed or weakened. The wallet page was not changed. The later menu assertions in that file did not run.

## Read-only SQL you can run

These statements only read. They do not change functions, buckets, or balances.

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fail_stale_game_loads',
    'cancel_my_game_load',
    'cancel_game_load_service',
    'refund_game_load_wallet',
    'reserve_paydora_payout',
    'begin_paydora_provider_attempt',
    'fail_paydora_payout'
  )
ORDER BY p.proname;
```

```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'kyc-documents';
```

```sql
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects' AND (
        COALESCE(qual, '') ILIKE '%kyc-documents%'
        OR COALESCE(with_check, '') ILIKE '%kyc-documents%'
      ))
   OR (schemaname = 'public' AND tablename = 'kyc_submissions');
```

What to look for:

- `fail_stale_game_loads` contains `RETURN 0` and does not contain `refund_game_load_wallet`.
- `cancel_my_game_load` still contains `refund_game_load_wallet` until you run the new file.
- `kyc-documents.public` is false.
- `kyc_submissions` select policy is `user_id = auth.uid()`.
