-- DIAGNOSE & FIX: "column user_metadata does not exist"
-- Run this in the Supabase SQL Editor.

-- STEP 1: Find all policies that reference 'user_metadata'
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE qual::text ILIKE '%user_metadata%'
   OR with_check::text ILIKE '%user_metadata%';

-- STEP 2: Also check triggers and functions for 'user_metadata'
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%user_metadata%';

-- NOTE: After running the above, you will see which policy or function
-- references 'user_metadata'. In most cases, it should be replaced with
-- 'raw_user_meta_data' (the actual column in auth.users).
--
-- Example fix (replace POLICY_NAME and TABLE_NAME with what STEP 1 returns):
--
-- DROP POLICY "POLICY_NAME" ON TABLE_NAME;
-- CREATE POLICY "POLICY_NAME" ON TABLE_NAME
--   FOR ... USING (
--     ... auth.users.raw_user_meta_data ...
--   );
