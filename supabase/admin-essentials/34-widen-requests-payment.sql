-- The requests.payment_method CHECK constraint (migration 0020) still only
-- allows the original ('cashapp','zelle','crypto','other') values, but the
-- admin-managed payment_methods table (migration 0092) added chime, paypal,
-- venmo, bitcoin and usdt as selectable deposit methods on /deposit. Picking
-- any of those violated the stale constraint, causing every non-cashapp
-- deposit submission to fail with a generic error (and silently delete the
-- just-uploaded payment proof). Widen the constraint to match.

alter table public.requests drop constraint requests_payment_method_check;
alter table public.requests add constraint requests_payment_method_check
  check (payment_method in ('cashapp','zelle','crypto','other','chime','paypal','venmo','bitcoin','usdt'));
