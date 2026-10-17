-- Public game catalog restore.
-- Inserts only game categories and game rows that already exist in this repository.
-- Does not update an existing row, so a game an admin already turned off stays off.
-- Does not touch wallets, profiles, auth users, payments, game accounts, or provider secrets.
-- Does not enable game_server_configs. A catalog row is not a live provider connection.
-- Run this only on the disposable local database, or on the NEW project after the owner approves it.

begin;

insert into public.game_categories (key, name, icon, sort_order)
select v.key, v.name, v.icon, v.sort_order
from (
  values
    ('slots', 'Slots', 'sparkles', 1),
    ('fishing', 'Fish Games', 'fish', 2),
    ('table-games', 'Table Games', 'spade', 3),
    ('arcade', 'Arcade', 'gamepad', 4),
    ('seasonal', 'Seasonal', 'gift', 5)
) as v(key, name, icon, sort_order)
where not exists (
  select 1 from public.game_categories c where c.key = v.key
);

-- The 12 rooms the repository marked active in 20260614000020_games_requests.sql.
insert into public.games (
  name, slug, category_id, description, image_url, download_url,
  badge_text, is_featured, is_active, popularity
)
select
  v.name,
  v.slug,
  c.id,
  v.description,
  v.image_url,
  v.download_url,
  v.badge_text,
  v.is_featured,
  true,
  v.popularity
from (
  values
    ('Fire Kirin', 'fire-kirin', 'fishing', 'Fish shooting game. Create an account, then load credits from your wallet.', '/games/fire-kirin.webp', 'http://start.firekirin.xyz:8580/', 'HOT', true, 100),
    ('Juwa', 'juwa', 'slots', 'Slots and fish tables. Account creation and loads are handled from your dashboard.', '/games/juwa.webp', 'https://dl.juwa777.com/', 'HOT', true, 96),
    ('Orion Stars', 'orion-stars', 'fishing', 'Fish and slots. Play through your linked Orion Stars account.', '/games/orion-stars.webp', 'http://start.orionstars.vip:8580/', 'NEW', true, 94),
    ('Game Vault', 'game-vault', 'slots', 'Slots and fish tables with account creation from your dashboard.', '/games/game-vault.webp', 'https://download.gamevault999.com/', 'HOT', true, 92),
    ('Vegas Sweeps', 'vegas-sweeps', 'slots', 'Vegas-style slots and fish games.', '/games/vegas-sweeps.webp', 'https://vegassweepsonline.com/', null, true, 90),
    ('Milky Way', 'milky-way', 'fishing', 'Space-themed fish and slots.', '/games/milky-way.webp', 'https://milkywayapp.xyz/', null, false, 88),
    ('Panda Master', 'panda-master', 'fishing', 'Fish shooting game with account creation from your dashboard.', '/games/panda-master.webp', 'https://pandamaster.vip:8888/index.html', null, true, 86),
    ('Cash Frenzy', 'cash-frenzy', 'slots', 'Slots platform. Loads are taken from your wallet after you have an account.', '/games/cash-frenzy.webp', 'https://www.cashfrenzy777.com/', null, false, 84),
    ('VBlink', 'vblink', 'arcade', 'Arcade fish and slots.', '/games/vblink.webp', 'https://www.vblink777.club/', null, false, 82),
    ('Mafia', 'mafia', 'fishing', 'Arcade fish tables. Account creation and loads run from your dashboard.', '/logo.webp', 'https://agentserver.mafia77777.com', null, false, 80),
    ('Mr. All In One', 'mr-all-in-one', 'slots', 'Slots, fish, and keno in one app.', '/games/mr-all-in-one.webp', 'https://www.mrallinone777.com/', null, false, 78),
    ('Cash Machine', 'cash-machine', 'slots', 'Slots platform with account creation from your dashboard.', '/games/cash-machine.webp', 'https://www.cashmachine777.com/', null, false, 76)
) as v(name, slug, category_key, description, image_url, download_url, badge_text, is_featured, popularity)
join public.game_categories c on c.key = v.category_key
where not exists (
  select 1 from public.games g where g.slug = v.slug
);

-- Extra titles from 20261008000210_create_requires_game_row.sql.
-- They stay inactive until an admin turns Active on. That migration required a game row
-- before a player could request an account, and it explicitly left these off.
insert into public.games (
  name, slug, category_id, description, image_url, download_url,
  badge_text, is_featured, is_active, popularity
)
select
  v.name,
  v.slug,
  c.id,
  v.description,
  v.image_url,
  v.download_url,
  null,
  false,
  false,
  v.popularity
