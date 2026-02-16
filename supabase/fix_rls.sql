-- RLS FIX: Erlaube authentifizierten Benutzern das Erstellen von Haushalten
-- Dies ist notwendig, damit die Registrierung funktioniert.

-- 1. Bestehende (möglicherweise fehlerhafte) Policies droppen, um Konflikte zu vermeiden
DROP POLICY IF EXISTS "Authenticated users can create households" ON households;
DROP POLICY IF EXISTS "Authenticated users can insert themselves" ON family_members;
DROP POLICY IF EXISTS "Authenticated users can create their own family member entry" ON family_members;

-- 2. Policy für HOUSEHOLDS: Jeder authentifizierte User darf einen neuen Haushalt anlegen.
CREATE POLICY "Authenticated users can create households" ON households
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 3. Policy für FAMILY_MEMBERS: Jeder authentifizierte User darf sich selbst als Mitglied hinzufügen.
-- Dies wird benötigt, nachdem der Haushalt erstellt wurde.
CREATE POLICY "Authenticated users can insert themselves" ON family_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Optional: Berechtigungen explizit setzen (zur Sicherheit)
GRANT INSERT ON households TO authenticated;
GRANT INSERT ON family_members TO authenticated;
