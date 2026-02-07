-- FUNKTION ZUM LÖSCHEN DES EIGENEN KONTOS
-- Führe dies im Supabase SQL Editor aus.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
    -- Wir löschen den User aus auth.users. 
    -- Da wir einen BEFORE DELETE Trigger haben (handle_delete_user_and_household),
    -- wird der Haushalt automatisch mitgelöscht, falls der User das letzte Mitglied ist.
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
