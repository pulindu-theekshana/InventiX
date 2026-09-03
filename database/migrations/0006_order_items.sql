-- order_items table
--
-- Purpose : The products inside an order, with the price captured at order time.
-- Spec    : Section 5.6
-- Look here when : An order total is wrong after a price change.

-- This table exists because one order can cover several low-stock products
-- going to the same supplier (spec 6.4).

create table order_items (
  id                  uuid          primary key default gen_random_uuid(),

  order_id            uuid          not null references orders(id) on delete cascade,
  stock_item_id       uuid          not null references stock_items(id),
  listing_id          uuid          not null references supplier_listings(id),

  -- Denormalised from the listing so reporting can group by product without a
  -- second join through supplier_listings.
  catalog_product_id  uuid          not null references product_catalog(id),

  quantity_requested  integer       not null check (quantity_requested > 0),

  -- Captured at order time. Without this a supplier raising their price would
  -- silently rewrite the value of every historical order, and "total spend by
  -- supplier" in spec 7.1 would become fiction.
  unit_price_at_order numeric(12,2) not null check (unit_price_at_order > 0),

  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),

  constraint one_line_per_product_per_order unique (order_id, catalog_product_id)
);

create trigger order_items_updated_at before update on order_items
  for each row execute function set_updated_at();

create index order_items_by_order on order_items (order_id);
create index order_items_by_product on order_items (catalog_product_id);
