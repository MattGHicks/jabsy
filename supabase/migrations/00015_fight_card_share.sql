-- Add fight_card message type and event_id to league_messages

-- Drop old check constraint and add new one with fight_card
ALTER TABLE league_messages
  DROP CONSTRAINT IF EXISTS league_messages_message_type_check;

ALTER TABLE league_messages
  ADD CONSTRAINT league_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'gif', 'fight_card'));

-- Add event_id for fight_card messages
ALTER TABLE league_messages
  ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX idx_league_messages_event
  ON league_messages (event_id)
  WHERE event_id IS NOT NULL;
