-- ============================================================================
-- WinSweeps · 0023 · Add user_id to requests — link anonymous deposits to auth users
-- ============================================================================

-- Add nullable user_id column so existing anonymous rows are preserved
alter table public.requests
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Index for fast per-user lookups
create index if not exists requests_user_id_idx on public.requests(user_id);

-- RLS: logged-in users can see their own requests
create policy "users read own requests"
  on public.requests for select
  using (user_id = auth.uid());
