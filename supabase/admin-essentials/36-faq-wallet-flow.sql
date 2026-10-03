-- ============================================================================
-- WinSweeps · 0098 · Refresh FAQ copy seeded in 0020 to match the current
-- self-serve wallet flow (it still described the old manual request-form
-- process: upfront deposit amount, 30-minute/business-hours turnaround).
-- ============================================================================

update public.faqs
set answer = 'Create a free WinSweeps account — no deposit required. Then open any game and create your in-game account in one click; your username and password are generated instantly, with no download and no waiting. Add funds to your wallet whenever you are ready, load credits into the game, and start playing.'
where question = 'How do I create a game account and start playing?';

update public.faqs
set answer = 'Deposits are usually confirmed and credited to your wallet in under 2 minutes. Once your wallet balance updates, loading credits into any game is instant.'
where question = 'How long does it take to receive my game credits after depositing?';

update public.faqs
set answer = 'No — WinSweeps creates the in-game account for you instantly when you pick a game from your dashboard. One WinSweeps wallet works across all 12 games, so you never juggle separate logins or balances.'
where question = 'Do I need an existing game account on Fire Kirin, Juwa or other platforms?';

update public.faqs
set answer = 'We accept CashApp, Zelle, Bitcoin, USDT and other crypto options. Choose a method on the deposit page, send your payment, and upload the confirmation — your wallet is credited once it clears, usually within 2 minutes.'
where question = 'Which payment methods do you accept for deposits?';
