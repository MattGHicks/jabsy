-- Add media support to league messages
ALTER TABLE league_messages
  ADD COLUMN message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'gif')),
  ADD COLUMN image_url text;

-- Increase content limit for GIF URLs (Tenor URLs can be long)
ALTER TABLE league_messages DROP CONSTRAINT league_messages_content_check;
ALTER TABLE league_messages ADD CONSTRAINT league_messages_content_check
  CHECK (
    (message_type = 'text' AND char_length(content) BETWEEN 1 AND 500)
    OR (message_type IN ('image', 'gif') AND (content IS NULL OR char_length(content) <= 500))
  );

-- Make content nullable for image-only messages
ALTER TABLE league_messages ALTER COLUMN content DROP NOT NULL;

-- Create chat-images storage bucket (public reads, authenticated writes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Chat images storage policies
CREATE POLICY "Anyone can view chat images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

CREATE POLICY "League members can upload chat images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete own chat images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
