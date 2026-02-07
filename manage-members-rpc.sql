-- 0. Sicherstellen, dass is_active Spalte existiert
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 1. Passwort für ein Mitglied zurücksetzen
CREATE OR REPLACE FUNCTION public.reset_member_password(p_user_id UUID, p_new_password TEXT)
RETURNS void AS $$
BEGIN
    -- Nur Admins sollten dies tun können (Zusätzliche Prüfung auf App-Ebene oder hier via user_roles)
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        user_metadata = jsonb_set(user_metadata, '{must_change_password}', 'true')
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mitglied aus Haushalt entfernen
CREATE OR REPLACE FUNCTION public.remove_family_member(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Löscht den User aus auth.users. 
    -- Da er nicht auth.uid() ist, braucht diese Funktion SECURITY DEFINER und Admin-Logik.
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Zugriff umschalten (Aktiv/Deaktiviert)
-- Wir nutzen ein 'is_active' Flag in family_members oder sperren den Login.
-- Einfachste Lösung: Ein Flag in family_members, das wir im Auth-Prozess prüfen könnten,
-- oder wir setzen das 'banned_until' Feld in auth.users für Deaktivierung.

CREATE OR REPLACE FUNCTION public.toggle_member_access(p_user_id UUID, p_active BOOLEAN)
RETURNS void AS $$
BEGIN
    IF p_active THEN
        UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
    ELSE
        UPDATE auth.users SET banned_until = '2099-01-01 00:00:00' WHERE id = p_user_id;
    END IF;
    
    UPDATE public.family_members SET is_active = p_active WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
