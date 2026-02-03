-- FIX: Rekursions-Problem in der RLS Policy beheben
-- Das Problem war: Um zu prüfen, ob du Mitglieder sehen darfst, muss die Datenbank deinen Haushalt nachschlagen. 
-- Dazu muss sie die Tabelle lesen -> wofür sie wieder prüfen muss, ob du darfst -> Endlosschleife.

-- 1. Hilfsfunktion, die den RLS-Schutz umgeht (SECURITY DEFINER), um NUR die eigene ID zu holen
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT household_id
    FROM public.family_members
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Alte/Fehlerhafte Policies löschen
DROP POLICY IF EXISTS "family_members_select_household" ON public.family_members;
DROP POLICY IF EXISTS "family_members_select_own" ON public.family_members;
DROP POLICY IF EXISTS "family_members_view_household" ON public.family_members;

-- 3. Neue, sichere Policy erstellen
CREATE POLICY "view_household_members"
ON public.family_members
FOR SELECT
USING (
    -- Entweder es ist mein eigener Eintrag (immer erlaubt)
    user_id = auth.uid()
    -- ODER der Haushalt stimmt mit meinem überein (nutzt die sichere Funktion)
    OR household_id = public.get_my_household_id()
);

-- Policy zum Bearbeiten (für Admins) - Sicherheitshalber neu setzen
DROP POLICY IF EXISTS "admins_manage_household_members" ON public.family_members;
CREATE POLICY "admins_manage_household_members"
ON public.family_members
FOR ALL  -- SELECT, INSERT, UPDATE, DELETE
USING (
    -- Ich bin Admin in diesem Haushalt
    EXISTS (
        SELECT 1 
        FROM public.family_members 
        WHERE user_id = auth.uid() 
          AND role = 'admin' 
          AND household_id = public.family_members.household_id
    )
);
