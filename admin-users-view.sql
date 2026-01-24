-- Admin-Helper: View für Benutzerliste (für Admins sichtbar)
-- Ermöglicht Admins, alle Benutzer zu sehen ohne Admin API Key

CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;

-- Grant für authenticated Users (RLS wird von den zugrundeliegenden Tabellen vererbt)
GRANT SELECT ON public.admin_users_view TO authenticated;

-- Test: Prüfe ob die View funktioniert
SELECT * FROM public.admin_users_view;

