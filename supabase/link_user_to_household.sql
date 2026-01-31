-- Link user stefan.gross@hotmail.ch to a household
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'stefan.gross@hotmail.ch';
    existing_household_id UUID;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User % not found in auth.users!', user_email;
    END IF;
    
    RAISE NOTICE 'Found user with ID: %', user_uuid;
    
    -- Check if household exists
    SELECT id INTO existing_household_id FROM households LIMIT 1;
    
    -- If no household exists, create one
    IF existing_household_id IS NULL THEN
        INSERT INTO households (id, name)
        VALUES (gen_random_uuid(), 'Haupthaushalt')
        RETURNING id INTO existing_household_id;
        RAISE NOTICE 'Created new household with ID: %', existing_household_id;
    ELSE
        RAISE NOTICE 'Using existing household with ID: %', existing_household_id;
    END IF;
    
    -- Delete any existing family_members entry for this user (clean slate)
    DELETE FROM family_members WHERE user_id = user_uuid;
    
    -- Insert family_members entry (including email)
    INSERT INTO family_members (user_id, household_id, role, email)
    VALUES (user_uuid, existing_household_id, 'admin', user_email);
    
    RAISE NOTICE 'Successfully linked user % to household!', user_email;
END $$;

-- Verify the result
SELECT 
    fm.user_id,
    fm.email,
    fm.household_id,
    fm.role,
    h.name as household_name,
    h.ha_url IS NOT NULL as has_ha_credentials
FROM family_members fm
JOIN households h ON fm.household_id = h.id
WHERE fm.email = 'stefan.gross@hotmail.ch';
