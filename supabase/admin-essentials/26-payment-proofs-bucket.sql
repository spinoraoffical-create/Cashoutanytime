-- Create the private "payment-proofs" storage bucket.
--
-- Migration 0020 only left a comment telling the operator to create this bucket
-- by hand in the Supabase dashboard, which was never done — so every deposit /
-- new-account request failed at the image-upload step and the request was never
-- saved (nothing reached /admin/requests). This creates the bucket properly.
--
-- It is PRIVATE: payment screenshots are sensitive. All uploads and reads go
-- through the service-role admin client (src/lib/actions/request.ts uploads;
-- /admin/requests generates short-lived signed URLs), which bypasses RLS, so no
-- storage.objects policies are required for this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 8388608,
   array['image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do nothing;
