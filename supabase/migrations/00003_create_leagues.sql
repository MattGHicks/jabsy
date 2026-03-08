-- Create leagues table
CREATE TABLE public.leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_leagues_owner ON public.leagues(owner_id);

CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- League members (owner + invited players)
CREATE TABLE public.league_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member')) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(league_id, user_id)
);

CREATE INDEX idx_league_members_user ON public.league_members(user_id);
CREATE INDEX idx_league_members_league ON public.league_members(league_id);

-- League events (which master events are active in a league)
CREATE TABLE public.league_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(league_id, event_id)
);

CREATE INDEX idx_league_events_league ON public.league_events(league_id);
CREATE INDEX idx_league_events_event ON public.league_events(event_id);

-- Invites table
CREATE TABLE public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_invites_code ON public.invites(code);
CREATE INDEX idx_invites_league ON public.invites(league_id);
