-- =============================================================
-- Migration: Multi-Device Push Tokens
-- Ein User kann auf mehreren Geräten angemeldet sein,
-- jedes Gerät bekommt seine eigene Push-Notification.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_own"
  ON public.push_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert_own"
  ON public.push_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_update_own"
  ON public.push_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_delete_own"
  ON public.push_tokens FOR DELETE
  USING (user_id = auth.uid());

-- Indizes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- Bestehende Tokens migrieren (aus family_members)
INSERT INTO public.push_tokens (user_id, token)
SELECT user_id, push_token FROM public.family_members
WHERE push_token IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT (user_id, token) DO NOTHING;
