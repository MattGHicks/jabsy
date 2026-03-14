-- Add UFC CloudFront API identifiers for three-tier live results fallback
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ufc_event_fmid TEXT;

ALTER TABLE public.fights
  ADD COLUMN IF NOT EXISTS ufc_fight_id TEXT;

-- Sparse indexes — only populated for synced events/fights
CREATE INDEX IF NOT EXISTS idx_events_ufc_fmid
  ON public.events(ufc_event_fmid)
  WHERE ufc_event_fmid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fights_ufc_fight_id
  ON public.fights(ufc_fight_id)
  WHERE ufc_fight_id IS NOT NULL;
