-- stock_adjustments table
--
-- Purpose : The audit trail of every quantity change. Without this a wrong number cannot be explained or reversed.
-- Spec    : Section 5.10
-- Look here when : A quantity is wrong and you need to know why.

-- Spec 5.10 calls this "not optional bookkeeping", and it is right. Any quantity
-- that looks wrong has its whole history here, which tells you which write caused
-- it and therefore which file to open.

create table stock_adjustments (
  id              uuid        primary key default gen_random_uuid(),

  stock_item_id   uuid        not null references stock_items(id) on delete cascade,

  -- Signed. Negative for sales and losses, positive for deliveries.
  change_quantity integer     not null check (change_quantity <> 0),

  -- The resulting quantity, so the history can be read without replaying
  -- arithmetic from the beginning.
  quantity_after  integer     not null check (quantity_after >= 0),

  reason          text        not null
    check (reason in ('sales_upload', 'manual', 'order_received',
                      'damage', 'correction')),

  -- The upload or order that caused it, where there was one.
  source_id       uuid,
  created_by      uuid        not null references profiles(id),

  created_at      timestamptz not null default now()
);

-- No updated_at and no trigger: an audit row is never edited. Correcting a
-- mistake means writing another adjustment, which is the whole point.

create index stock_adjustments_history on stock_adjustments (stock_item_id, created_at desc);
create index stock_adjustments_by_source on stock_adjustments (source_id) where source_id is not null;
