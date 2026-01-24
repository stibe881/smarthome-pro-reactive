-- SCHNELL-FIX: Manuell Admin-Rolle für stefan.gross@hotmail.ch setzen
-- 
-- Führe dieses SQL in Supabase aus, um sicherzustellen, dass die Rolle gesetzt ist

-- 1. Finde die User ID von stefan.gross@hotmail.ch
SELECT id, email FROM auth.users WHERE email = 'stefan.gross@hotmail.ch';

-- 2. Setze die Admin-Rolle (ersetze USER_ID mit der ID aus Schritt 1)
-- ODER wenn du die ID nicht kopieren willst, nutze dieses One-Liner:

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'stefan.gross@hotmail.ch'
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin';

-- 3. Verifiziere, dass es funktioniert hat
SELECT u.email, ur.role 
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'stefan.gross@hotmail.ch';

-- Du solltest sehen: stefan.gross@hotmail.ch | admin
