-- job tracking columns on orders
--
-- Purpose : Two timestamps so the scheduled jobs notify once rather than every time they run. NOT columns in specification section 5.5.
-- Spec    : Section 14
-- Look here when : A customer is notified about the same stale order every hour.

-- Why these exist.
--
-- jobs/unanswered_orders.py runs hourly and jobs/auto_confirm.py daily. Both find
-- rows by age, so without a record of having acted they would re-notify on every
-- run -- the same "your order has had no reply" every hour until someone answers.
-- A user who gets that stops reading notifications, which breaks every other
-- notification in spec 13 as well.
--
-- Recording it on the order rather than inferring it from the notifications table
-- keeps the job's query to one table and one index.

alter table orders
  add column unanswered_notified_at timestamptz,
  add column auto_confirm_warned_at timestamptz;

comment on column orders.unanswered_notified_at is
  'Set when jobs/unanswered_orders.py has told both parties. Null means not yet told.';
comment on column orders.auto_confirm_warned_at is
  'Set when jobs/auto_confirm.py has sent the one-day warning. Spec 11.5.';

-- The hourly job looks for exactly this: still requested, and not yet told.
create index orders_unanswered_pending on orders (requested_at)
  where status = 'requested' and unanswered_notified_at is null;
