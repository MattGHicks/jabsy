import { createAdminClient } from '@/lib/supabase/admin'

const FAILURE_THRESHOLD = 5

/**
 * Record a successful ESPN API call for an endpoint.
 * Resets the consecutive failure counter.
 */
export async function recordSuccess(endpoint: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('espn_health').upsert(
    {
      endpoint,
      consecutive_failures: 0,
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )
}

/**
 * Record a failed ESPN API call for an endpoint.
 * Increments the consecutive failure counter and logs a critical warning
 * to api_sync_log when the threshold is exceeded.
 */
export async function recordFailure(endpoint: string, error: string): Promise<void> {
  const admin = createAdminClient()

  // Get current count
  const { data: existing } = await admin
    .from('espn_health')
    .select('consecutive_failures')
    .eq('endpoint', endpoint)
    .single()

  const newCount = (existing?.consecutive_failures ?? 0) + 1

  await admin.from('espn_health').upsert(
    {
      endpoint,
      consecutive_failures: newCount,
      last_failure_at: new Date().toISOString(),
      last_error: error.slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  // Log critical warning if threshold exceeded
  if (newCount >= FAILURE_THRESHOLD && newCount % FAILURE_THRESHOLD === 0) {
    await admin.from('api_sync_log').insert({
      sync_type: 'health_check',
      api_source: 'espn',
      status: 'error',
      request_count: 0,
      details: {
        type: 'consecutive_failures',
        endpoint,
        count: newCount,
        last_error: error.slice(0, 500),
      },
    })
  }
}

/**
 * Get the health status of all tracked ESPN endpoints.
 */
export async function getHealthStatus(): Promise<
  {
    endpoint: string
    consecutive_failures: number
    last_success_at: string | null
    last_failure_at: string | null
    last_error: string | null
  }[]
> {
  const admin = createAdminClient()
  const { data } = await admin.from('espn_health').select('*')
  return (data ?? []).map(d => ({
    endpoint: d.endpoint,
    consecutive_failures: d.consecutive_failures,
    last_success_at: d.last_success_at,
    last_failure_at: d.last_failure_at,
    last_error: d.last_error,
  }))
}
