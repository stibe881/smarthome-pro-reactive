-- AGGRESSIVE FIX for family_members RLS recursion
-- Run this COMPLETE script in Supabase SQL Editor

-- ========================================
-- STEP 1: DISABLE RLS TEMPORARILY (to avoid errors during cleanup)
-- ========================================
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE households DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: DROP ALL EXISTING POLICIES on family_members
-- ========================================
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'family_members'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON family_members';
    END LOOP;
END $$;

-- ========================================
-- STEP 3: DROP ALL EXISTING POLICIES on households
-- ========================================
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'households'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON households';
    END LOOP;
END $$;

-- ========================================
-- STEP 4: RE-ENABLE RLS
-- ========================================
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: CREATE SIMPLE NON-RECURSIVE POLICIES for family_members
-- ========================================

-- Users can read their OWN row only (no recursion possible)
CREATE POLICY "family_members_select_own"
  ON family_members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their OWN row only
CREATE POLICY "family_members_update_own"
  ON family_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- STEP 6: CREATE SIMPLE POLICIES for households
-- (Uses subquery but family_members policy is now simple, so no recursion)
-- ========================================

CREATE POLICY "households_select_member"
  ON households
  FOR SELECT
  USING (
    id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "households_update_member"
  ON households
  FOR UPDATE
  USING (
    id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
  );

-- ========================================
-- DONE! Run this entire script.
-- ========================================
