-- Migration: Countdown auf Homescreen anzeigen
-- Bitte im Supabase SQL Editor ausführen

ALTER TABLE family_countdowns ADD COLUMN IF NOT EXISTS show_on_homescreen BOOLEAN DEFAULT false;
ALTER TABLE family_countdowns ADD COLUMN IF NOT EXISTS auto_show_days INTEGER DEFAULT NULL;
ALTER TABLE family_countdowns ADD COLUMN IF NOT EXISTS target_time VARCHAR DEFAULT NULL;
ALTER TABLE family_countdowns ADD COLUMN IF NOT EXISTS display_format VARCHAR DEFAULT 'auto';
