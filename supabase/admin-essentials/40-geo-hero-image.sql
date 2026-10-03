-- ============================================================================
-- WinSweeps · 0103 · Geo state hero background photo
-- ============================================================================
-- Adds hero_image_url to geo_states (mirrors StateData.heroImageUrl in
-- src/lib/geo-data.ts) and backfills the 7 existing states with a Pexels
-- photo, matched by keyword via scripts/backfill-content-images.mjs.

alter table public.geo_states
  add column hero_image_url text;

update public.geo_states set hero_image_url = v.hero_image_url
from (values
  ('texas', 'https://images.pexels.com/photos/20185085/pexels-photo-20185085.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('florida', 'https://images.pexels.com/photos/30147234/pexels-photo-30147234.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('georgia', 'https://images.pexels.com/photos/33133726/pexels-photo-33133726.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('california', 'https://images.pexels.com/photos/29536601/pexels-photo-29536601.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('north-carolina', 'https://images.pexels.com/photos/18931263/pexels-photo-18931263.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('ohio', 'https://images.pexels.com/photos/18353982/pexels-photo-18353982.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('michigan', 'https://images.pexels.com/photos/12950494/pexels-photo-12950494.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')
) as v(slug, hero_image_url)
where geo_states.slug = v.slug;
