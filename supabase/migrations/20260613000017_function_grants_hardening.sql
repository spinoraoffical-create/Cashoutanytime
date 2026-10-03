-- ============================================================================
-- WinSweeps · 0015 · Function EXECUTE hardening
-- Postgres grants EXECUTE to PUBLIC by default; revoking from anon/authenticated
-- alone is insufficient because both inherit PUBLIC. Revoke from PUBLIC on every
-- privileged function, then re-grant only the client-callable surface.
-- ============================================================================

-- ── Internal-only: must never be callable by clients (currency minting etc.) ─
revoke execute on function public.grant_coins(uuid, bigint, public.ledger_entry_type, text, uuid, text) from public;
revoke execute on function public.grant_xp(uuid, bigint, public.ledger_entry_type, text, uuid, text) from public;
revoke execute on function public.evaluate_achievements(uuid) from public;
revoke execute on function public.evaluate_vip_tier(uuid) from public;
revoke execute on function public.qualify_referral(uuid) from public;
revoke execute on function public.compute_leaderboard(public.leaderboard_period, text, boolean) from public;
revoke execute on function public.generate_referral_code() from public;
revoke execute on function public.tier_for_xp(bigint) from public;
revoke execute on function public.achievement_metric(uuid, public.achievement_condition) from public;
revoke execute on function public.send_broadcast(text, text, text, public.broadcast_segment) from public;
revoke execute on function public.member_multiplier(uuid) from public;

-- send_broadcast is internally permission-checked but should still be limited to
-- signed-in callers (staff check happens inside).
grant execute on function public.send_broadcast(text, text, text, public.broadcast_segment) to authenticated;

-- ── Client-callable surface: revoke PUBLIC, grant explicitly ────────────────
revoke execute on function public.claim_reward(text) from public;
grant execute on function public.claim_reward(text) to authenticated;

revoke execute on function public.claim_promotion(text, text) from public;
grant execute on function public.claim_promotion(text, text) to authenticated;

-- Authorization helpers are consumed by RLS for signed-in users.
revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_any_role(public.app_role[]) from public;
revoke execute on function public.has_permission(text) from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Pure helpers are safe for everyone (used in UI math, public pages).
-- calculate_level / xp_for_level / period_key_for keep their PUBLIC grant.
