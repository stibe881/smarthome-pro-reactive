-- RPC Function: Check if an email already exists in any household
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION check_email_in_household(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if email exists in family_members
    IF EXISTS (
        SELECT 1 FROM family_members 
        WHERE LOWER(email) = LOWER(p_email)
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check if email exists in pending family_invitations
    IF EXISTS (
        SELECT 1 FROM family_invitations 
        WHERE LOWER(email) = LOWER(p_email) 
        AND status = 'pending'
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Grant execute to anon role so unauthenticated users can check
GRANT EXECUTE ON FUNCTION check_email_in_household(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_email_in_household(TEXT) TO authenticated;

-- RLS Policies: Allow authenticated users to create households
CREATE POLICY "Authenticated users can create households" ON households
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- RLS Policy: Allow authenticated users to insert themselves as family members
CREATE POLICY "Authenticated users can create their own family member entry" ON family_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
