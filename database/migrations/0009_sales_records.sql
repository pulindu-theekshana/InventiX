-- sales_records table
--
-- Purpose : Individual sales lines extracted from uploads. The training data for every forecast.
-- Spec    : Section 5.8
-- Look here when : Forecasts have no data.

create table sales_records (
  id                 uuid        primary key default gen_random_uuid(),

  upload_id          uuid        not null references sales_uploads(id) on delete cascade,

  -- Nullable: a row whose product could not be matched to the catalog still has
  -- to be recorded, or the upload's own row count stops adding up.
  stock_item_id      uuid        references stock_items(id) on delete set null,
  catalog_product_id uuid        references product_catalog(id),

  quantity_sold      integer     not null check (quantity_sold >= 0),

  -- Drives demand forecasting later (spec 7.2). Every model in the Reports feed
  -- reads this column.
  sale_date          date        not null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger sales_records_updated_at before update on sales_records
  for each row execute function set_updated_at();

create index sales_records_by_upload on sales_records (upload_id);
create index sales_records_by_product_date on sales_records (catalog_product_id, sale_date);
