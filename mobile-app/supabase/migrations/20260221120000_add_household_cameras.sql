-- Create household_cameras table for user-managed camera configuration
CREATE TABLE IF NOT EXISTS public.household_cameras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    custom_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(household_id, entity_id)
);

-- Enable RLS
ALTER TABLE public.household_cameras ENABLE ROW LEVEL SECURITY;

-- Policy: All household members can view camera configs
CREATE POLICY "Household members can view cameras"
    ON public.household_cameras
    FOR SELECT
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

-- Policy: All household members can insert camera configs
CREATE POLICY "Household members can add cameras"
    ON public.household_cameras
    FOR INSERT
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

-- Policy: All household members can update camera configs
CREATE POLICY "Household members can update cameras"
    ON public.household_cameras
    FOR UPDATE
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

-- Policy: All household members can delete camera configs
CREATE POLICY "Household members can delete cameras"
    ON public.household_cameras
    FOR DELETE
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );
