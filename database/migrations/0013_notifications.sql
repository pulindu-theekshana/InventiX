-- notifications table
--
-- Purpose : Notification history so alerts can be reviewed in the app.
-- Spec    : Section 5.12
-- Look here when : A notification is missing from the list.

create table notifications (
  id                    uuid        primary key default gen_random_uuid(),

  user_id               uuid        not null references profiles(id) on delete cascade,

  -- The trigger that produced it. Spec 13 lists the full set for both roles.
  type                  text        not null,
  title                 text        not null,
  body                  text        not null,

  -- Both nullable, and both are what let a tap open the right screen. A stage
  -- change carries an order; a low-stock warning carries a stock item.
  related_order_id      uuid        references orders(id) on delete cascade,
  related_stock_item_id uuid        references stock_items(id) on delete cascade,

  read_at               timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

-- The list is always "mine, newest first", and the badge counts unread only.
create index notifications_feed on notifications (user_id, created_at desc);
create index notifications_unread on notifications (user_id) where read_at is null;
