-- Realtime popups for daily task submissions (user Mark Done → admin, admin review → user).
-- Run in Supabase SQL Editor once.

ALTER TABLE public.user_task_submissions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_task_submissions;

-- Allow users to resubmit rejected tasks (Mark Done again)
DROP POLICY IF EXISTS "Users update own pending submissions" ON public.user_task_submissions;
CREATE POLICY "Users update own task submissions"
  ON public.user_task_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
