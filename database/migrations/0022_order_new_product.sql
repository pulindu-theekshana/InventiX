-- order_items.stock_item_id: nullable for a product the shop does not stock yet
--
-- Purpose : Lets a customer order a product that has never been in their shop, found through the Suppliers feed.
-- Spec    : Section 6.5 and 9.1
-- Look here when : Ordering a new product returns 500 with a not-null violation on stock_item_id.

-- A new product has no stock_items row to point at. The row is created when the
-- customer confirms receipt (domain/stock.py receive()), so the product only
-- appears in the Stocks feed once it has actually arrived. Until then the line is
-- identified by catalog_product_id, which order_items already carries.
--
-- create_order() needs no change: its restock_requested update matches no row
-- when stock_item_id is null.

alter table order_items alter column stock_item_id drop not null;
