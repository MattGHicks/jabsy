-- Fix content check constraint to allow fight_card messages with NULL content
ALTER TABLE league_messages DROP CONSTRAINT IF EXISTS league_messages_content_check;

ALTER TABLE league_messages ADD CONSTRAINT league_messages_content_check
  CHECK (
    (message_type = 'text' AND char_length(content) >= 1 AND char_length(content) <= 500)
    OR (message_type IN ('image', 'gif', 'fight_card') AND (content IS NULL OR char_length(content) <= 500))
  );
