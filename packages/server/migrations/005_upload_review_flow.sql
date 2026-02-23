-- Add ai_suggestions_enabled to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ai_suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Add user_id, used_system_key, total_tokens to llm_call_logs
ALTER TABLE llm_call_logs
  ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_system_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

-- Index for monthly usage queries
CREATE INDEX IF NOT EXISTS idx_llm_call_logs_user_id_started_at
  ON llm_call_logs (user_id, started_at);

-- Trigger function for profile:updated SSE notifications (user table)
CREATE OR REPLACE FUNCTION notify_profile_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('op_profile_changed', json_build_object('userId', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user table
DROP TRIGGER IF EXISTS user_profile_notify ON "user";
CREATE TRIGGER user_profile_notify
  AFTER UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed();

-- Trigger function for user_api_keys (uses user_id column)
CREATE OR REPLACE FUNCTION notify_profile_changed_api_keys()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('op_profile_changed', json_build_object('userId', NEW.user_id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_api_keys table
DROP TRIGGER IF EXISTS user_api_keys_profile_notify ON user_api_keys;
CREATE TRIGGER user_api_keys_profile_notify
  AFTER UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed_api_keys();
