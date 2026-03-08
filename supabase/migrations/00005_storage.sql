-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('fighters', 'fighters', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar storage policies
CREATE POLICY "avatars_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Fighter image storage (admin only for writes, public reads)
CREATE POLICY "fighters_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fighters');

CREATE POLICY "fighters_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "fighters_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "fighters_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
