-- Erweitere Supabase Schema für Benutzerverwaltung
--
-- WICHTIG: Führe dieses SQL NACH dem ersten Schema aus
--

-- 1. Erstelle user_roles Tabelle für Rollenzuweisung
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 3. Aktiviere Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Alle Benutzer können ihre eigene Rolle sehen
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 5. RLS Policy: Admins können alle Rollen sehen
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 6. RLS Policy: Nur Admins können Rollen zuweisen/ändern
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 7. Funktion um zu prüfen, ob ein Benutzer Admin ist
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = user_uuid AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger: Automatisch 'user' Rolle beim Registrieren (admin für stefan.gross@hotmail.ch)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if email is stefan.gross@hotmail.ch
    SELECT email INTO user_role FROM auth.users WHERE id = NEW.id;
    
    IF user_role = 'stefan.gross@hotmail.ch' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'user');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 9. HINWEIS: Admin-Benutzer
-- stefan.gross@hotmail.ch wird automatisch als Admin registriert
-- Andere Benutzer können manuell zum Admin gemacht werden mit:
--
-- UPDATE public.user_roles 
-- SET role = 'admin' 
-- WHERE user_id = 'DEINE_USER_ID';

-- Fertig! Benutzerverwaltung ist aktiviert
