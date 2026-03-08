-- Fix RLS recursive policy issue on league_members.
-- The original league_members_select policy had a subquery referencing the same table,
-- causing PostgreSQL to break the recursion when enforced via PostgREST, preventing
-- co-members from being visible to each other.
-- Solution: SECURITY DEFINER function runs without RLS, breaking the recursion safely.

CREATE OR REPLACE FUNCTION public.get_my_league_ids()
RETURNS TABLE(league_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT lm.league_id FROM public.league_members lm WHERE lm.user_id = auth.uid();
$$;

-- league_members
DROP POLICY IF EXISTS "league_members_select" ON public.league_members;
CREATE POLICY "league_members_select"
  ON public.league_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR league_id IN (SELECT league_id FROM public.get_my_league_ids())
    OR league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

-- leagues
DROP POLICY IF EXISTS "leagues_select" ON public.leagues;
CREATE POLICY "leagues_select"
  ON public.leagues FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT league_id FROM public.get_my_league_ids())
  );

-- picks
DROP POLICY IF EXISTS "picks_select" ON public.picks;
CREATE POLICY "picks_select"
  ON public.picks FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      league_id IN (SELECT league_id FROM public.get_my_league_ids())
      AND event_id IN (
        SELECT id FROM public.events WHERE status IN ('live', 'completed')
      )
    )
  );

-- league_events
DROP POLICY IF EXISTS "league_events_select" ON public.league_events;
CREATE POLICY "league_events_select"
  ON public.league_events FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM public.get_my_league_ids())
    OR league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );
