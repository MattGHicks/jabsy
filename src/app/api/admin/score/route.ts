import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // Verify authenticated admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { eventId } = body

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  // Use admin client to call the RPC function (bypasses RLS)
  const adminClient = createAdminClient()

  const { error } = await adminClient.rpc('recalculate_event_picks', {
    p_event_id: eventId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count updated picks
  const { count } = await adminClient
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .not('points_earned', 'is', null)

  return NextResponse.json({ success: true, updated: count ?? 0 })
}
