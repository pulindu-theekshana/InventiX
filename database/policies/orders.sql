-- orders RLS
--
-- Purpose : Readable only by the customer who placed it and the supplier who received it, and each party may only make their own transitions.
-- Spec    : Section 15.1
-- Look here when : An order is visible to the wrong party.

alter table orders enable row level security;

-- Two parties, one row. Nobody else -- not another supplier, not another shop.
create policy orders_read_parties on orders
  for select using (customer_id = auth.uid() or supplier_id = auth.uid());

-- Only a customer creates an order, and only for themselves.
create policy orders_insert_customer on orders
  for insert with check (customer_id = auth.uid() and auth_role() = 'customer');

-- Both parties may update, because both advance the order. Which transitions
-- each may make is enforced by domain/order_state_machine.py in the backend --
-- RLS decides who may touch the row, not what a legal status change is.
--
-- Writing the state machine here as well would mean the same rule in two places,
-- and spec 11 is explicit that it lives in one.
create policy orders_update_parties on orders
  for update
  using (customer_id = auth.uid() or supplier_id = auth.uid())
  with check (customer_id = auth.uid() or supplier_id = auth.uid());

-- No delete policy. An order is never deleted; it reaches a terminal status and
-- stays there, because the supplier's Orders feed is a permanent business record
-- (spec 10.2).
