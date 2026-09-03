-- supplier_listings table
--
-- Purpose : What each supplier offers, with quantity, price, minimum order and lead time.
-- Spec    : Section 5.3
-- Look here when : A listing field is missing.

create table supplier_listings (
  id                 uuid        primary key default gen_random_uuid(),

  supplier_id        uuid        not null references profiles(id) on delete cascade,
  catalog_product_id uuid        not null references product_catalog(id),

  -- Reduced when an order is confirmed, so a supplier is never shown as holding
  -- stock they have already committed (spec 10.2).
  quantity_available integer     not null check (quantity_available >= 0),
  unit_price         numeric(12,2) not null check (unit_price > 0),
  min_order_quantity integer     not null default 1 check (min_order_quantity > 0),
  lead_time_days     integer     not null check (lead_time_days >= 0),

  -- Spec 10.1: deactivate rather than delete. order_items references listings,
  -- so deleting one would break the history of every order that used it.
  is_active          boolean     not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- One row per catalog product per supplier. Enforced here so a duplicate is
  -- refused by the database rather than by a service check someone might forget.
  constraint one_listing_per_product_per_supplier
    unique (supplier_id, catalog_product_id)
);

create trigger supplier_listings_updated_at before update on supplier_listings
  for each row execute function set_updated_at();

create index supplier_listings_by_supplier on supplier_listings (supplier_id);

-- Product search only ever looks at active listings, so indexing the inactive
-- ones would waste space and slow every write.
create index supplier_listings_by_product on supplier_listings (catalog_product_id)
  where is_active;

-- Only a supplier may own a listing. A foreign key proves the profile exists;
-- it cannot prove which role it has, so that check lives here.
create or replace function assert_supplier(p_id uuid) returns void
language plpgsql as $$
begin
  if (select role from profiles where id = p_id) is distinct from 'supplier' then
    raise exception 'profile % is not a supplier', p_id;
  end if;
end $$;

create or replace function supplier_listings_role_guard() returns trigger
language plpgsql as $$
begin
  perform assert_supplier(new.supplier_id);
  return new;
end $$;

create trigger supplier_listings_role before insert or update on supplier_listings
  for each row execute function supplier_listings_role_guard();
