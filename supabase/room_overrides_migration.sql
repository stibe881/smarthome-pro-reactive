-- Room Overrides Table (Instance-wide, per household)
-- Each household can customize rooms, shared across all members/devices.

CREATE TABLE IF NOT EXISTS room_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    override_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(household_id, room_name)
);

-- RLS Policies
ALTER TABLE room_overrides ENABLE ROW LEVEL SECURITY;

-- Members can read overrides for their own household
CREATE POLICY "Members can read room overrides"
ON room_overrides FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
    )
);

-- Members can insert overrides for their own household
CREATE POLICY "Members can insert room overrides"
ON room_overrides FOR INSERT
WITH CHECK (
    household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
    )
);

-- Members can update overrides for their own household
CREATE POLICY "Members can update room overrides"
ON room_overrides FOR UPDATE
USING (
    household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
    )
);

-- Members can delete overrides for their own household
CREATE POLICY "Members can delete room overrides"
ON room_overrides FOR DELETE
USING (
    household_id IN (
        SELECT household_id FROM family_members WHERE user_id = auth.uid()
    )
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_room_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_overrides_updated_at
    BEFORE UPDATE ON room_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_room_overrides_updated_at();
