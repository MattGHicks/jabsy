-- Emoji reactions on chat messages
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES league_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('fire','thumbsup','laugh','skull','trophy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON message_reactions (message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions (user_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can see the parent message (league member/owner)
CREATE POLICY "League participants can read reactions"
  ON message_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_messages lm
      WHERE lm.id = message_reactions.message_id
      AND (
        EXISTS (SELECT 1 FROM league_members WHERE league_id = lm.league_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM leagues WHERE id = lm.league_id AND owner_id = auth.uid())
      )
    )
  );

-- Insert: league participants, own user_id only
CREATE POLICY "League participants can add reactions"
  ON message_reactions FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM league_messages lm
      WHERE lm.id = message_reactions.message_id
      AND (
        EXISTS (SELECT 1 FROM league_members WHERE league_id = lm.league_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM leagues WHERE id = lm.league_id AND owner_id = auth.uid())
      )
    )
  );

-- Delete: own reactions only
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
