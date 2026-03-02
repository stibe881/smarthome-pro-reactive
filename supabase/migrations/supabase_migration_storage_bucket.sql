-- Create the family-pins storage bucket for pinboard photos
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-pins',
  'family-pins',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- 2. Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload pin images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'family-pins');

-- 3. Allow public read access (since bucket is public)
CREATE POLICY "Public read access for pin images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'family-pins');

-- 4. Allow users to delete their own uploads
CREATE POLICY "Users can delete own pin images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'family-pins');
