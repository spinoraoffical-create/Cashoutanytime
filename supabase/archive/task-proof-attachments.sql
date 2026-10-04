-- Task proof screenshots (uses chat-attachments bucket) — run in Supabase SQL Editor

DROP POLICY IF EXISTS "Users can upload task proof images" ON storage.objects;
DROP POLICY IF EXISTS "Users and admins can read task proofs" ON storage.objects;

CREATE POLICY "Users can upload task proof images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'task-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users and admins can read task proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'task-proofs'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
