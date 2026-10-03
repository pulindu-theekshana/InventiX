-- A shop can read its own till sales
--
-- Purpose : sales_records_own reached ownership only through upload_id, which a till sale does not have. Every POS row was invisible to the shop that rang it.
-- Spec    : Section 15.1, Section 7
-- Look here when : A report counts uploaded sales but not till sales.

-- Migration 0026 made upload_id nullable so a till sale could be recorded, and
-- added pos_sale_id beside it. It did not revisit the policy, which still asked
-- one question: "is there a sales_upload of mine behind this row?". For a POS row
-- the answer is no, because upload_id is null -- so the row existed, was written
-- by the service key, and could not be read back by its own owner.
--
-- Nothing broke loudly. The till kept working, because a sale is written with the
-- service key and read back from pos_sales, which has its own policy. What broke
-- quietly is every report: they read sales_records through the owner's token, so
-- a shop billing entirely through the till would have been told it had no sales
-- history at all.
--
-- The lesson is the one worth keeping: a nullable foreign key in a policy is a
-- silent deny. `exists (... where u.id = <null>)` is false, not an error.

drop policy if exists sales_records_own on sales_records;

-- One row, two possible parents, and exactly one of them is set -- the
-- sales_record_has_its_source constraint in 0026 guarantees that. So the rule is
-- "whichever parent this row has, it must be mine".
--
-- auth.uid() rather than app_shop_id(): a cashier has no reason to read the
-- shop's whole sales history. Reports are an owner feed (require_customer), and
-- the till reads pos_sales, never this table. Widening it to the shop would hand
-- every counter assistant the turnover figures for nothing in return.
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

-- The lookup the policy now performs on every row read.
create index if not exists sales_records_by_pos_sale on sales_records (pos_sale_id);

-- A report asks for one shop's rows inside a date window, which is the shape
-- every model in spec 7.2 reads as well.
create index if not exists sales_records_by_date on sales_records (sale_date);
