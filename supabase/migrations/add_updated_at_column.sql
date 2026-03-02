-- Add updated_at column to family_members table
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
