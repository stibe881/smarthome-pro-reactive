-- Add dashboard_config JSONB column to households table (if not exists)
-- Used to store shared entity configurations (doors, weather, etc.) across all household members
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'households'
        AND column_name = 'dashboard_config'
    ) THEN
        ALTER TABLE public.households ADD COLUMN dashboard_config jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.households.dashboard_config IS 'Shared dashboard configuration (entity configs, door sensors, etc.) synced across all household members';
