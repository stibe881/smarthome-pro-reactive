-- Migration: Add is_birthday_calendar flag to planner_calendar_sources
-- Run this in the Supabase SQL Editor

ALTER TABLE planner_calendar_sources
ADD COLUMN IF NOT EXISTS is_birthday_calendar BOOLEAN DEFAULT false;

-- Ensure only one birthday calendar per household
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_birthday_cal_per_household
ON planner_calendar_sources (household_id)
WHERE is_birthday_calendar = true;
