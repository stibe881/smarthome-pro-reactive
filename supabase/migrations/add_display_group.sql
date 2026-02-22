-- Migration: Add display_group column to notification_types
-- Run this in Supabase SQL Editor

ALTER TABLE notification_types
  ADD COLUMN IF NOT EXISTS display_group TEXT DEFAULT NULL;

-- Set display_group values for existing notification types based on their name
UPDATE notification_types SET display_group = 'Haushalt' WHERE name IN ('Waschmaschine', 'Einkaufsliste', 'Geschirrspüler', 'Trockner');
UPDATE notification_types SET display_group = 'Babyphone' WHERE name IN ('Baby weint');
UPDATE notification_types SET display_group = 'Security Center' WHERE name IN ('Türen UG', 'Temp. und Feuchtigkeit Rack', 'Haustüre wurde geöffnet');
UPDATE notification_types SET display_group = 'Geburtstage' WHERE name IN ('Geburtstage');
UPDATE notification_types SET display_group = 'Wetter' WHERE name IN ('Wetterwarnung');
UPDATE notification_types SET display_group = 'Türklingel' WHERE name IN ('Türklingel');
UPDATE notification_types SET display_group = 'Akku' WHERE name IN ('Akkustand Ring');
UPDATE notification_types SET display_group = 'Tagesablauf' WHERE name IN ('Guten Morgen');
