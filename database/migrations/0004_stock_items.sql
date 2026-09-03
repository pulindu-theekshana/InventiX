-- stock_items table
--
-- Purpose : A customer's own inventory, with quantity, low threshold, preferred supplier and the restock_requested flag.
-- Spec    : Section 5.4
-- Look here when : Low stock or double-ordering behaves wrongly.

create table stock_items (
  id                    uuid        primary key default gen_random_uuid(),

  owner_id              uuid        not null references profiles(id) on delete cascade,
  catalog_product_id    uuid        not null references product_catalog(id),

  -- Only ever changed through apply_stock_adjustment(), so that every movement
  -- leaves an audit row. Nothing else may write this column.
  quantity_on_hand      integer     not null default 0 check (quantity_on_hand >= 0),

  -- Per product, because "low" genuinely differs: ten bags of rice may be low
  -- while two hundred packets of tea is normal (spec 6.7).
  low_threshold         integer     not null default 0 check (low_threshold >= 0),

  preferred_supplier_id uuid        references profiles(id) on delete set null,

  -- True while an open order covers this item. This single flag is what stops
  -- the same product being ordered twice (spec 6.4).
  restock_requested     boolean     not null default false,

  last_counted_at       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint one_stock_row_per_product_per_shop
    unique (owner_id, catalog_product_id)
);

create trigger stock_items_updated_at before update on stock_items
  for each row execute function set_updated_at();

create index stock_items_by_owner on stock_items (owner_id);

-- The Low stock section and the pie chart both filter on exactly this pair.
create index stock_items_low on stock_items (owner_id, restock_requested)
  where quantity_on_hand <= low_threshold;
