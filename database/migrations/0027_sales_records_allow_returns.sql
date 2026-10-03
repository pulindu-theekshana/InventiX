-- Sales history can hold a return
--
-- Purpose : Lets Reports count net sales instead of gross, by storing a return as a negative row.
-- Spec    : Section 7
-- Look here when : Sales figures look too high, or a return fails with a check constraint error.

-- quantity_sold was "0 or more", which left a return nowhere to go: stock came back and the day
-- close showed it, but the shop's own sales history still counted the goods as sold. Every total
-- built on this table would have been overstated, including the forecasting in spec 7.2.
--
-- The sign is the record: a sale is positive, a return is negative, and summing the column gives
-- what the shop actually sold. Zero is still refused -- a row that changes nothing is a mistake,
-- not a fact.

alter table sales_records
  drop constraint if exists sales_records_quantity_sold_check;

alter table sales_records
  add constraint sales_records_quantity_sold_check
  check (quantity_sold <> 0);

notify pgrst, 'reload schema';
