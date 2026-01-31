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

    // 1. Get all push tokens
    const { data: members, error: dbError } = await supabase
      .from('family_members')
      .select('push_token')
      .not('push_token', 'is', null)

    if (dbError) throw dbError

    const tokens = members.map(m => m.push_token).filter(t => t)
    
    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Prepare Notification
    const { title, body, data } = await req.json()

    // 3. Send to Expo
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title || 'Es hat geklingelt!',
      body: body || 'Jemand steht vor der Tür',
      data: data || { screen: 'doorbell' },
      priority: 'high',
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
      JSON.stringify({ success: true, count: tokens.length, expo: expoResult }),
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
