-- =============================================================
-- Migration: Critical Push & Sound für notification_types
-- =============================================================

ALTER TABLE public.notification_types
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sound TEXT DEFAULT 'default';

-- is_critical = true → iOS Critical Alert (durchbricht Nicht stören)
-- sound = 'default' | 'alarm.wav' | 'doorbell.wav' | 'chime.wav' | null (stumm)
