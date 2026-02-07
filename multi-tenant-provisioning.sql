-- AUTOMATISCHE HAUSHALTS-ERSTELLUNG BEI REGISTRIERUNG
-- Dieses Skript stellt sicher, dass jeder neue Benutzer seinen eigenen Haushalt bekommt.

-- 1. Funktion zum Erstellen des Haushalts
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    new_household_id UUID;
BEGIN
    -- Erstelle einen neuen Haushalt
    INSERT INTO public.households (name)
    VALUES ('Mein Zuhause')
    RETURNING id INTO new_household_id;

    -- Erstelle den Admin-Eintrag für diesen Benutzer im neuen Haushalt
    INSERT INTO public.family_members (user_id, email, role, household_id)
    VALUES (NEW.id, NEW.email, 'admin', new_household_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger an auth.users binden
DROP TRIGGER IF EXISTS on_auth_user_created_provisioning ON auth.users;
CREATE TRIGGER on_auth_user_created_provisioning
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. households Tabelle um dashboard_config erweitern
ALTER TABLE public.households 
ADD COLUMN IF NOT EXISTS dashboard_config JSONB DEFAULT '{}'::jsonb;

-- Skript abgeschlossen
