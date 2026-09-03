-- notifications RLS
--
-- Purpose : Recipient only.
-- Spec    : Section 15.1
-- Look here when : A user sees another user's alerts.

alter table notifications enable row level security;
alter table device_tokens enable row level security;

create policy notifications_read_own on notifications
  for select using (user_id = auth.uid());

-- The only field a user may change is read_at, by opening the notification. The
-- with check keeps the row theirs; the service layer restricts it to that column.
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No insert policy: notifications are created by the backend and by jobs, never
-- by a client. A user who can write their own notifications can fake an order
-- update from a supplier.

create policy device_tokens_own on device_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
