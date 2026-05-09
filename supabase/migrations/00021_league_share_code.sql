-- Persistent per-league share code. Unlike the throwaway codes in `invites`,
-- this code is generated once at league creation and never rotates, so the
-- league's share URL stays stable forever. Used by the league page's Share
-- button to produce a one-tap invite link.

-- Generator: random 8-char uppercase alphanumeric (omit O/0/I/1 to reduce ambiguity).
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Add the column nullable first so backfill can populate it before NOT NULL.
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS share_code text;

-- Backfill any existing rows with unique codes. Loop until each gets a unique value
-- (collision is rare with 32^8 = ~1 trillion possibilities).
DO $$
DECLARE
  r record;
  attempts int;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM public.leagues WHERE share_code IS NULL LOOP
    attempts := 0;
    LOOP
      candidate := public.generate_share_code();
      BEGIN
        UPDATE public.leagues SET share_code = candidate WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 5 THEN
          RAISE EXCEPTION 'Failed to generate unique share_code for league %', r.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Now enforce NOT NULL + UNIQUE.
ALTER TABLE public.leagues
  ALTER COLUMN share_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leagues_share_code_key ON public.leagues(share_code);

-- Auto-generate on insert. Tries up to 5 times in case of (extremely unlikely) collision.
CREATE OR REPLACE FUNCTION public.set_league_share_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  attempts int := 0;
  candidate text;
BEGIN
  IF NEW.share_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := public.generate_share_code();
    IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE share_code = candidate) THEN
      NEW.share_code := candidate;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 5 THEN
      RAISE EXCEPTION 'Failed to generate unique share_code after % attempts', attempts;
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS leagues_set_share_code ON public.leagues;
CREATE TRIGGER leagues_set_share_code
  BEFORE INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_share_code();

COMMENT ON COLUMN public.leagues.share_code IS
  'Persistent share code for the league. Used by the league share URL pattern /invite/<share_code>. Auto-generated once at league creation and never rotates.';
