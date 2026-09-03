-- catalog RLS
--
-- Purpose : product_catalog and seasonal_events readable by all authenticated users, writable only by an admin role.
-- Spec    : Section 15.1
-- Look here when : A user edits the shared catalog.

alter table product_catalog  enable row level security;
alter table seasonal_events  enable row level security;
alter table app_config       enable row level security;
alter table supplier_ranking enable row level security;

-- The catalog is shared by everyone and is the thing that makes matching between
-- a customer and a supplier possible at all (spec 5.2). Everyone reads it.
create policy product_catalog_read_all on product_catalog
  for select using (auth.uid() is not null);

create policy seasonal_events_read_all on seasonal_events
  for select using (auth.uid() is not null);

-- Ranking scores are public: they are what a customer sorts suppliers by, and a
-- supplier seeing their own score is expected (spec 12.3).
create policy supplier_ranking_read_all on supplier_ranking
  for select using (auth.uid() is not null);

-- No write policy on any of the four. The catalog, the festival calendar, the
-- tunable config and the computed scores are all maintained by the backend with
-- the service key, which bypasses RLS. A user who could edit the catalog could
-- rename a product out from under every shop and listing that references it.
--
-- app_config has no read policy either: nothing in the app needs to read the
-- ranking weights, and exposing the tuning would tell a supplier how to game it.
