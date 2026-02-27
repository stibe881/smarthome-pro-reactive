-- Add rest_time column to recipes table
ALTER TABLE public.recipes 
ADD COLUMN IF NOT EXISTS rest_time INTEGER;

-- Update the TypeScript types for the recipes table (if you generate them from here)
COMMENT ON COLUMN public.recipes.rest_time IS 'Optionale Ruhezeit in Minuten (z.B. für Teig)';
