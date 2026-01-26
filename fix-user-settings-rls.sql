-- FIX: Erlaube Admins Änderungen an user_settings
-- Dies behebt den Fehler, dass "Sync Config" nicht funktioniert.

-- 1. Helper Funktion sicherstellen (falls noch nicht vorhanden)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM public.user_roles 
        WHERE user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Lösche alte, restrictive Policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Admins can manage all settings" ON public.user_settings;

-- 3. Neue Policies erstellen

-- BASIC: Jeder darf seine eigenen sehen/bearbeiten
CREATE POLICY "Users can manage own settings"
ON public.user_settings
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ADMIN: Darf ALLES sehen und bearbeiten
CREATE POLICY "Admins can manage all settings"
ON public.user_settings
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

-- Feedback
SELECT 'RLS Policies updated. Admins can now manage user_settings.' as result;
