-- Signup stores the number the player entered on public.profiles.phone.
alter table public.profiles
  add column if not exists phone text;
