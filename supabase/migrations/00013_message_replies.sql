-- Add reply_to_id to league_messages for reply/quote threading
ALTER TABLE league_messages
  ADD COLUMN reply_to_id uuid REFERENCES league_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_league_messages_reply_to
  ON league_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
