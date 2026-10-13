# Payout safety report

Date: 13 October 2026. No production SQL was run. No payout was sent. Nothing was deployed or pushed.

The API host is `muetgtzcbecsqigtpfyn.supabase.co`. These function names are present: `reserve_paydora_payout`, `debit_paydora_payout`, `credit_cashout_payout_void`, `fail_paydora_payout`, `record_paydora_payout_submitted`, and `begin_paydora_provider_attempt`. The SQL text inside them was not readable from here. There is no database URL in the local environment, and those functions were not called, because calling them can move a balance.

## 1. Confirmed vulnerabilities

None in the current source that would pay the same withdrawal twice or refund it twice.

What the source does:

- One open cash-out is allowed for the same player, amount, method, and destination. The idempotency key is created once (`wd_` plus a random id) and reused. A second click does not create a second key and does not debit again.
- After that cash-out is `paid` or `failed`, a later cash-out of the same amount is a new withdrawal. That is a second cash-out, not a replay of the finished one.
- A provider timeout, HTTP 408, 429, or 5xx stays ambiguous. The route does not call `fail_paydora_payout` and does not return the wallet. The row stays `reserved`.
- A clear provider rejection voids the cash-out wallet once. A second void hits the primary key `payout-void:<key>` on `paydora_processed_events` and does not credit again. `fail_paydora_payout` also returns immediately when the row is already `failed`, or when it is `submitted` or `paid`.
- The wallet debit is inserted under the payout key before the balance changes. A second debit of that key hits the `payment_id` primary key and does not subtract again.
- `reserve_paydora_payout` locks the player, amount, method, and destination, then debits and marks `reserved` in one function. A raised error rolls that work back.
- Twelve overlapping reserves in the test produced one debit and one key.
- An insufficient balance raises `insufficient funds` and does not create a reserved row in the test ledger.
- Execute rights on these functions are revoked from `PUBLIC`, `anon`, and `authenticated`, and granted to `service_role`. The table has row security on and no player policies.
- The withdrawal call sends the stored key in the `Idempotency-Key` header. The player cannot supply a new key.

## 2. Potential risks

- The live function text is **NOT VERIFIED**. An older copy of `debit_paydora_payout` in `supabase/migrations/20261004000100_paydora_security_hardening.sql` subtracts `wallet_balance`. The later copy in `supabase/migrations/20261008000190_auto_money.sql` subtracts `cashout_wallet`. Only the later copy is safe for cash-outs. Confirm the live body with the read-only query below.
- If the player tries the same cash-out again more than two minutes after a timeout, the route may call Paydora again. It sends the same idempotency key. It does not start a background retry. Safety then depends on Paydora treating that header as the same withdrawal. This was not tested against Paydora.
- A finished cash-out does not block a new one for the same amount. That is intentional, so a real second cash-out still works.
- No real withdrawal was sent, so provider timeout behavior on the live Paydora account is **NOT VERIFIED**.

## 3. Files changed

- `scripts/payout-reservation.test.mjs` — added an insufficient-balance case and a new cash-out after a confirmed provider failure.
- `PAYOUT_SAFETY_REPORT.md` — this report.

No migration was added. The wallet formulas were not changed.

## 4. Tests passed

`node scripts/payout-reservation.test.mjs` passed. It covers a repeated request, a completed cash-out followed by a new one, twelve concurrent requests, a timeout, a provider decline, a second refund, an insufficient balance, and a new cash-out after failure.

The payout assertions at the top of `scripts/auto-money.test.mjs` also ran before that file failed later.

## 5. Tests failed

`node scripts/auto-money.test.mjs` failed at line 61. The wallet page still renders `DepositPageClient`. That assertion was not removed. It is not a payout-route failure. The payout checks earlier in that file had already passed.

## 6. Required migrations

None for this payout review.

## 7. Remaining launch blockers

1. Read the live `debit_paydora_payout` body and confirm it updates `cashout_wallet`, not `wallet_balance`.
2. Do one small cash-out on a test player and confirm a second click does not pay twice. Do not use a timeout as a reason to pay again.
3. The unrelated `auto-money` wallet-page failure is still open.

Read-only check:

```sql
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'debit_paydora_payout',
    'credit_cashout_payout_void',
    'reserve_paydora_payout',
    'fail_paydora_payout',
    'record_paydora_payout_submitted'
  )
ORDER BY p.proname;
```

`debit_paydora_payout` should contain `cashout_wallet` and should not contain `wallet_balance`.
