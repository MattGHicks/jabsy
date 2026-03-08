-- Create picks table
CREATE TABLE public.picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  fight_id UUID REFERENCES public.fights(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  pick_winner TEXT CHECK (pick_winner IN ('red', 'blue')) NOT NULL,
  pick_method TEXT CHECK (pick_method IN ('decision', 'ko_tko', 'submission')) NOT NULL,
  pick_round INTEGER CHECK (pick_round >= 1 AND pick_round <= 5),
  points_earned INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, league_id, fight_id)
);

CREATE INDEX idx_picks_user ON public.picks(user_id);
CREATE INDEX idx_picks_fight ON public.picks(fight_id);
CREATE INDEX idx_picks_league ON public.picks(league_id);
CREATE INDEX idx_picks_event ON public.picks(event_id);
CREATE INDEX idx_picks_league_event ON public.picks(league_id, event_id);

CREATE TRIGGER picks_updated_at
  BEFORE UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Scoring function (5-3-2 system)
CREATE OR REPLACE FUNCTION public.calculate_pick_points(
  p_pick_winner TEXT,
  p_pick_method TEXT,
  p_pick_round INTEGER,
  p_result_winner TEXT,
  p_result_method TEXT,
  p_result_round INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_points INTEGER := 0;
BEGIN
  -- No result yet or draw/nc
  IF p_result_winner IS NULL OR p_result_winner IN ('draw', 'nc') THEN
    RETURN 0;
  END IF;

  -- Correct winner: 5 pts
  IF p_pick_winner = p_result_winner THEN
    v_points := 5;

    -- Correct method: +3 pts
    IF p_pick_method = p_result_method THEN
      v_points := v_points + 3;

      -- Correct round: +2 pts (only for KO/TKO or Submission)
      IF p_result_method IN ('ko_tko', 'submission')
         AND p_pick_round IS NOT NULL
         AND p_pick_round = p_result_round THEN
        v_points := v_points + 2;
      END IF;
    END IF;
  END IF;

  RETURN v_points;
END;
$$;

-- Function to recalculate all pick points for an event after results are entered
CREATE OR REPLACE FUNCTION public.recalculate_event_picks(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.picks p
  SET points_earned = public.calculate_pick_points(
    p.pick_winner,
    p.pick_method,
    p.pick_round,
    f.result_winner,
    f.result_method,
    f.result_round
  )
  FROM public.fights f
  WHERE p.fight_id = f.id
    AND p.event_id = p_event_id
    AND f.status = 'final';
END;
$$;
