-- Admin-managed deposit payment methods (Spinora-style switcher): each method
-- has a label, an account handle/address (+ its label), an optional pay link,
-- and an optional QR image. The public deposit page renders active methods and
-- swaps the QR/handle/link when a method is selected. Deposits are still
-- submitted + approved in /admin and credited to the wallet (unchanged).

create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,                       -- 'cashapp','usdt',…
  label        text not null,                              -- 'Cash App'
  kind         text not null default 'handle'
                 check (kind in ('handle', 'crypto', 'link')),
  handle       text,                                       -- $tag / address / email
  handle_label text,                                       -- 'Cashtag', 'USDT address (ERC-20)'
  pay_link     text,                                       -- https://cash.app/$tag
  qr_image_url text,                                       -- public URL (cms-media bucket)
  instructions text,                                       -- optional note under the method
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);

alter table public.payment_methods enable row level security;

-- Players (anon + authenticated) can read ACTIVE methods to make a deposit.
create policy "payment methods public read"
  on public.payment_methods for select
  using (is_active = true);
-- Writes are service-role only (admin actions use the service-role client).

create index payment_methods_order_idx on public.payment_methods (sort_order, label);

-- Seed sensible defaults (admin edits handles / links / QR images afterwards).
insert into public.payment_methods (key, label, kind, handle_label, handle, pay_link, sort_order) values
  ('cashapp', 'Cash App', 'handle', 'Cashtag',               '$YourCashtag',  'https://cash.app/$YourCashtag', 1),
  ('chime',   'Chime',    'handle', 'Chime $ChimeSign',       '$YourChimeSign', null,                          2),
  ('paypal',  'PayPal',   'handle', 'PayPal',                 'you@email.com', 'https://paypal.me/you',        3),
  ('venmo',   'Venmo',    'handle', 'Venmo',                  '@YourVenmo',    'https://venmo.com/u/YourVenmo', 4),
  ('bitcoin', 'Bitcoin',  'crypto', 'Bitcoin address',        'bc1youraddress', null,                         5),
  ('usdt',    'USDT',     'crypto', 'USDT address (ERC-20)',  '0xYourAddress', null,                          6)
on conflict (key) do nothing;
