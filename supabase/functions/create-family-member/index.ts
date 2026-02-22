// Edge Function: Create Family Member
// Creates a new user with initial password and adds them to family_members table

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header (the calling user's JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht autorisiert' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's token to check permissions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Server-Konfigurationsfehler',
          details: 'SUPABASE_URL, ANON_KEY oder SERVICE_ROLE_KEY fehlen in den Edge Function Secrets.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get calling user
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !callingUser) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Benutzer nicht gefunden oder Token ungültig: ' + (userError?.message || '') }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if calling user is admin
    const { data: memberData, error: memberFetchError } = await userClient
      .from('family_members')
      .select('role, household_id')
      .eq('user_id', callingUser.id)
      .maybeSingle()

    if (memberFetchError || !memberData || memberData.role !== 'admin') {
      console.log('Member check failed:', { memberData, error: memberFetchError })
      return new Response(
        JSON.stringify({ 
          error: 'Nur Admins können Mitglieder hinzufügen.',
          details: memberFetchError?.message || 'Kein Admin-Eintrag in family_members gefunden. Bitte Datenbank-Status prüfen.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password: initialPassword, role: requestedRole } = await req.json()

    // Validate role (default to 'member')
    const validRoles = ['member', 'guest']
    const role = validRoles.includes(requestedRole) ? requestedRole : 'member'

    if (!email || !initialPassword) {
      return new Response(
        JSON.stringify({ error: 'E-Mail und Passwort erforderlich' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (initialPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Passwort muss mindestens 6 Zeichen haben' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if a user with this email already exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email)

    let userId: string

    if (existingUser) {
      // User already exists - reuse their ID and update password
      userId = existingUser.id
      console.log('User already exists, reusing:', userId)
      await adminClient.auth.admin.updateUserById(userId, {
        password: initialPassword,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: {
          must_change_password: true,
          invited_by: callingUser.id
        }
      })
    } else {
      // Create the new user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          invited_by: callingUser.id
        }
      })

      if (createError) {
        console.error('Create user error:', createError)
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      userId = newUser.user.id
    }

    // Add to family_members table (upsert to handle duplicates)
    const { error: memberError } = await adminClient
      .from('family_members')
      .upsert({
        user_id: userId,
        email: email,
        role: role,
        invited_by: callingUser.id,
        household_id: memberData.household_id
      }, { onConflict: 'user_id' })

    if (memberError) {
      console.error('Add member error:', memberError)
      return new Response(
        JSON.stringify({ error: 'Fehler beim Hinzufügen zur Familie: ' + memberError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set user_roles entry
    const userRoleValue = role === 'guest' ? 'guest' : 'user'
    await adminClient
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: userRoleValue
      }, { onConflict: 'user_id' })

    // If guest, create empty guest_permissions entry
    if (role === 'guest') {
      await adminClient
        .from('guest_permissions')
        .upsert({
          guest_user_id: userId,
          household_id: memberData.household_id,
          entity_ids: [],
          is_active: true
        }, { onConflict: 'guest_user_id,household_id' })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Familienmitglied erstellt',
        userId: userId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: 'Unerwarteter Fehler: ' + errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
