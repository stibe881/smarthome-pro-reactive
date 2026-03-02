-- =============================================
-- Neue Family Hub Tabellen
-- =============================================

-- 1. Wiederkehrende Aufgaben (Spalte zu family_todos)
ALTER TABLE family_todos ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT NULL;

-- 2. Familienrezepte
CREATE TABLE IF NOT EXISTS family_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    description TEXT,
    ingredients TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    servings INTEGER NOT NULL DEFAULT 4,
    prep_time INTEGER,
    cook_time INTEGER,
    category TEXT NOT NULL DEFAULT 'other',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE family_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_household" ON family_recipes FOR ALL
    USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid() AND is_active = true));

-- 3. Familienstandorte
CREATE TABLE IF NOT EXISTS family_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    member_name TEXT NOT NULL DEFAULT 'Unbekannt',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    sharing_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, user_id)
);

ALTER TABLE family_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_household" ON family_locations FOR ALL
    USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid() AND is_active = true));

-- 4. Familiendokumente
CREATE TABLE IF NOT EXISTS family_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE family_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_household" ON family_documents FOR ALL
    USING (household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid() AND is_active = true));

-- Storage Bucket für Dokumente
INSERT INTO storage.buckets (id, name, public) VALUES ('family-documents', 'family-documents', true) ON CONFLICT DO NOTHING;

CREATE POLICY "family_docs_upload" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'family-documents');

CREATE POLICY "family_docs_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'family-documents');

CREATE POLICY "family_docs_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'family-documents');
