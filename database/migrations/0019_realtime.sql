-- realtime on live tables
--
-- Purpose : Adds the four tables the app subscribes to into Supabase's realtime publication, so changes reach the app without a refresh.
-- Spec    : Section 3.1
-- Look here when : Data is correct but only appears after pulling to refresh.

-- Why this exists.
--
-- frontend/src/hooks/useRealtime.ts subscribes to these four tables, but Supabase
-- only streams changes for tables that are members of the supabase_realtime
-- publication, and new tables are not added by default. Without this the
-- subscriptions connect, report no error, and never fire -- a supplier confirms
-- an order and the shop's screen does not change until someone refreshes.
--
-- Row level security still applies: a subscriber only receives changes to rows
-- its policies would let it select.

alter publication supabase_realtime
  add table orders, stock_items, notifications, supplier_listings;
