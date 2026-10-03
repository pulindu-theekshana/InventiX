-- Till sales: one row per bill, one row per line, and sales history that is not from a file
--
-- Purpose : Storage for the POS. A bill the cashier finished, the products on it, and the link
--           into sales_records so Reports count till sales the same as uploaded ones.
-- Spec    : Section 6.6 and 7
-- Look here when : A POS sale is not in Reports, or a receipt number cannot be found on a return.

create table pos_sales (
  id              uuid        primary key default gen_random_uuid(),

  owner_id        uuid        not null references profiles(id) on delete cascade,

  -- 'sale' or 'return'. A return carries returns_sale_id and positive quantities; the sign is
  -- applied when stock moves, never stored twice. Keeping both in one table means the day's
  -- takings are one query, not a union.
  kind            text        not null default 'sale'
    check (kind in ('sale', 'return')),
  returns_sale_id uuid        references pos_sales(id),

  -- What the customer reads back on a return: 'T1-000147'. The device prefix is what makes it
  -- unique while a till is offline and cannot ask the server for the next number.
  receipt_no      text        not null,
  device_id       text        not null,

  -- Written by the till, not the server: the laptop knows when the sale happened, and a bill
  -- made offline may arrive hours later.
  sold_at         timestamptz not null,

  payment_method  text        not null default 'cash'
    check (payment_method in ('cash', 'card', 'other')),

  -- Summed from the lines by the backend, stored because a receipt is a record of what was
  -- charged. A later price change must not rewrite a bill that has already been paid.
  total           numeric(12,2) not null check (total >= 0),
  discount        numeric(12,2) not null default 0 check (discount >= 0),

  -- Free text, so the owner can see who was on the till without a cashier account per person.
  cashier_label   text,

  -- The till's own id for this bill. Unique per shop, so a retry after a timeout stores the
  -- sale once -- the same guarantee orders get from idempotency_key.
  client_sale_id  uuid        not null,

  created_at      timestamptz not null default now(),

  constraint pos_sale_receipt_is_unique_per_shop unique (owner_id, receipt_no),
  constraint pos_sale_client_id_is_unique_per_shop unique (owner_id, client_sale_id),
  -- A return must say what it returns; a sale must not.
  constraint pos_return_names_its_sale
    check ((kind = 'return') = (returns_sale_id is not null))
);

create index pos_sales_by_owner_date on pos_sales (owner_id, sold_at desc);

create table pos_sale_items (
  id                 uuid        primary key default gen_random_uuid(),

  sale_id            uuid        not null references pos_sales(id) on delete cascade,

  -- The catalog product is what a line always has. stock_item_id may be null: a till can sell
  -- something the shop never added to Stocks, and refusing the sale over bookkeeping would be
  -- the wrong trade at a counter with a customer waiting.
  catalog_product_id uuid        not null references product_catalog(id),
  stock_item_id      uuid        references stock_items(id) on delete set null,

  -- Numeric, not integer: groceries sell rice and dhal by weight.
  quantity           numeric(10,3) not null check (quantity > 0),
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  line_total         numeric(12,2) not null check (line_total >= 0),

  -- How much of this line has come back, so a second return cannot exceed the first sale.
  returned_quantity  numeric(10,3) not null default 0 check (returned_quantity >= 0),

  created_at         timestamptz not null default now()
);

create index pos_sale_items_by_sale on pos_sale_items (sale_id);

-- sales_records is what Reports read. Until now every row came from an uploaded file, so
-- upload_id was mandatory. A till sale has no file.
alter table sales_records alter column upload_id drop not null;

alter table sales_records
  add column if not exists source text not null default 'upload'
    check (source in ('upload', 'pos')),
  add column if not exists pos_sale_id uuid references pos_sales(id) on delete cascade;

-- Each row must say where it came from, and carry the right link for that source.
alter table sales_records
  drop constraint if exists sales_record_has_its_source;

alter table sales_records
  add constraint sales_record_has_its_source
  check (
    (source = 'upload' and upload_id is not null and pos_sale_id is null) or
    (source = 'pos'    and pos_sale_id is not null and upload_id is null)
  );

alter table pos_sales      enable row level security;
alter table pos_sale_items enable row level security;

-- Read only, and only your own. Writes go through the backend with the service key, the same
-- rule migration 0024 applied to orders, stock and ratings.
create policy pos_sales_read_own on pos_sales
  for select using (owner_id = auth.uid());

create policy pos_sale_items_follow_sale on pos_sale_items
  for select using (exists (
    select 1 from pos_sales s
     where s.id = pos_sale_items.sale_id and s.owner_id = auth.uid()
  ));

notify pgrst, 'reload schema';
