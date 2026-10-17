select
  (select count(*) from public.game_categories where key in ('slots', 'fishing', 'table-games', 'arcade', 'seasonal')) as categories,
  (select count(*) from public.games where is_active and slug in (
    'fire-kirin', 'juwa', 'orion-stars', 'game-vault', 'vegas-sweeps', 'milky-way',
    'panda-master', 'cash-frenzy', 'vblink', 'mafia', 'mr-all-in-one', 'cash-machine'
  )) as active_games,
  (select count(*) from public.games where is_active = false and slug in (
    'ultrapanda', 'river-sweeps', 'lucky-slots', 'high-stakes', 'golden-dragon',
    'blue-dragon', 'dragon-master', 'gameroom', 'ace-book', 'galaxy-games', 'moolah',
    'vb-game', 'mega-spin', 'lucky-lion', 'pharaohs-treasure', 'ocean-king',
    'fish-hunter', 'monster-hunter', 'buffalo-link'
  )) as inactive_games,
  (select count(*) from public.games) as games_total,
  (select count(*) from (
    select slug from public.games group by slug having count(*) > 1
  ) d) as duplicate_slugs,
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.wallet_transactions) as wallet_tx,
  (select count(*) from public.game_server_configs) as provider_configs;

select slug, is_active
from public.games
order by is_active desc, popularity desc;
