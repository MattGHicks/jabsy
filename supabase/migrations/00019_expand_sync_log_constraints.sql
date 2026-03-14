-- Expand api_source to include 'ufc_api' for Tier 2 fallback
ALTER TABLE public.api_sync_log
  DROP CONSTRAINT IF EXISTS api_sync_log_api_source_check;
ALTER TABLE public.api_sync_log
  ADD CONSTRAINT api_sync_log_api_source_check
  CHECK (api_source IN ('espn', 'ufc_api', 'claude'));

-- Expand sync_type to include 'cross_validation'
ALTER TABLE public.api_sync_log
  DROP CONSTRAINT IF EXISTS api_sync_log_sync_type_check;
ALTER TABLE public.api_sync_log
  ADD CONSTRAINT api_sync_log_sync_type_check
  CHECK (sync_type IN (
    'event_import',
    'card_update',
    'live_results',
    'validation',
    'health_check',
    'cross_validation'
  ));
