-- ============================================================================
-- WinSweeps · 0109 · Blog post — WinSweeps as a next-gen gaming platform
-- ============================================================================

insert into public.blog_posts (
  slug, title, excerpt, content, cover_image_url, tags, status, is_published, published_at, seo_title, seo_description
) values (
  'winsweeps-next-generation-gaming-platform',
  'WinSweeps: The Next Platform for Online Sweepstakes Gaming',
  'What makes WinSweeps different from the last generation of sweepstakes sites, and exactly how deposits, play and cash-outs work end to end.',
  $t$## A Next-Generation Take on Sweepstakes Gaming

Most sweepstakes gaming sites are just a portal: pick a game, load credits, hope support answers. WinSweeps was built as a full platform instead — a dashboard that tracks your XP and VIP tier, daily and streak rewards, a referral program, and a live leaderboard, wrapped around the same fish-table and slot games players already know.

That's the difference between "a site with games on it" and a platform: your progress, rewards and history all live in one account instead of resetting every time you pick a different game.

## What You Get Inside WinSweeps

- **A real player dashboard** — wallet balance, XP/level, VIP tier progress and claim history in one place
- **Daily and streak rewards** — coming back every day compounds, it isn't just a one-time bonus
- **VIP tiers** — reward multipliers scale up the more you play, up to 2x at the top tier
- **Referral program** — invite friends and earn a 40% referral reward, uncapped
- **A live leaderboard** — weekly rankings with a real prize pool, not just bragging rights
- **A trusted game lineup** — Orion Stars, Game Vault, Juwa, Fire Kirin, Mr All In One, Cash Machine, Cash Frenzy, Panda Master, Vblink, Milky Way, Vegas Sweeps, Ultrapanda, Gameroom and Mafia, all under one account

## How Deposits & Play Actually Work

WinSweeps runs on a wallet model, not a per-game top-up:

1. **Fund your wallet.** Submit a deposit via CashApp, Zelle, or crypto and send your payment confirmation.
2. **Get credited.** Once confirmed, your WinSweeps wallet balance updates — most deposits are approved fast, and every eligible deposit earns a 20% deposit bonus on top.
3. **Load a game.** Move wallet balance into whichever game you want to play (Juwa, Game Vault, Fire Kirin — whatever you're in the mood for). Your login is issued straight to your account.
4. **Play.** Your progress, XP and VIP tier track across every game you load into, not just one.
5. **Redeem your winnings.** Cash out from your game back to your WinSweeps wallet, then request a payout the same way you deposited.

New players get $2 or $3 Free Play to start (eligible players only), and returning players can catch Happy Hour for an extra 20% on deposits during the promo window.

## Getting Started

Message the WinSweeps team to claim your Free Play, make your first deposit, and pick a game — the whole account-to-playing flow usually takes minutes, not days.$t$,
  'https://images.pexels.com/photos/3951449/pexels-photo-3951449.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  array['winsweeps', 'gaming platform', 'how to deposit', 'sweepstakes', 'getting started'],
  'published',
  true,
  now(),
  'WinSweeps: The Next Platform for Online Sweepstakes Gaming',
  'How WinSweeps works as a full gaming platform, and the exact steps to deposit, play, and cash out.'
)
on conflict (slug) do update set
  title           = excluded.title,
  excerpt         = excluded.excerpt,
  content         = excluded.content,
  cover_image_url = excluded.cover_image_url,
  tags            = excluded.tags,
  status          = excluded.status,
  is_published    = excluded.is_published,
  published_at    = excluded.published_at,
  seo_title       = excluded.seo_title,
  seo_description = excluded.seo_description;
