-- ============================================================================
-- WinSweeps · 0101 · Tampa geo listing said "WhatsApp support" — only
-- Telegram (support bot + community group) is a real support channel.
-- ============================================================================

update public.geo_cities
set description_snippet = 'Tampa online fish tables with fast Telegram support'
where slug = 'tampa' and description_snippet = 'Tampa online fish tables with fast WhatsApp support';
