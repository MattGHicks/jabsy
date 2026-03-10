-- League Chat: real-time messaging per league
CREATE TABLE league_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_league_messages_league_created ON league_messages (league_id, created_at DESC);
CREATE INDEX idx_league_messages_user ON league_messages (user_id);

-- RLS
ALTER TABLE league_messages ENABLE ROW LEVEL SECURITY;

-- Read: league owner OR league member
CREATE POLICY "League participants can read messages"
  ON league_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM league_members WHERE league_id = league_messages.league_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM leagues WHERE id = league_messages.league_id AND owner_id = auth.uid())
  );

-- Insert: same check + must be your own message
CREATE POLICY "League participants can send messages"
  ON league_messages FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM league_members WHERE league_id = league_messages.league_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM leagues WHERE id = league_messages.league_id AND owner_id = auth.uid())
    )
  );

-- Delete: only your own messages
CREATE POLICY "Users can delete own messages"
  ON league_messages FOR DELETE USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE league_messages;
