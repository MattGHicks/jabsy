-- Allow 'sherdog' as an api_source so the card-sync cron can log the results
-- of its Sherdog link audit (see src/lib/api/sherdog-audit.ts).
ALTER TABLE public.api_sync_log
  DROP CONSTRAINT IF EXISTS api_sync_log_api_source_check;

ALTER TABLE public.api_sync_log
  ADD CONSTRAINT api_sync_log_api_source_check
  CHECK (api_source IN ('espn', 'ufc_api', 'claude', 'sherdog'));
