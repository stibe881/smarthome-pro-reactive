-- Add image_url column to family_contacts table
ALTER TABLE family_contacts ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
