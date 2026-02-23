-- ============================================
-- Family Planner Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add planner_access to family_members
ALTER TABLE family_members 
  ADD COLUMN IF NOT EXISTS planner_access BOOLEAN DEFAULT true;

-- 2. Create planner_events table
CREATE TABLE IF NOT EXISTS planner_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#3B82F6',
  category TEXT DEFAULT 'event',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE planner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view events" ON planner_events
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create events" ON planner_events
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can update events" ON planner_events
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can delete events" ON planner_events
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

-- 3. Create family_todos table
CREATE TABLE IF NOT EXISTS family_todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date DATE,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view todos" ON family_todos
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create todos" ON family_todos
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can update todos" ON family_todos
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can delete todos" ON family_todos
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

-- 4. Create family_pins table
CREATE TABLE IF NOT EXISTS family_pins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT,
  image_url TEXT,
  pin_type TEXT DEFAULT 'note',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view pins" ON family_pins
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create pins" ON family_pins
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can update pins" ON family_pins
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can delete pins" ON family_pins
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

