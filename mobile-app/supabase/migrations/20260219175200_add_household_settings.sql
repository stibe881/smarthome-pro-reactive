-- Create shopping_locations table
create table if not exists public.shopping_locations (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for shopping_locations
alter table public.shopping_locations enable row level security;

-- Create policy for shopping_locations (allow all actions for household members)
create policy "Household members can manage shopping locations"
  on public.shopping_locations
  for all
  using (
    exists (
      select 1 from public.family_members
      where family_members.user_id = auth.uid()
      and family_members.household_id = shopping_locations.household_id
    )
  );

-- Create automations_settings table
create table if not exists public.automations_settings (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  entity_id text not null,
  custom_name text,
  is_visible boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(household_id, entity_id)
);

-- Enable RLS for automations_settings
alter table public.automations_settings enable row level security;

-- Create policy for automations_settings (allow all actions for household members)
create policy "Household members can manage automation settings"
  on public.automations_settings
  for all
  using (
    exists (
      select 1 from public.family_members
      where family_members.user_id = auth.uid()
      and family_members.household_id = automations_settings.household_id
    )
  );
