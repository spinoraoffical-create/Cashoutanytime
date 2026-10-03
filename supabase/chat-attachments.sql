-- Chat attachments: run in Supabase SQL Editor
-- Safe to re-run (idempotent)

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_attachment_type_check'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_attachment_type_check
      CHECK (attachment_type IN ('image', 'file'));
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Chat participants can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can read attachments" ON storage.objects;

CREATE POLICY "Chat participants can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND (
      c.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
);

CREATE POLICY "Chat participants can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = (storage.foldername(name))[1]::uuid
    AND (
      c.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
);
