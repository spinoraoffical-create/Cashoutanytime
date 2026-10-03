-- Daily Task System — run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_task_levels (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  points_earned INTEGER NOT NULL DEFAULT 0,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, level)
);

CREATE TABLE IF NOT EXISTS public.user_task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_note TEXT,
  proof_url TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user ON public.user_task_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_status ON public.user_task_submissions (status);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_level ON public.user_task_submissions (level);

CREATE TRIGGER user_task_submissions_updated_at
  BEFORE UPDATE ON public.user_task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_task_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task levels"
  ON public.user_task_levels FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users view own task submissions"
  ON public.user_task_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own task submissions"
  ON public.user_task_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own pending submissions"
  ON public.user_task_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all task submissions"
  ON public.user_task_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update task submissions"
  ON public.user_task_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins view all task levels"
  ON public.user_task_levels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Initialize levels for a user (level 1 active)
CREATE OR REPLACE FUNCTION public.init_user_task_levels(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_task_levels (user_id, level, status)
  SELECT p_user_id, lvl,
    CASE WHEN lvl = 1 THEN 'active' ELSE 'locked' END
  FROM generate_series(1, 10) AS lvl
  ON CONFLICT (user_id, level) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.init_user_task_levels(UUID) TO authenticated;

-- Upsert level progress (service path via admin review)
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

  -- Next level unlocks only after claim + 24h (see unlock_due_task_levels).
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_task_level(UUID, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;
