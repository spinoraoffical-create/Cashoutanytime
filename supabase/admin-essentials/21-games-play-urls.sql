-- Migration 0025: add play_url and download_url columns to games
-- These hold the external URLs for online play and app download links.
-- Both are nullable — admin fills them in via CMS; cards show placeholders until set.
alter table public.games
  add column if not exists play_url     text,
  add column if not exists download_url text;
