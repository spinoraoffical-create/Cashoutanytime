-- Enable Supabase Realtime for ticket_messages so the chat UI receives
-- live INSERT events without polling or page refresh.
alter publication supabase_realtime add table public.ticket_messages;
