-- Link preview metadata for chat messages
CREATE TABLE message_link_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES league_messages(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, url)
);

CREATE INDEX idx_link_previews_message ON message_link_previews (message_id);

ALTER TABLE message_link_previews ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can see the parent message (league member/owner)
CREATE POLICY "League participants can read link previews"
  ON message_link_previews FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_messages lm
      WHERE lm.id = message_link_previews.message_id
      AND (
        EXISTS (SELECT 1 FROM league_members WHERE league_id = lm.league_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM leagues WHERE id = lm.league_id AND owner_id = auth.uid())
      )
    )
  );

-- Insert: only service role (server-side)
-- No insert policy for regular users — server actions use admin client

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_link_previews;
