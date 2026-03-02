-- ============================================
-- Shopping List: Categories & Product Catalog
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Shopping Categories (per household, with sort order)
CREATE TABLE IF NOT EXISTS shopping_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'tag',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shopping_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rw_shopping_categories" ON shopping_categories
    FOR ALL USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Product Catalog (maps product name → category, per household)
CREATE TABLE IF NOT EXISTS shopping_product_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,       -- lowercase, normalized for matching
  display_name TEXT NOT NULL,       -- original casing for display
  category_id UUID REFERENCES shopping_categories(id) ON DELETE SET NULL,
  use_count INT DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, product_name)
);

ALTER TABLE shopping_product_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rw_shopping_product_catalog" ON shopping_product_catalog
    FOR ALL USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Insert default categories (will be inserted per-household by the app on first use)
-- No global defaults needed here — the app handles this.
