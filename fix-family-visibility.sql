-- FIX: RLS Policies erweitern, damit man alle Familienmitglieder sieht
-- Die vorherige Policy erlaubte nur den Zugriff auf den EIGENEN Datensatz.
-- Diese neue Policy erlaubt den Zugriff auf alle Mitglieder IM SELBEN HAUSHALT.

-- 1. Alte Policy löschen
DROP POLICY IF EXISTS "family_members_select_own" ON public.family_members;

-- 2. Neue Policy erstellen: "Users can view members of their household"
CREATE POLICY "family_members_select_household"
ON public.family_members
FOR SELECT
USING (
    household_id IN (
        SELECT household_id 
        FROM public.family_members 
        WHERE user_id = auth.uid()
    )
);

-- 3. Policy für Admins: Admins dürfen auch Mitglieder ihres Haushalts löschen/bearbeiten
-- (Falls das vorher auf 'own' beschränkt war)
-- Wir prüfen erst, ob wir UPDATE/DELETE Policies anpassen müssen.
-- Die existierende 'family_members_update_own' ist okay für Profile, aber Admins brauchen mehr Rechte.

-- Erstelle Policy für Admins zum Bearbeiten/Löschen von Mitgliedern ihres Haushalts
CREATE POLICY "admins_manage_household_members"
ON public.family_members
FOR ALL
USING (
    -- Der ausführende User muss ein Admin im selben Haushalt sein
    EXISTS (
        SELECT 1 
        FROM public.family_members as my_record
        WHERE my_record.user_id = auth.uid()
          AND my_record.role = 'admin'
          AND my_record.household_id = family_members.household_id
    )
);
