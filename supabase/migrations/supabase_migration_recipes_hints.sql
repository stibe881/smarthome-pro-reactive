-- Migration to add hints column to family_recipes
ALTER TABLE public.family_recipes ADD COLUMN IF NOT EXISTS hints text;
