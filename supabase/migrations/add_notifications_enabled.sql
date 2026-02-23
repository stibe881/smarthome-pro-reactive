-- Add notifications_enabled column to family_members
-- Defaults to true (all notifications enabled)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
