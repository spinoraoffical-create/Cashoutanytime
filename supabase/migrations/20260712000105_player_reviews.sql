-- Player-authored reviews shown on the homepage, tied to profiles.
-- One review per player (unique user_id); public reads published rows,
-- players can edit their own review, staff moderate via /admin/reviews.

create table public.player_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.player_reviews enable row level security;

create policy "player reviews public read" on public.player_reviews
  for select using (is_published or user_id = auth.uid() or public.has_permission('cms.manage'));
create policy "player reviews self insert" on public.player_reviews
  for insert with check (user_id = auth.uid());
create policy "player reviews self update" on public.player_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "player reviews staff update" on public.player_reviews
  for update using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy "player reviews staff delete" on public.player_reviews
  for delete using (public.has_permission('cms.manage'));

-- Players can edit their own rating/body, but can't self-unhide a review
-- staff hid for spam — same defense-in-depth idea as protect_profile_columns.
create or replace function public.protect_review_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or public.has_permission('cms.manage') then
    return new;
  end if;
  new.is_published := old.is_published;
  return new;
end;
$$;

create trigger trg_player_reviews_protect
  before update on public.player_reviews
  for each row execute function public.protect_review_publish();
