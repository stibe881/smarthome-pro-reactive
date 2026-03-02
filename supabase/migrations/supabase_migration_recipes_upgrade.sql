-- Migration: Add source_url and is_favorite to family_recipes
-- Run this in the Supabase SQL Editor

ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS added_by_name TEXT;
