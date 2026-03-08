-- Create events table (master events, admin-managed)
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  venue TEXT,
  status TEXT CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')) NOT NULL DEFAULT 'upcoming',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_events_start_time ON public.events(start_time);
CREATE INDEX idx_events_status ON public.events(status);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create fights table
CREATE TABLE public.fights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  bout_order INTEGER NOT NULL DEFAULT 1,
  scheduled_rounds INTEGER NOT NULL DEFAULT 3 CHECK (scheduled_rounds IN (3, 5)),
  weight_class TEXT,
  is_main_event BOOLEAN NOT NULL DEFAULT FALSE,
  -- Red corner
  red_name TEXT NOT NULL,
  red_record TEXT,
  red_avatar_url TEXT,
  -- Blue corner
  blue_name TEXT NOT NULL,
  blue_record TEXT,
  blue_avatar_url TEXT,
  -- Fight status & result
  status TEXT CHECK (status IN ('scheduled', 'live', 'final', 'cancelled', 'no_contest')) NOT NULL DEFAULT 'scheduled',
  result_winner TEXT CHECK (result_winner IN ('red', 'blue', 'draw', 'nc')),
  result_method TEXT CHECK (result_method IN ('decision', 'ko_tko', 'submission', 'dq', 'nc')),
  result_round INTEGER CHECK (result_round >= 1 AND result_round <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_fights_event_id ON public.fights(event_id);
CREATE INDEX idx_fights_bout_order ON public.fights(event_id, bout_order);

CREATE TRIGGER fights_updated_at
  BEFORE UPDATE ON public.fights
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
