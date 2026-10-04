-- Allow everyone (including visitors not logged in) to read reviews on the home page
-- Run in Supabase SQL Editor

CREATE POLICY "Public can view reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Let visitors see reviewer display names on the home page (only users with a review)
CREATE POLICY "Public can view reviewer profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.reviews WHERE user_id = profiles.id));
