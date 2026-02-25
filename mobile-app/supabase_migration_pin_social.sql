-- Migration: Add pin_likes and pin_comments tables for Family Pinboard
-- Run this in the Supabase SQL Editor

-- 1. Create pin_likes table
CREATE TABLE IF NOT EXISTS pin_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin_id UUID REFERENCES family_pins(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pin_id, user_id)
);

ALTER TABLE pin_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view pin likes" ON pin_likes
  FOR SELECT USING (
    pin_id IN (
      SELECT id FROM family_pins WHERE household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own likes" ON pin_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes" ON pin_likes
  FOR DELETE USING (user_id = auth.uid());

-- 2. Create pin_comments table
CREATE TABLE IF NOT EXISTS pin_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin_id UUID REFERENCES family_pins(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pin_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view pin comments" ON pin_comments
  FOR SELECT USING (
    pin_id IN (
      SELECT id FROM family_pins WHERE household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert comments" ON pin_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON pin_comments
  FOR DELETE USING (user_id = auth.uid());
