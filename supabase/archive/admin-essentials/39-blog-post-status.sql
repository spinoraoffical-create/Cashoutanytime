-- ============================================================================
-- WinSweeps · 0102 · Blog post status (draft/scheduled/published/archived)
-- ============================================================================

create type public.blog_post_status as enum ('draft', 'scheduled', 'published', 'archived');

alter table public.blog_posts
  add column status public.blog_post_status not null default 'draft';

update public.blog_posts set status = 'published' where is_published;

-- keep is_published (read directly by RLS policies, marketing.ts and the
-- Telegram admin bot) in sync so none of those call sites need to change.
create or replace function public.sync_blog_post_is_published()
returns trigger
language plpgsql
as $$
begin
  new.is_published := (new.status = 'published');
  return new;
end;
$$;

create trigger trg_blog_posts_sync_is_published
  before insert or update on public.blog_posts
  for each row execute function public.sync_blog_post_is_published();

create index idx_blog_posts_scheduled
  on public.blog_posts (published_at)
  where status = 'scheduled';
