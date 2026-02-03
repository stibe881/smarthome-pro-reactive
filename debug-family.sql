-- DEBUG: Zeige alle Familienmitglieder, die vom aktuellen Admin (oder überhaupt) eingeladen wurden
-- Damit sehen wir, ob die household_ids gesetzt sind.

SELECT 
    email, 
    role, 
    household_id, 
    invited_by,
    created_at
FROM public.family_members
ORDER BY created_at DESC;

-- Prüfe auch, ob es überhaupt Einträge in family_invitations gibt
SELECT * FROM public.family_invitations;
