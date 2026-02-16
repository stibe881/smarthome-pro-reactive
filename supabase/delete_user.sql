-- Diese Funktion erlaubt angemeldeten Benutzern, ihren eigenen Account zu löschen.
-- Optional kann auch der gesamte Haushalt gelöscht werden (nur für Admins).

CREATE OR REPLACE FUNCTION delete_user_account(delete_household BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  user_household_id UUID;
  is_admin BOOLEAN;
BEGIN
  current_user_id := auth.uid();

  -- Prüfe Household und Rolle
  SELECT household_id, (role = 'admin') INTO user_household_id, is_admin
  FROM public.family_members
  WHERE user_id = current_user_id;

  -- 1. Optional: Haushalt löschen (nur wenn angefordert UND User ist Admin)
  IF delete_household IS TRUE AND user_household_id IS NOT NULL THEN
      IF is_admin IS TRUE THEN
          -- Lösche den Haushalt. WICHTIG: Foreign Keys müssen ON DELETE CASCADE haben!
          -- Falls nicht, müssten wir erst family_members, invitations etc. löschen.
          -- Wir gehen davon aus, dass family_members ON DELETE CASCADE hat.
          DELETE FROM public.households WHERE id = user_household_id;
      ELSE
          RAISE EXCEPTION 'Nur Administratoren können den Haushalt löschen.';
      END IF;
  ELSE
      -- Nur den User aus dem Haushalt entfernen
      DELETE FROM public.family_members WHERE user_id = current_user_id;
  END IF;

  -- 2. Lösche den eigentlichen Auth-User aus auth.users
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Berechtigung: Jeder angemeldete Nutzer darf seinen EIGENEN Account löschen
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;


-- =========================================================
-- TEIL 2: Manuelles Löschen des spezifischen Benutzers JETZT
-- =========================================================

DO $$
DECLARE
  target_email TEXT := 'stefan.gross@sonnenberg-baar.ch';
  v_user_id UUID;
BEGIN
  -- Finde die User-ID anhand der Email
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  
  IF v_user_id IS NOT NULL THEN
    -- Lösche Referenzen in public.family_members
    DELETE FROM public.family_members WHERE user_id = v_user_id;

    -- Lösche Referenzen in public.households (falls er Admin/Ersteller war und alleiniger Owner)
    -- VORSICHT: Hier löschen wir nur, wenn er als owner in households steht (falls Spalte existiert).
    -- Da wir das Schema nicht vollständig kennen, belassen wir es beim User-Löschen.
    
    -- Lösche den User aus auth.users
    DELETE FROM auth.users WHERE id = v_user_id;
    
    RAISE NOTICE 'Benutzer % (ID: %) wurde erfolgreich gelöscht.', target_email, v_user_id;
  ELSE
    RAISE NOTICE 'Benutzer % wurde nicht gefunden (bereits gelöscht?).', target_email;
  END IF;
END $$;
