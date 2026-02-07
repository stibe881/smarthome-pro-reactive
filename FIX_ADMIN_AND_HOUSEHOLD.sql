-- RUNDUM-SORGLOS-FIX: Admin-Status und Haushalt reparieren
-- Führe dieses SQL im Supabase SQL Editor aus

DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'stefan.gross@hotmail.ch'; -- Deine Email
    target_household_id UUID;
BEGIN
    -- 1. Finde deine User ID
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'User % nicht gefunden. Überspringe Fix.', user_email;
    ELSE
        RAISE NOTICE 'Fixe Status für User: % (%)', user_email, user_uuid;

        -- 2. Sicherstellen, dass Admin-Rolle in user_roles existiert
        INSERT INTO public.user_roles (user_id, role)
        VALUES (user_uuid, 'admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

        -- 3. Haushalt finden oder erstellen
        SELECT id INTO target_household_id FROM public.households LIMIT 1;
        
        IF target_household_id IS NULL THEN
            INSERT INTO public.households (name)
            VALUES ('Haupt-Haushalt')
            RETURNING id INTO target_household_id;
            RAISE NOTICE 'Neuer Haushalt erstellt: %', target_household_id;
        END IF;

        -- 4. Sicherstellen, dass Admin-Eintrag in family_members existiert
        INSERT INTO public.family_members (user_id, email, role, household_id)
        VALUES (user_uuid, user_email, 'admin', target_household_id)
        ON CONFLICT (user_id) DO UPDATE SET 
            role = 'admin',
            household_id = EXCLUDED.household_id;

        RAISE NOTICE 'ERFOLG: Du bist jetzt Admin im Haushalt %', target_household_id;
    END IF;
END $$;

-- Kontroll-Abfrage
SELECT 
    u.email,
    ur.role as system_role,
    fm.role as family_role,
    fm.household_id
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.family_members fm ON u.id = fm.user_id
WHERE u.email = 'stefan.gross@hotmail.ch';
