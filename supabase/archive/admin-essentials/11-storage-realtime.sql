-- ============================================================================
-- WinSweeps · 0012 · Storage buckets, realtime, auth trigger attachment
-- ============================================================================

-- ── Storage buckets ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
   array['image/png','image/jpeg','image/webp','image/avif']),
  ('cms-media', 'cms-media', true, 8388608,
   array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml']),
  ('ticket-attachments', 'ticket-attachments', false, 5242880,
   array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- avatars: anyone can view; owners write inside their own folder (uid/...)
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- cms-media: public read, cms staff write
create policy "cms media public read" on storage.objects
  for select using (bucket_id = 'cms-media');

create policy "cms media staff write" on storage.objects
  for insert with check (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

create policy "cms media staff update" on storage.objects
  for update using (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

create policy "cms media staff delete" on storage.objects
  for delete using (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

-- ticket-attachments: uploader-foldered; readable by owner + support staff
create policy "attachments participant read" on storage.objects
  for select using (
    bucket_id = 'ticket-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('support.manage')
    )
  );

create policy "attachments owner write" on storage.objects
  for insert with check (
    bucket_id = 'ticket-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.notifications;

-- ── Attach the signup pipeline now that all referenced tables exist ──────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Grants: views & RPC surface for API roles ────────────────────────────────

grant select on public.public_profiles to anon, authenticated;

grant execute on function public.claim_reward(text) to authenticated;
grant execute on function public.claim_promotion(text, text) to authenticated;
grant execute on function public.send_broadcast(text, text, text, public.broadcast_segment) to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.calculate_level(bigint) to anon, authenticated;
grant execute on function public.xp_for_level(integer) to anon, authenticated;
grant execute on function public.period_key_for(public.leaderboard_period, timestamptz) to anon, authenticated;

-- lock down internal functions from direct API invocation
revoke execute on function public.grant_coins(uuid, bigint, public.ledger_entry_type, text, uuid, text) from anon, authenticated;
revoke execute on function public.grant_xp(uuid, bigint, public.ledger_entry_type, text, uuid, text) from anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from anon, authenticated;
revoke execute on function public.evaluate_vip_tier(uuid) from anon, authenticated;
revoke execute on function public.qualify_referral(uuid) from anon, authenticated;
revoke execute on function public.compute_leaderboard(public.leaderboard_period, text, boolean) from anon, authenticated;
revoke execute on function public.generate_referral_code() from anon, authenticated;
