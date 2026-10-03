-- Fix daily task claim amounts: website shows $3/day but Supabase still paid old Level 1–10 rewards.
-- Run in Supabase SQL Editor (replaces claim_task_reward with $3 for Day 1–7).

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
  v_pending INTEGER;
  v_approved INTEGER;
  v_required_tasks INTEGER := 6;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- $3 per day (Days 1–7). Levels 8–10 are retired.
  v_reward := CASE p_level
    WHEN 1 THEN 3 WHEN 2 THEN 3 WHEN 3 THEN 3 WHEN 4 THEN 3 WHEN 5 THEN 3
    WHEN 6 THEN 3 WHEN 7 THEN 3
    ELSE NULL
  END;

  IF v_reward IS NULL THEN
    RAISE EXCEPTION 'Invalid level';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_pending
  FROM public.user_task_submissions
  WHERE user_id = p_user_id
    AND level = p_level
    AND status = 'pending';

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'All level tasks must be admin-approved before claiming';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_approved
  FROM public.user_task_submissions
  WHERE user_id = p_user_id
    AND level = p_level
    AND status = 'approved';

  IF v_approved < v_required_tasks THEN
    RAISE EXCEPTION 'Finish all level tasks and get admin approval first';
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
    format('Day %s task reward claimed', p_level), p_user_id
  );

  RETURN v_reward;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_task_reward(UUID, INTEGER) TO authenticated;