from (
  values
    ('Ultra Panda', 'ultrapanda', 'fishing', 'Fish and slots.', '/games/ultrapanda.webp', 'https://www.ultrapanda.mobi/', 74),
    ('River Sweeps', 'river-sweeps', 'slots', 'Sweepstakes slots.', '/games/river-sweeps.webp', 'https://www.riversweeps.com/', 72),
    ('Lucky Slots', 'lucky-slots', 'slots', 'Classic slots.', '/games/lucky-slots.webp', 'https://luckyslots.com/', 70),
    ('High Stakes', 'high-stakes', 'table-games', 'Table games.', '/games/high-stakes.webp', 'https://highstakes.com/', 68),
    ('Golden Dragon', 'golden-dragon', 'fishing', 'Fish tables.', '/games/golden-dragon.webp', 'https://goldendragon.com/', 66),
    ('Blue Dragon', 'blue-dragon', 'fishing', 'Fish tables.', '/games/blue-dragon.webp', 'https://bluedragon.com/', 64),
    ('Dragon Master', 'dragon-master', 'fishing', 'Fish tables.', '/games/dragon-master.webp', 'https://dragonmaster.com/', 62),
    ('Game Room', 'gameroom', 'slots', 'Slots, fish, and keno.', '/games/gameroom.webp', 'https://www.gameroom777.com/m', 60),
    ('Ace Book', 'ace-book', 'table-games', 'Card games.', '/games/ace-book.webp', 'https://acebook.com/', 58),
    ('Galaxy Games', 'galaxy-games', 'slots', 'Slots.', '/games/galaxy-games.webp', 'https://galaxygames.com/', 56),
    ('Moolah', 'moolah', 'slots', 'Slots.', '/games/moolah.webp', 'https://moolahslots.com/', 54),
    ('VB Game', 'vb-game', 'slots', 'Slots and fish tables.', '/games/vb-game.webp', 'https://vbgame.com/', 52),
    ('Mega Spin', 'mega-spin', 'slots', 'Slots.', '/games/mega-spin.webp', 'https://megaspin.com/', 50),
    ('Lucky Lion', 'lucky-lion', 'slots', 'Slots.', '/games/lucky-lion.webp', 'https://luckylion.com/', 48),
    ('Pharaoh''s Treasure', 'pharaohs-treasure', 'slots', 'Egyptian slots.', '/games/pharaohs-treasure.webp', 'https://pharaohstreasure.com/', 46),
    ('Ocean King', 'ocean-king', 'fishing', 'Fish shooting.', '/games/ocean-king.webp', 'https://oceanking.com/', 44),
    ('Fish Hunter', 'fish-hunter', 'fishing', 'Fish shooting.', '/games/fish-hunter.webp', 'https://fishhunter.com/', 42),
    ('Monster Hunter', 'monster-hunter', 'fishing', 'Fish shooting.', '/games/monster-hunter.webp', 'https://monsterhunter.com/', 40),
    ('Buffalo Link', 'buffalo-link', 'slots', 'Slots.', '/games/buffalo-link.webp', 'https://buffalolink.com/', 38)
) as v(name, slug, category_key, description, image_url, download_url, popularity)
join public.game_categories c on c.key = v.category_key
where not exists (
  select 1 from public.games g where g.slug = v.slug
);

do $$
declare
  active_count int;
  inactive_count int;
begin
  select count(*) into active_count
  from public.games
  where is_active
    and slug in (
      'fire-kirin', 'juwa', 'orion-stars', 'game-vault', 'vegas-sweeps', 'milky-way',
      'panda-master', 'cash-frenzy', 'vblink', 'mafia', 'mr-all-in-one', 'cash-machine'
    );

  select count(*) into inactive_count
  from public.games
  where is_active = false
    and slug in (
      'ultrapanda', 'river-sweeps', 'lucky-slots', 'high-stakes', 'golden-dragon',
      'blue-dragon', 'dragon-master', 'gameroom', 'ace-book', 'galaxy-games', 'moolah',
      'vb-game', 'mega-spin', 'lucky-lion', 'pharaohs-treasure', 'ocean-king',
      'fish-hunter', 'monster-hunter', 'buffalo-link'
    );

  if active_count <> 12 then
    raise exception 'Catalog restore expected 12 active rooms, found %', active_count;
  end if;
  if inactive_count <> 19 then
    raise exception 'Catalog restore expected 19 inactive rooms, found %', inactive_count;
  end if;
end $$;

commit;
