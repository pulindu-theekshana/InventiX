-- stock_items RLS
--
-- Purpose : Owning customer only. No supplier may ever read a stock item.
-- Spec    : Section 15.1
-- Look here when : A supplier can see shop stock levels.

alter table stock_items enable row level security;

-- The simplest and most important policy in the schema. Spec 10.4 forbids a
-- supplier seeing a customer's stock levels, and this single condition is what
-- enforces it -- for reads that go straight from the app to Supabase as well as
-- for anything the backend does on the caller's behalf.
create policy stock_items_own on stock_items
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
