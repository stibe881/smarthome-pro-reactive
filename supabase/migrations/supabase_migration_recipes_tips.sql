-- Migration to add tips column to family_recipes
ALTER TABLE public.family_recipes ADD COLUMN IF NOT EXISTS tips text;
