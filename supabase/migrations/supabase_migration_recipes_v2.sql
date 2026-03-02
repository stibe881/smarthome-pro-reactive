-- Migration: Rezeptbuch v2 – Neue Spalten für Schwierigkeitsgrad, Tags, Notizen und Multi-Kategorien
-- Bitte im Supabase SQL Editor ausführen

ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE family_recipes ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
