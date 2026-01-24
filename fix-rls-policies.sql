-- FINALE LÖSUNG: RLS ohne Rekursion
-- Problem: Admin-Policies verursachen infinite recursion
-- Lösung: SECURITY DEFINER Funktion die RLS umgeht

-- 1. Lösche ALLE bestehenden Policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 2. Erstelle Helper-Funktion die RLS umgeht
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

-- 3. Erstelle EINFACHE Policies ohne Rekursion

-- Jeder kann seine eigene Rolle sehen
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Jeder kann seine eigene Rolle einfügen (für Trigger)
CREATE POLICY "Users can insert own role"
ON public.user_roles
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins können ALLE Rollen sehen (nutzt SECURITY DEFINER Funktion)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.get_my_role() = 'admin');

-- Admins können ALLE Rollen aktualisieren
CREATE POLICY "Admins can update all roles"
ON public.user_roles
FOR UPDATE
USING (public.get_my_role() = 'admin');

-- Admins können ALLE Rollen löschen
CREATE POLICY "Admins can delete all roles"
ON public.user_roles
FOR DELETE
USING (public.get_my_role() = 'admin');

-- 4. Test: Prüfe ob es funktioniert
SELECT public.get_my_role();
