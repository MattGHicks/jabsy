-- Expand api_sync_log status to include 'warning'
ALTER TABLE public.api_sync_log
  DROP CONSTRAINT IF EXISTS api_sync_log_status_check;
ALTER TABLE public.api_sync_log
  ADD CONSTRAINT api_sync_log_status_check
  CHECK (status IN ('success', 'error', 'partial', 'warning'));

-- Expand sync_type to include 'validation' and 'health_check'
ALTER TABLE public.api_sync_log
  DROP CONSTRAINT IF EXISTS api_sync_log_sync_type_check;
ALTER TABLE public.api_sync_log
  ADD CONSTRAINT api_sync_log_sync_type_check
  CHECK (sync_type IN ('event_import', 'card_update', 'live_results', 'validation', 'health_check'));

-- ESPN health tracking table
CREATE TABLE IF NOT EXISTS public.espn_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  consecutive_failures INTEGER DEFAULT 0 NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(endpoint)
);

ALTER TABLE public.espn_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read espn_health"
  ON public.espn_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Index for querying recent warnings/errors in admin dashboard
CREATE INDEX IF NOT EXISTS idx_sync_log_status_created
  ON public.api_sync_log(status, created_at DESC);
