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

-- Ownership is reached through the parent upload rather than duplicated, so
-- there is one definition of "mine" for the whole upload pipeline.
create policy sales_records_own on sales_records
  for all
  using (exists (
    select 1 from sales_uploads u
     where u.id = sales_records.upload_id and u.customer_id = auth.uid()
  ))
  with check (exists (
    select 1 from sales_uploads u
     where u.id = sales_records.upload_id and u.customer_id = auth.uid()
  ));

-- Read-only to the client. Rows are written by apply_stock_adjustment() through
-- the backend, never directly, which is what keeps the audit trail trustworthy.
create policy stock_adjustments_read_own on stock_adjustments
  for select using (exists (
    select 1 from stock_items s
     where s.id = stock_adjustments.stock_item_id and s.owner_id = auth.uid()
  ));

create policy pos_product_aliases_own on pos_product_aliases
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
