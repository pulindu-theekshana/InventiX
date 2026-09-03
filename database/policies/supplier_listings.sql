-- supplier_listings RLS
--
-- Purpose : Writable by the owning supplier, readable by any authenticated user so customers can search.
-- Spec    : Section 15.1
-- Look here when : A supplier edits another supplier's listing.

alter table supplier_listings enable row level security;

-- Readable by everyone signed in: customers must be able to search listings, and
-- price and availability are what they are comparing. This is public information
-- by design.
create policy supplier_listings_read_all on supplier_listings
  for select using (auth.uid() is not null);

-- Written only by the supplier who owns it. Separate policies per command rather
-- than one "for all", so a bug in one cannot widen the others.
create policy supplier_listings_insert_own on supplier_listings
  for insert with check (supplier_id = auth.uid());

create policy supplier_listings_update_own on supplier_listings
  for update using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

-- No delete policy. Spec 10.1 retires a listing with is_active = false, because
-- order_items references it and deleting would break every order that used it.
