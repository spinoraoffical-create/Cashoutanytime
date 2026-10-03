-- Extend game_server_configs with outbound API credentials for automated provisioning.
-- api_username / api_password are the store owner's agent portal login.
-- api_session / api_session_expires_at cache the auth token to avoid re-login on every call.
alter table public.game_server_configs
  add column if not exists api_username          text,
  add column if not exists api_password          text,
  add column if not exists api_session           text,
  add column if not exists api_session_expires_at timestamptz;
