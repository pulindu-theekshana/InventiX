-- sales and adjustment RLS
--
-- Purpose : sales_uploads, sales_records, stock_adjustments and pos_product_aliases: owning customer only, never visible to a supplier.
-- Spec    : Section 15.1
-- Look here when : A supplier can see a shop's sales history.

-- Four tables in one file because they share one rule and one failure mode. A
-- shop's sales history is the most sensitive data in the system: it reveals
-- turnover, margins and buying patterns. Spec 15.1 says never visible to any
-- supplier, and these four policies are the whole of that guarantee.

alter table sales_uploads       enable row level security;
alter table sales_records       enable row level security;
alter table stock_adjustments   enable row level security;
alter table pos_product_aliases enable row level security;

create policy sales_uploads_own on sales_uploads
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Ownership is reached through the parent rather than duplicated, so there is one
-- definition of "mine" for the whole sales pipeline. A row has exactly one parent
-- -- an upload or a till sale -- and the sales_record_has_its_source constraint
-- in migration 0026 is what guarantees that.
--
-- Both branches are needed. Until migration 0032 this asked about upload_id only,
-- and a till sale has none: the row was written by the service key and could not
-- be read back by the shop that rang it, so every report missed every POS sale
-- without erroring. A nullable foreign key in a policy is a silent deny.
--
-- auth.uid() and not app_shop_id(): a cashier has no reason to read the shop's
-- turnover. Reports are an owner feed, and the till reads pos_sales.
create policy sales_records_own on sales_records
  for all
  using (
    exists (
      select 1 from sales_uploads u
       where u.id = sales_records.upload_id and u.customer_id = auth.uid()
    )
    or exists (
      select 1 from pos_sales s
       where s.id = sales_records.pos_sale_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sales_uploads u
       where u.id = sales_records.upload_id and u.customer_id = auth.uid()
    )
    or exists (
      select 1 from pos_sales s
       where s.id = sales_records.pos_sale_id and s.owner_id = auth.uid()
    )
  );

-- Read-only to the client. Rows are written by apply_stock_adjustment() through
-- the backend, never directly, which is what keeps the audit trail trustworthy.
create policy stock_adjustments_read_own on stock_adjustments
  for select using (exists (
    select 1 from stock_items s
     where s.id = stock_adjustments.stock_item_id and s.owner_id = auth.uid()
  ));

create policy pos_product_aliases_own on pos_product_aliases
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
