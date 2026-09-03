-- order_items RLS
--
-- Purpose : Same visibility as the parent order.
-- Spec    : Section 15.1
-- Look here when : Order lines leak.

alter table order_items enable row level security;

-- Visibility is inherited rather than duplicated. If it were written out again
-- here, a future change to who may see an order would have to be made twice, and
-- the version that was forgotten would be the leak.
create policy order_items_follow_order on order_items
  for select using (exists (
    select 1 from orders o
     where o.id = order_items.order_id
       and (o.customer_id = auth.uid() or o.supplier_id = auth.uid())
  ));

-- Lines are written by the backend as part of creating an order, in the same
-- transaction. A customer may insert them only for an order that is theirs.
create policy order_items_insert_own_order on order_items
  for insert with check (exists (
    select 1 from orders o
     where o.id = order_items.order_id and o.customer_id = auth.uid()
  ));
