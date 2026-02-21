-- Create household_cameras table for admin-managed camera configuration
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

-- Policy: Members of the household can read camera configs
CREATE POLICY "Household members can view cameras"
    ON public.household_cameras
    FOR SELECT
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
        )
    );

-- Policy: Only admins can insert camera configs
CREATE POLICY "Admins can add cameras"
    ON public.household_cameras
    FOR INSERT
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM public.family_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Only admins can update camera configs
CREATE POLICY "Admins can update cameras"
    ON public.household_cameras
    FOR UPDATE
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Only admins can delete camera configs
CREATE POLICY "Admins can delete cameras"
    ON public.household_cameras
    FOR DELETE
    USING (
        household_id IN (
            SELECT household_id FROM public.family_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
