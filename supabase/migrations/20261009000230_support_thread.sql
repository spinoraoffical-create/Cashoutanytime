-- Private support thread: human queue reference and a 1–5 rating.
-- Rating and resolved flags never change wallet_balance or cashout_wallet.

alter table public.conversations
  add column if not exists support_reference text,
  add column if not exists human_requested_at timestamptz,
  add column if not exists support_rating smallint,
  add column if not exists support_resolved boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_support_rating_range'
  ) then
    alter table public.conversations
      add constraint conversations_support_rating_range
      check (support_rating is null or (support_rating >= 1 and support_rating <= 5));
  end if;
end $$;
