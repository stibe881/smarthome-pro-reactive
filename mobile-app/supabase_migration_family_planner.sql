-- Migration to create the family_planner table
CREATE TABLE IF NOT EXISTS public.family_planner (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- e.g. 'recipe'
    date DATE NOT NULL,
    recipe_id UUID REFERENCES public.family_recipes(id) ON DELETE SET NULL
);

-- RLS Policies
ALTER TABLE public.family_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view planner entries in their household"
    ON public.family_planner FOR SELECT
    USING (household_id IN (
        SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert planner entries in their household"
    ON public.family_planner FOR INSERT
    WITH CHECK (household_id IN (
        SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update planner entries in their household"
    ON public.family_planner FOR UPDATE
    USING (household_id IN (
        SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete planner entries in their household"
    ON public.family_planner FOR DELETE
    USING (household_id IN (
        SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Realtime functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_planner;
