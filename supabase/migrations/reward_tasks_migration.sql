-- reward_tasks_migration.sql
-- Create the reward_tasks table for predefined tasks that grant points
CREATE TABLE IF NOT EXISTS reward_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 5,
  emoji TEXT DEFAULT '✅',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE reward_tasks ENABLE ROW LEVEL SECURITY;

-- Policies for reward_tasks
DO $$ BEGIN
  CREATE POLICY "Household members can view reward_tasks" ON reward_tasks
    FOR SELECT USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Household members can insert reward_tasks" ON reward_tasks
    FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Household members can update reward_tasks" ON reward_tasks
    FOR UPDATE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Household members can delete reward_tasks" ON reward_tasks
    FOR DELETE USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
