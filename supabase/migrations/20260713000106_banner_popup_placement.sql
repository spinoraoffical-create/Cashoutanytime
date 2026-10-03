-- Add a "home_popup" placement so the banners table can drive a dismissible
-- image popup on the homepage, reusing the existing banner schema
-- (image_url, link_url, is_active, priority, starts_at/ends_at).
alter type public.banner_placement add value 'home_popup';
