-- ============================================
-- Family Planner Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add planner_access to family_members
ALTER TABLE family_members 
  ADD COLUMN IF NOT EXISTS planner_access BOOLEAN DEFAULT true;

-- 1b. Add display_name column for children and member names
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS display_name TEXT;

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
  assigned_to UUID,  -- references family_members.id (no FK, children have no auth user)
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date DATE,
  priority TEXT DEFAULT 'normal',
  points INTEGER DEFAULT 0,  -- points awarded on completion (can be negative)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3b. Add points column if table already exists
ALTER TABLE family_todos ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- 3c. Create reward_points table for tracking member points
CREATE TABLE IF NOT EXISTS reward_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_name TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reward_points ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "rw_reward_points" ON reward_points
    FOR ALL USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3d. Create reward_history table for point transaction log
CREATE TABLE IF NOT EXISTS reward_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_name TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  type TEXT DEFAULT 'manual',  -- 'manual', 'task', 'redeem'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "rw_reward_history" ON reward_history
    FOR ALL USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- ============================================
-- Phase 3: Extended Family Hub Tables
-- ============================================

-- 5. Meal Plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  meal_type TEXT NOT NULL DEFAULT 'lunch',
  meal_name TEXT NOT NULL,
  ingredients TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view meal_plans" ON meal_plans
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert meal_plans" ON meal_plans
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update meal_plans" ON meal_plans
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete meal_plans" ON meal_plans
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 6. Reward Points
CREATE TABLE IF NOT EXISTS reward_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_name TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reward_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view reward_points" ON reward_points
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert reward_points" ON reward_points
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update reward_points" ON reward_points
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete reward_points" ON reward_points
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 7. Reward Catalog
CREATE TABLE IF NOT EXISTS reward_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  points_required INTEGER NOT NULL DEFAULT 10,
  emoji TEXT DEFAULT '🎁',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view reward_catalog" ON reward_catalog
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert reward_catalog" ON reward_catalog
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update reward_catalog" ON reward_catalog
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete reward_catalog" ON reward_catalog
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 8. Family Contacts
CREATE TABLE IF NOT EXISTS family_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view family_contacts" ON family_contacts
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert family_contacts" ON family_contacts
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update family_contacts" ON family_contacts
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete family_contacts" ON family_contacts
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 9. Family Routines
CREATE TABLE IF NOT EXISTS family_routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  time_of_day TEXT NOT NULL DEFAULT 'morning',
  assigned_to_name TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view family_routines" ON family_routines
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert family_routines" ON family_routines
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update family_routines" ON family_routines
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete family_routines" ON family_routines
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 10. Packing Lists
CREATE TABLE IF NOT EXISTS packing_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🧳',
  items JSONB DEFAULT '[]'::jsonb,
  checked_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view packing_lists" ON packing_lists
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert packing_lists" ON packing_lists
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update packing_lists" ON packing_lists
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete packing_lists" ON packing_lists
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

-- 11. Family Countdowns
CREATE TABLE IF NOT EXISTS family_countdowns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_date DATE NOT NULL,
  emoji TEXT DEFAULT '🎉',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE family_countdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view family_countdowns" ON family_countdowns
  FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can insert family_countdowns" ON family_countdowns
  FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can update family_countdowns" ON family_countdowns
  FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Household members can delete family_countdowns" ON family_countdowns
  FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));

