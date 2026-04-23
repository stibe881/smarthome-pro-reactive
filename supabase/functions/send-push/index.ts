import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    let title = '', body = '', data: any = {}, category_key = ''
    try {
      const rawBody = await req.text()
      console.log('Raw body:', rawBody)
      const parsed = JSON.parse(rawBody)
      title = parsed.title || ''
      body = parsed.body || parsed.message || ''
      data = parsed.data || {}
      category_key = parsed.category_key || ''
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback: check data.category_key if top-level is empty
    if (!category_key && data && data.category_key) {
      category_key = data.category_key
    }
    // Trim empty category_key
    if (category_key) category_key = category_key.trim()

    // 1. Get all push tokens, joined with family_members for notifications_enabled flag
    const { data: tokenRows, error: tokenError } = await supabase
      .from('push_tokens')
      .select('user_id, token')

    // Fallback: if push_tokens table is empty or errors, try old family_members.push_token
    let allTokens: { user_id: string; token: string }[] = []
    if (tokenError || !tokenRows || tokenRows.length === 0) {
      console.log('push_tokens empty/error, falling back to family_members.push_token')
      const { data: members, error: dbError } = await supabase
        .from('family_members')
        .select('user_id, push_token')
        .not('push_token', 'is', null)
      if (dbError) throw dbError
      allTokens = (members || []).filter(m => m.push_token).map(m => ({ user_id: m.user_id, token: m.push_token! }))
    } else {
      allTokens = tokenRows.filter(t => t.token)
    }

    // Deduplicate tokens
    const seen = new Set<string>()
    allTokens = allTokens.filter(t => {
      if (seen.has(t.token)) return false
      seen.add(t.token)
      return true
    })

    // Filter out users who have disabled all notifications (master switch)
    const { data: memberFlags } = await supabase
      .from('family_members')
      .select('user_id, notifications_enabled')

    if (memberFlags) {
      const disabledUsers = new Set(
        memberFlags.filter(m => m.notifications_enabled === false).map(m => m.user_id)
      )
      if (disabledUsers.size > 0) {
        console.log('Users with notifications disabled:', [...disabledUsers])
        allTokens = allTokens.filter(t => !disabledUsers.has(t.user_id))
      }
    }

    let eligibleTokens = allTokens

    if (eligibleTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. If category_key is provided, filter by user preferences
    let isCritical = false
    let notifSound = 'default'

    if (category_key) {
      console.log('Looking up category_key:', category_key)
      // Look up the notification types matching the category_key 
      // (there might be multiple, e.g., one per household)
      const { data: foundTypes, error: typeError } = await supabase
        .from('notification_types')
        .select('id, is_active, is_critical, sound')
        .ilike('category_key', category_key)
      
      console.log('foundTypes result:', JSON.stringify(foundTypes), 'error:', typeError)

      if (typeError) {
        console.error('Error looking up notification type:', typeError)
      } else if (foundTypes && foundTypes.length > 0) {
        // If at least one matching type is critical, we make the alert critical
        isCritical = foundTypes.some(t => t.is_critical)
        // Grab a sound from the first match
        notifSound = foundTypes[0].sound || 'default'

        // Get the IDs of the active types
        const activeTypeIds = foundTypes.filter(t => t.is_active).map(t => t.id)

        if (activeTypeIds.length === 0) {
          return new Response(
            JSON.stringify({ message: `Notification type '${category_key}' is deactivated for all matching households` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch user preferences for these types
        const { data: prefs, error: prefsError } = await supabase
          .from('user_notification_preferences')
          .select('user_id, enabled')
          .in('notification_type_id', activeTypeIds)

        console.log('User preferences:', JSON.stringify(prefs), 'error:', prefsError)

        if (!prefsError && prefs && prefs.length > 0) {
          const prefMap: Record<string, boolean> = {}
          for (const p of prefs) {
            prefMap[p.user_id] = p.enabled
          }

          console.log('prefMap:', JSON.stringify(prefMap))

          // Filter tokens by user preference (keep if no pref or explicitly enabled)
          eligibleTokens = eligibleTokens.filter(t => {
            const pref = prefMap[t.user_id]
            const keep = pref === undefined || pref === true
            console.log(`User ${t.user_id}: pref=${pref}, keep=${keep}`)
            return keep
          })

          console.log('eligibleTokens after filter:', eligibleTokens.length)
        } else {
          console.log('No preferences found, sending to all users (default enabled)')
        }

        if (eligibleTokens.length === 0) {
          return new Response(
            JSON.stringify({ message: 'All users have disabled this notification category', category_key }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        console.log('category_key not found in DB, sending to all as fallback')
      }
    } else {
      console.log('No category_key provided, sending to all')
    }

    // 3. Prepare & send notifications
    const tokens = eligibleTokens.map(t => t.token)

    // Extract badge from data if provided (HA sends it nested in data)
    const badgeCount = data?.badge ?? null

    const messages = tokens.map(token => ({
      to: token,
      sound: notifSound || undefined,
      title: title || 'Benachrichtigung',
      body: body || '',
      data: { ...(data || {}), ...(category_key ? { category_key } : {}) },
      priority: 'high',
      ...(badgeCount !== null ? { badge: badgeCount } : {}),
      ...(isCritical ? { channelId: 'critical' } : {}),
    }))

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const expoResult = await expoResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        count: tokens.length,
        category_key: category_key || null,
        expo: expoResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
