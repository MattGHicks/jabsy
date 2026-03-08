-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES
-- ==========================================
-- All authenticated users can read profiles (needed for leaderboards, member lists)
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ==========================================
-- EVENTS (master events, admin-managed)
-- ==========================================
CREATE POLICY "events_select"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "events_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==========================================
-- FIGHTS
-- ==========================================
CREATE POLICY "fights_select"
  ON public.fights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fights_insert"
  ON public.fights FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "fights_update"
  ON public.fights FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "fights_delete"
  ON public.fights FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==========================================
-- LEAGUES
-- Key: leagues SELECT references league_members, not the other way around.
-- league_members SELECT only self-references → no circular dependency.
-- ==========================================
CREATE POLICY "leagues_select"
  ON public.leagues FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT league_id FROM public.league_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "leagues_insert"
  ON public.leagues FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "leagues_update"
  ON public.leagues FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "leagues_delete"
  ON public.leagues FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ==========================================
-- LEAGUE MEMBERS
-- Only self-joins — no reference to leagues table to avoid recursion.
-- ==========================================
CREATE POLICY "league_members_select"
  ON public.league_members FOR SELECT
  TO authenticated
  USING (
    -- Can see own memberships
    user_id = auth.uid()
    -- Can see co-members in leagues you belong to (self-join on league_members)
    OR league_id IN (
      SELECT league_id FROM public.league_members lm2 WHERE lm2.user_id = auth.uid()
    )
  );

CREATE POLICY "league_members_insert"
  ON public.league_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "league_members_delete"
  ON public.league_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- League owners can remove members
CREATE POLICY "league_members_owner_delete"
  ON public.league_members FOR DELETE
  TO authenticated
  USING (
    league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

-- ==========================================
-- LEAGUE EVENTS
-- ==========================================
CREATE POLICY "league_events_select"
  ON public.league_events FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    OR league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

CREATE POLICY "league_events_insert"
  ON public.league_events FOR INSERT
  TO authenticated
  WITH CHECK (
    league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

CREATE POLICY "league_events_delete"
  ON public.league_events FOR DELETE
  TO authenticated
  USING (
    league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

-- ==========================================
-- INVITES
-- ==========================================
-- Public read so anyone with code can check before logging in
CREATE POLICY "invites_select"
  ON public.invites FOR SELECT
  USING (true);

CREATE POLICY "invites_insert"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND league_id IN (SELECT id FROM public.leagues WHERE owner_id = auth.uid())
  );

CREATE POLICY "invites_update"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "invites_delete"
  ON public.invites FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ==========================================
-- PICKS
-- ==========================================
CREATE POLICY "picks_select"
  ON public.picks FOR SELECT
  TO authenticated
  USING (
    -- Always see your own picks
    user_id = auth.uid()
    -- See others' picks only when event is live or completed
    OR (
      league_id IN (
        SELECT league_id FROM public.league_members WHERE user_id = auth.uid()
      )
      AND event_id IN (
        SELECT id FROM public.events WHERE status IN ('live', 'completed')
      )
    )
  );

-- Only allowed when event is 'upcoming' (picks lock when event goes live)
CREATE POLICY "picks_insert"
  ON public.picks FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND event_id IN (
      SELECT id FROM public.events WHERE status = 'upcoming'
    )
    AND league_id IN (
      SELECT league_id FROM public.league_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.leagues WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "picks_update"
  ON public.picks FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND event_id IN (
      SELECT id FROM public.events WHERE status = 'upcoming'
    )
  );

CREATE POLICY "picks_delete"
  ON public.picks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
