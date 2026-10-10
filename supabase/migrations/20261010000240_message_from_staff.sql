-- Lets an admin test support with the same login: player lines stay from_staff false,
-- and replies typed in Admin chat are from_staff true. Does not change balances.

alter table public.messages
  add column if not exists from_staff boolean not null default false;

comment on column public.messages.from_staff is
  'True when a staff member sent the line from Admin chat.';
