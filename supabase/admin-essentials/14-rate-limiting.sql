-- ============================================================================
-- WinSweeps · 0014 · DB-backed fixed-window rate limiting
-- Serverless-safe (no Redis): atomic upsert per (bucket, window).
-- ============================================================================

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

create index idx_rate_limits_window on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- no policies: only service_role (which bypasses RLS) touches this table

-- Returns true when the action is ALLOWED, false when the limit is exceeded.
-- bucket is typically "<action>:<user_or_ip>".
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_hits integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start timestamptz;
  current_hits integer;
begin
  -- align to the start of the current fixed window
  w_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, w_start, 1)
  on conflict (bucket, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into current_hits;

  return current_hits <= p_max_hits;
end;
$$;

-- Housekeeping: drop windows older than a day. Called by the cron route.
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Only service_role may invoke (server-side enforcement).
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
revoke execute on function public.prune_rate_limits() from public;
