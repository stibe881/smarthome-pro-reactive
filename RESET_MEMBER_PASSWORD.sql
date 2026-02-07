-- PASSWORT FÜR EXISTIERENDEN BENUTZER MANUELL SETZEN
-- Führe dieses SQL im Supabase SQL Editor aus

DO $$
DECLARE
    target_user_email TEXT := 'stefan.gross@gross-ict.ch'; -- Hier die Email anpassen
    new_password TEXT := 'TestUser.1561!'; -- Hier das neue Passwort setzen
    user_uuid UUID;
BEGIN
    -- 1. User ID finden
    SELECT id INTO user_uuid FROM auth.users WHERE email = target_user_email;

    IF user_uuid IS NULL THEN
        RAISE NOTICE 'Benutzer % wurde nicht gefunden!', target_user_email;
    ELSE
        -- 2. Passwort aktualisieren (verschlüsselt)
        UPDATE auth.users 
        SET encrypted_password = crypt(new_password, gen_salt('bf')),
            updated_at = NOW(),
            last_sign_in_at = NULL -- Optional: Erzwingt quasi "frischen" Login
        WHERE id = user_uuid;

        -- 3. Sicherstellen, dass der Benutzer auch in family_members ist (Admin check)
        -- Nutzt den Haushalt des Admins (stefan.gross@hotmail.ch)
        INSERT INTO public.family_members (user_id, email, role, household_id)
        SELECT user_uuid, target_user_email, 'member', household_id
        FROM public.family_members
        WHERE email = 'stefan.gross@hotmail.ch'
        ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Passwort für % erfolgreich auf "%" gesetzt.', target_user_email, new_password;
    END IF;
END $$;
