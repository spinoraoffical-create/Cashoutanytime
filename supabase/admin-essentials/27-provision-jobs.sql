-- Job queue that connects WinSweeps fulfillment to the local Game Vault worker.
--
-- When an admin marks a request "fulfilled" for a game whose automation is
-- enabled, a row is enqueued here. The local Playwright worker (tools/
-- game-vault-worker) polls /api/worker/jobs/next, drives the game portal, and
-- reports back to /api/worker/jobs/result — which updates game_accounts and
-- notifies the player.
--
-- RLS is enabled with NO policies: all access is via the service-role admin
-- client (the worker API routes), never directly from the browser.

create table public.game_provision_jobs (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.requests(id) on delete set null,
  user_id       uuid references auth.users(id)     on delete set null,
  game_id       uuid references public.games(id)   not null,
  kind          text not null check (kind in ('create', 'recharge')),
  game_username text not null,
  game_password text,                 -- only set for 'create' jobs
  amount        numeric not null default 0,
  status        text not null default 'queued'
                  check (status in ('queued', 'processing', 'done', 'failed')),
  attempts      integer not null default 0,
  result        jsonb,
  error         text,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.game_provision_jobs enable row level security;

create index game_provision_jobs_status_idx
  on public.game_provision_jobs (status, created_at);
