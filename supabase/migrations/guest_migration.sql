-- Migration: Guest Permissions
-- Run this in Supabase SQL Editor

-- 1. Create guest_permissions table
CREATE TABLE IF NOT EXISTS guest_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    entity_ids TEXT[] NOT NULL DEFAULT '{}',
    entity_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(guest_user_id, household_id)
);

-- 2. Enable RLS
ALTER TABLE guest_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Admins of the household can manage all guest permissions
CREATE POLICY "Admins can manage guest permissions" ON guest_permissions
    FOR ALL USING (
        household_id IN (
            SELECT household_id FROM family_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Guests can view their own permissions
CREATE POLICY "Guests can view own permissions" ON guest_permissions
    FOR SELECT USING (guest_user_id = auth.uid());
