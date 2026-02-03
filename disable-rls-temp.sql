-- DEBUG: RLS temporär deaktivieren, um zu prüfen, ob es daran liegt
-- ACHTUNG: Das macht die Tabelle 'family_members' kurzzeitig für alle lesbar.
-- Wir nutzen das nur zum Testen, ob die Daten dann in der App erscheinen.

ALTER TABLE public.family_members DISABLE ROW LEVEL SECURITY;

-- Zum Bestätigen
SELECT 'RLS disabled for family_members' as status;
