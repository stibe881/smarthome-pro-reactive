-- FIX: Verweiste Familienmitglieder reparieren
-- Dieses Skript weist Mitgliedern, die ohne household_id erstellt wurden (wegen des vorherigen Bugs),
-- automatisch den Haushalt zu, zu dem der "Einlader" (Admin) gehört.

UPDATE public.family_members fm
SET household_id = (
    SELECT admin.household_id
    FROM public.family_members admin
    WHERE admin.user_id = fm.invited_by
)
WHERE fm.household_id IS NULL 
  AND fm.invited_by IS NOT NULL;

-- Prüfung: Zeige alle Mitglieder an, die immer noch keinen Haushalt haben (sollte 0 sein)
SELECT * FROM public.family_members WHERE household_id IS NULL;
