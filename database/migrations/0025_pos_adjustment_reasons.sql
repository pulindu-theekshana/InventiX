-- Two more reasons a quantity can change: a sale at the till, and a return
--
-- Purpose : Lets the POS record sales and returns through apply_stock_adjustment, like every
--           other quantity change.
-- Spec    : Section 5.10 and 6.6
-- Look here when : A POS sale fails with a check constraint violation on stock_adjustments.

-- stock_adjustments.reason is a closed list on purpose: every number in the app can be traced
-- to one of a known set of causes. A sale from the till is a new cause, so it is added here
-- rather than reusing 'manual', which would make a cashier's sale indistinguishable from the
-- owner correcting a miscount.
--
-- 'pos_sale' is always negative, 'return' always positive. That is not enforced in the
-- constraint: a check across two columns would also have to allow the uploads path, and the
-- rule lives in domain/pos.py where it can explain itself.

alter table stock_adjustments
  drop constraint if exists stock_adjustments_reason_check;

alter table stock_adjustments
  add constraint stock_adjustments_reason_check
  check (reason in ('sales_upload', 'manual', 'order_received',
                    'damage', 'correction', 'pos_sale', 'return'));

notify pgrst, 'reload schema';
