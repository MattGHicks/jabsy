-- Add ESPN sync columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS espn_event_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add ESPN sync columns to fights
ALTER TABLE public.fights
  ADD COLUMN IF NOT EXISTS espn_competition_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'manual' CHECK (sync_status IN ('synced', 'modified', 'manual')),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create sync log table
CREATE TABLE IF NOT EXISTS public.api_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('event_import', 'card_update', 'live_results')),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  api_source TEXT NOT NULL CHECK (api_source IN ('espn', 'claude')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  request_count INTEGER NOT NULL DEFAULT 1,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_type ON public.api_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_event ON public.api_sync_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fights_espn_id ON public.fights(espn_competition_id);

-- RLS for api_sync_log (admin only)
ALTER TABLE public.api_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read sync logs"
  ON public.api_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert sync logs"
  ON public.api_sync_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Allow service role to bypass RLS for cron jobs
-- (service role already bypasses RLS by default in Supabase)
