-- product_catalog table
--
-- Purpose : The shared canonical product list. The keystone of the schema: everything else points here instead of storing product names.
-- Spec    : Section 5.2
-- Look here when : Products do not match between a customer and a supplier.

-- This table is the reason the application works at all. If a customer typed
-- "Rice 5kg" and a supplier typed "5kg rice bag", nothing could ever be matched,
-- and product search, supplier ranking and sales-report matching would all fail
-- quietly. Users select from this table; they never type a product name.

create table product_catalog (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  category    text        not null,
  pack_size   text        not null,
  unit        text        not null,
  barcode     text,

  -- Marks products with known festival demand spikes. Spec 6.2 matches this
  -- table's `category` against seasonal_events.affected_categories.
  is_seasonal boolean     not null default false,

  -- Retires an entry without deleting it, because stock items and listings
  -- reference it.
  is_active   boolean     not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- The same product at the same pack size must not appear twice, or the
  -- matching this table exists to guarantee stops being reliable.
  constraint catalog_entry_is_unique unique (name, pack_size)
);

create trigger product_catalog_updated_at before update on product_catalog
  for each row execute function set_updated_at();

-- Every catalog search is a case-insensitive substring match on name.
create index product_catalog_name on product_catalog (lower(name)) where is_active;
create index product_catalog_category on product_catalog (category) where is_active;
