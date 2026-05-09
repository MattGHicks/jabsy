-- Cached AI-generated matchup preview per fight, populated lazily on first
-- user request and reused for every subsequent open. Cleared when a result
-- is set so the preview never lingers on a finished fight.

ALTER TABLE public.fights
  ADD COLUMN IF NOT EXISTS matchup_preview text,
  ADD COLUMN IF NOT EXISTS matchup_preview_generated_at timestamptz;

COMMENT ON COLUMN public.fights.matchup_preview IS
  'Cached AI-generated 2-3 sentence preview for the matchup. Generated lazily by the picks page info button. Cleared by trigger when result is set.';

-- Clear preview when the fight finishes so we don't show a "preview" for a
-- completed fight. (UI will show recap data instead.)
CREATE OR REPLACE FUNCTION public.clear_matchup_preview_on_result()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('final', 'no_contest') AND OLD.status NOT IN ('final', 'no_contest') THEN
    NEW.matchup_preview := NULL;
    NEW.matchup_preview_generated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fights_clear_matchup_preview ON public.fights;
CREATE TRIGGER fights_clear_matchup_preview
  BEFORE UPDATE ON public.fights
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.clear_matchup_preview_on_result();
