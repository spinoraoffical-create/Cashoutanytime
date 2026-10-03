-- Fix: members (and staff using the customer Messages flow) could not post.
-- The old insert policy required `is_staff = has_permission('support.manage')`,
-- so a staff/admin account posting a member message (is_staff=false) evaluated
-- `false = true` and was blocked. Relax to allow is_staff=false for anyone, and
-- is_staff=true only for users with support.manage (spoofing still blocked).

drop policy if exists "ticket messages participants write" on public.ticket_messages;

create policy "ticket messages participants write" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
    and (is_staff = false or public.has_permission('support.manage'))
  );
