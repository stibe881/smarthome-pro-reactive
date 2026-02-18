-- =============================================================
-- Migration: Dynamic Notification Types (Admin-verwaltbar)
-- =============================================================

-- 1. notification_types – von Admins erstellbare Benachrichtigungs-Kategorien
CREATE TABLE IF NOT EXISTS public.notification_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                     -- z.B. "Trockner fertig"
    description TEXT,                       -- z.B. "Wenn der Trockner fertig ist"
    icon TEXT DEFAULT 'bell',               -- Lucide icon name
    color TEXT DEFAULT '#3B82F6',           -- Hex Farbe
    category_key TEXT NOT NULL,             -- Eindeutiger Key: "dryer_done"
    is_active BOOLEAN DEFAULT TRUE,
    ha_helper_id TEXT,                      -- Optional: input_boolean Entity-ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(household_id, category_key)
);

-- 2. user_notification_preferences – User-spezifische Aktivierung
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type_id UUID NOT NULL REFERENCES public.notification_types(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, notification_type_id)
);

-- 3. RLS aktivieren
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: notification_types
-- Alle Household-Mitglieder dürfen lesen
CREATE POLICY "notification_types_select_household"
  ON public.notification_types FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

-- Nur Admins dürfen erstellen/bearbeiten/löschen
CREATE POLICY "notification_types_insert_admin"
  ON public.notification_types FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "notification_types_update_admin"
  ON public.notification_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "notification_types_delete_admin"
  ON public.notification_types FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. RLS Policies: user_notification_preferences
-- Jeder darf seine eigenen lesen
CREATE POLICY "user_notif_prefs_select_own"
  ON public.user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Jeder darf seine eigenen erstellen
CREATE POLICY "user_notif_prefs_insert_own"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Jeder darf seine eigenen bearbeiten
CREATE POLICY "user_notif_prefs_update_own"
  ON public.user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Jeder darf seine eigenen löschen
CREATE POLICY "user_notif_prefs_delete_own"
  ON public.user_notification_preferences FOR DELETE
  USING (user_id = auth.uid());

-- 6. Indizes
CREATE INDEX IF NOT EXISTS idx_notification_types_household ON public.notification_types(household_id);
CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON public.user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_type ON public.user_notification_preferences(notification_type_id);

-- 7. Grants
GRANT SELECT ON public.notification_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.notification_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;

-- =============================================================
-- Seed: Bestehende Kategorien als notification_types einfügen
-- (Nur wenn ein Household existiert)
-- =============================================================
-- HINWEIS: Dieses INSERT muss manuell ausgeführt werden, nachdem
-- die Household-ID bekannt ist. Beispiel:
--
INSERT INTO notification_types (household_id, name, description, icon, color, category_key, ha_helper_id) VALUES
  ('<b8765e29-a3fa-4aaf-af55-ef79075de6ee>', 'Türen UG', 'Waschküche & Highlight Türöffnung', 'shield', '#EF4444', 'security_doors_ug', 'input_boolean.notify_stibe_turen_ug'),
  ('<b8765e29-a3fa-4aaf-af55-ef79075de6ee>', 'Türklingel', 'Wenn jemand klingelt', 'bell', '#F59E0B', 'doorbell', 'input_boolean.notify_stibe_doorbell'),
  ('<b8765e29-a3fa-4aaf-af55-ef79075de6ee>', 'Wetterwarnung', 'Sturm, Gewitter, etc.', 'cloud-lightning', '#6366F1', 'weather_warning', 'input_boolean.notify_stibe_weatheralert'),
  ('<b8765e29-a3fa-4aaf-af55-ef79075de6ee>', 'Baby Weint', 'Benachrichtigung bei Schreien', 'baby', '#EC4899', 'baby_cry', 'input_boolean.notify_stibe_baby_cry'),
  ('<b8765e29-a3fa-4aaf-af55-ef79075de6ee>', 'Geburtstage', 'Benachrichtigung bei Geburtstagen', 'calendar', '#A855F7', 'birthday', 'input_boolean.notify_stibe_birthday');
