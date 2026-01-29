-- Add conversation_id to chat_messages table for grouping messages into conversations
-- Run this migration in Supabase SQL Editor

-- Add conversation_id column
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Create index for faster conversation lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
ON chat_messages(conversation_id);

-- Create index for conversation + client lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_conversation
ON chat_messages(client_id, conversation_id);

-- Optionally, create a cleanup function to auto-delete old messages
-- This can be run periodically via Supabase Edge Function or cron
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
