-- Migration: Add family_celebrations table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS family_celebrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'birthday', -- 'birthday', 'anniversary', 'celebration'
  event_date DATE NOT NULL,
  show_year BOOLEAN DEFAULT true,
  all_day BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#8B8FC7',
  emoji TEXT DEFAULT '🎂',
  image_url TEXT,
  repeat_type TEXT DEFAULT 'yearly', -- 'none', 'yearly'
  reminder_time TEXT DEFAULT 'same_day_09', -- 'same_day_09', 'day_before_09', 'week_before_09', 'none'
  visibility TEXT DEFAULT 'everyone',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_celebrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view celebrations" ON family_celebrations
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create celebrations" ON family_celebrations
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can update celebrations" ON family_celebrations
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can delete celebrations" ON family_celebrations
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );
