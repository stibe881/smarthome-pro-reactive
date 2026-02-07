-- ACCOUNT UND HAUSHALT LÖSCHEN LOGIK
-- Dieses Skript stellt sicher, dass beim Löschen eines Users auch dessen Haushalt gelöscht wird, 
-- falls er das letzte Mitglied ist.

-- 1. Funktion zum Löschen des Accounts und aufräumen der Haushalte
CREATE OR REPLACE FUNCTION public.handle_delete_user_and_household()
RETURNS TRIGGER AS $$
DECLARE
    v_household_id UUID;
    v_member_count INT;
BEGIN
    -- Hole die household_id des zu löschenden Users
    SELECT household_id INTO v_household_id 
    FROM public.family_members 
    WHERE user_id = OLD.id;

    -- Falls der User in einem Haushalt war
    IF v_household_id IS NOT NULL THEN
        -- Zähle verbleibende Mitglieder
        SELECT COUNT(*) INTO v_member_count 
        FROM public.family_members 
        WHERE household_id = v_household_id AND user_id != OLD.id;

        -- Falls keine Mitglieder mehr übrig sind, lösche den Haushalt
        -- (Das triggert Kaskaden-Löschung für h_credentials, dashboard_config etc.)
        IF v_member_count = 0 THEN
            DELETE FROM public.households WHERE id = v_household_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger auf auth.users (läuft VOR dem Löschen des Users)
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    BEFORE DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user_and_household();

-- 3. Sicherstellen, dass FKs kaskadieren (falls noch nicht gesetzt)
-- ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_household_id_fkey;
-- ALTER TABLE public.family_members ADD CONSTRAINT family_members_household_id_fkey 
--     FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;
