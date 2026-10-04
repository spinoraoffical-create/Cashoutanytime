-- Daily task: manual reward claim + 24h level gating
-- Run in Supabase SQL Editor AFTER daily-tasks.sql
--
-- Changes:
--   * reward is no longer auto-granted on level completion — the user must
--     press "Claim Reward", which credits their BONUS wallet
--   * the next level unlocks only 24 hours after the previous reward is claimed
--   * level completion no longer auto-unlocks the next level

-- 1) Track when a level's reward was claimed -----------------------------------
ALTER TABLE public.user_task_levels
  ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ;

-- 2) Stop auto-unlocking the next level on completion --------------------------
CREATE OR REPLACE FUNCTION public.upsert_user_task_level(
  p_user_id UUID,
  p_level INTEGER,
  p_points INTEGER,
  p_status TEXT,
  p_reward_granted BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_task_levels (user_id, level, status, points_earned, reward_granted, completed_at)
  VALUES (
    p_user_id,
    p_level,
    p_status,
    p_points,
    p_reward_granted,
    CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id, level) DO UPDATE SET
    status = EXCLUDED.status,
    points_earned = EXCLUDED.points_earned,
    reward_granted = COALESCE(EXCLUDED.reward_granted, user_task_levels.reward_granted),
    completed_at = CASE
      WHEN EXCLUDED.status = 'completed' THEN COALESCE(user_task_levels.completed_at, NOW())
      ELSE user_task_levels.completed_at
    END;
  -- NOTE: next level is intentionally NOT unlocked here. It unlocks 24h after
  -- the reward for this level is claimed (see unlock_due_task_levels).
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_task_level(UUID, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;

-- 3) Claim a level reward into the BONUS wallet (atomic, anti double-claim) -----
-- Reward amounts are fixed server-side so a client cannot inflate the payout.
CREATE OR REPLACE FUNCTION public.claim_task_reward(
  p_user_id UUID,
  p_level INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward NUMERIC;
  v_row public.user_task_levels;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_reward := CASE p_level
    WHEN 1 THEN 3 WHEN 2 THEN 3 WHEN 3 THEN 3 WHEN 4 THEN 3 WHEN 5 THEN 3
    WHEN 6 THEN 3 WHEN 7 THEN 3
    ELSE NULL
  END;

  IF v_reward IS NULL THEN
    RAISE EXCEPTION 'Invalid level';
  END IF;

  SELECT * INTO v_row
  FROM public.user_task_levels
  WHERE user_id = p_user_id AND level = p_level
  FOR UPDATE;

  IF v_row.user_id IS NULL OR v_row.status <> 'completed' THEN
    RAISE EXCEPTION 'Level not completed yet';
  END IF;

  IF v_row.reward_granted THEN
    RAISE EXCEPTION 'Reward already claimed';
  END IF;

  UPDATE public.user_task_levels
  SET reward_granted = true, reward_claimed_at = NOW()
  WHERE user_id = p_user_id AND level = p_level;

  IF p_level < 7 THEN
    UPDATE public.user_task_levels
    SET status = 'locked'
    WHERE user_id = p_user_id
      AND level = p_level + 1
      AND status <> 'completed';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET bonus_wallet = bonus_wallet + v_reward
  WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    p_user_id, v_reward, 'bonus', 'credit', 'daily_task',
    format('Level %s task reward claimed', p_level), p_user_id
  );

  RETURN v_reward;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_task_reward(UUID, INTEGER) TO authenticated;

-- 4) Unlock the next level once 24h have passed since the reward was claimed ----
CREATE OR REPLACE FUNCTION public.unlock_due_task_levels(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.user_task_levels n
  SET status = 'active'
  FROM public.user_task_levels p
  WHERE n.user_id = p_user_id
    AND p.user_id = p_user_id
    AND p.level = n.level - 1
    AND n.status = 'locked'
    AND p.reward_granted = true
    AND p.reward_claimed_at IS NOT NULL
    AND p.reward_claimed_at + INTERVAL '24 hours' <= NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_due_task_levels(UUID) TO authenticated;
