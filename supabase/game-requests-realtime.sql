-- Enable realtime popups for game account requests (admin + user).
-- Run in Supabase SQL Editor once.

ALTER TABLE game_requests REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE game_requests;
