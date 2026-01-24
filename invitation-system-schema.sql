-- Einladungssystem: Datenbank-Schema
-- Ermöglicht Admins, Benutzer einzuladen statt offener Registrierung

-- 1. Erstelle invitations Tabelle
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(email, status) -- Nur eine pending invitation pro Email
);

-- 2. Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- 3. Aktiviere Row Level Security
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Admins können alle Einladungen sehen
CREATE POLICY "Admins can view invitations"
ON public.invitations
FOR SELECT
USING (public.get_my_role() = 'admin');

-- 5. RLS Policy: Admins können Einladungen erstellen
CREATE POLICY "Admins can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (public.get_my_role() = 'admin' AND invited_by = auth.uid());

-- 6. RLS Policy: Admins können Einladungen löschen
CREATE POLICY "Admins can delete invitations"
ON public.invitations
FOR DELETE
USING (public.get_my_role() = 'admin');

-- 7. RLS Policy: Jeder kann Einladung per Token sehen (für Registrierung)
CREATE POLICY "Anyone can view invitation by token"
ON public.invitations
FOR SELECT
USING (token IS NOT NULL);

-- 8. RLS Policy: Jeder kann Einladung akzeptieren (Status update)
CREATE POLICY "Anyone can accept invitation by token"
ON public.invitations
FOR UPDATE
USING (status = 'pending' AND expires_at > NOW());

-- 9. Funktion: Abgelaufene Einladungen automatisch markieren
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE public.invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Funktion: Token generieren
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Test: Tabelle existiert?
SELECT COUNT(*) FROM public.invitations;
