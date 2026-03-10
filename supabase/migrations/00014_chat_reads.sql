-- Track last-read timestamp per user per league chat
CREATE TABLE league_chat_reads (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, league_id)
);

ALTER TABLE league_chat_reads ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update only their own rows
CREATE POLICY "Users can read own chat reads"
  ON league_chat_reads FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat reads"
  ON league_chat_reads FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat reads"
  ON league_chat_reads FOR UPDATE USING (user_id = auth.uid());
