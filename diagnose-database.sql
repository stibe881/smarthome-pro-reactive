-- DIAGNOSE-SCRIPT: Überprüfen, ob alles korrekt eingerichtet ist
-- Führe dieses SQL in Supabase aus, um zu sehen, was fehlt

-- 1. CHECK: Existiert die user_roles Tabelle?
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
) AS user_roles_table_exists;

-- 2. CHECK: Wie viele Einträge hat die Tabelle?
SELECT COUNT(*) as total_roles FROM public.user_roles;

-- 3. CHECK: Welche Benutzer gibt es und welche Rollen haben sie?
SELECT 
    u.id,
    u.email,
    ur.role,
    ur.created_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- 4. CHECK: Gibt es einen Admin?
SELECT 
    u.email,
    ur.role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- ERGEBNIS INTERPRETATION:
-- - Wenn "user_roles_table_exists" = false ist → Tabelle fehlt → führe supabase-user-management.sql aus
-- - Wenn "total_roles" = 0 ist → Keine Rollen gesetzt → führe fix-admin-role.sql aus
-- - Wenn stefan.gross@hotmail.ch nicht admin ist → führe fix-admin-role.sql aus
