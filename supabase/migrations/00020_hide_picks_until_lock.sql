-- Add a per-league setting that hides other players' picks from the board
-- until the event's lock_time passes. Users always see their own picks.
-- Default is false to preserve current behavior for existing leagues.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS hide_picks_until_lock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leagues.hide_picks_until_lock IS
  'When true, members can only see their own picks on the board until lock_time passes.';
