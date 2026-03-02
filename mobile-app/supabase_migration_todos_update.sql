-- Migration: Add category, description columns to family_todos
-- Also change due_date from DATE to TIMESTAMPTZ to support time

-- 1. Add category column
ALTER TABLE family_todos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- 2. Add description column
ALTER TABLE family_todos ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- 3. Change due_date from DATE to TIMESTAMPTZ to store date + time
ALTER TABLE family_todos ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::TIMESTAMPTZ;
