-- Migration: Create households table and add Home Assistant credentials
-- Run this in your Supabase SQL Editor

-- Create households table if it doesn't exist
CREATE TABLE IF NOT EXISTS households (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Mein Zuhause',
    address TEXT,
    ha_url TEXT,
    ha_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create family_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS family_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create family_invitations table if it doesn't exist  
CREATE TABLE IF NOT EXISTS family_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for households
CREATE POLICY "Users can view their household" ON households
    FOR SELECT USING (
        id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their household" ON households
    FOR UPDATE USING (
        id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
    );

-- RLS Policies for family_members
CREATE POLICY "Users can view members of their household" ON family_members
    FOR SELECT USING (
        household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
    );

-- RLS Policies for family_invitations
CREATE POLICY "Users can view invitations for their household" ON family_invitations
    FOR SELECT USING (
        household_id IN (SELECT household_id FROM family_members WHERE user_id = auth.uid())
    );

-- Create a default household for existing users (optional)
-- INSERT INTO households (name) VALUES ('Mein Zuhause') ON CONFLICT DO NOTHING;
