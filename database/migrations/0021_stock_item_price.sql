-- stock_items.unit_price
--
-- Purpose : Lets a shop record what it pays for a product, for products no supplier on InventiX lists yet.
-- Spec    : Section 6.7
-- Look here when : A shop's own price does not save, or adding a product with a price returns 500.

-- Nullable: most products take their price from a supplier listing, and existing
-- rows have no shop price. When set, the Stocks feed shows it ahead of any listing.
alter table stock_items
  add column unit_price numeric(10, 2) check (unit_price >= 0);
