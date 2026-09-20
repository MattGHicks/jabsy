-- Result verification support.
--
-- 1. fights.result_source records which feed (or person) wrote a result, so
--    the result verifier can correct feed mistakes without ever overwriting a
--    result an admin entered by hand.
ALTER TABLE public.fights
  ADD COLUMN IF NOT EXISTS result_source TEXT;

ALTER TABLE public.fights
  DROP CONSTRAINT IF EXISTS fights_result_source_check;

ALTER TABLE public.fights
  ADD CONSTRAINT fights_result_source_check
  CHECK (result_source IS NULL OR result_source IN ('espn', 'ufc_api', 'claude', 'admin', 'verified'));

-- 2. recalculate_event_picks now also clears points on fights that are no
--    longer final (e.g. a result was cleared), which the old version left
--    stale. It only touches rows whose points actually change, so the verifier
--    can call it freely without firing realtime updates for every pick.
CREATE OR REPLACE FUNCTION public.recalculate_event_picks(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.picks p
  SET points_earned = scored.points
  FROM (
    SELECT p2.id,
      CASE WHEN f.status = 'final' THEN public.calculate_pick_points(
        p2.pick_winner, p2.pick_method, p2.pick_round,
        f.result_winner, f.result_method, f.result_round
      ) END AS points
    FROM public.picks p2
    JOIN public.fights f ON f.id = p2.fight_id
    WHERE p2.event_id = p_event_id
  ) scored
  WHERE p.id = scored.id
    AND p.points_earned IS DISTINCT FROM scored.points;
END;
$$;
