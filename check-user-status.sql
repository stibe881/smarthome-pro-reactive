-- CHECKING CURRENT STATE FOR USER aabe0b37-9680-4cc5-9247-386f4265082d
-- (The ID from the logs)

-- 1. Check user in user_roles
SELECT * FROM public.user_roles WHERE user_id = 'aabe0b37-9680-4cc5-9247-386f4265082d';

-- 2. Check user in family_members
SELECT * FROM public.family_members WHERE user_id = 'aabe0b37-9680-4cc5-9247-386f4265082d';

-- 3. Check households
SELECT * FROM public.households;

-- 4. Check if there are any family_members at all
SELECT COUNT(*) FROM public.family_members;
