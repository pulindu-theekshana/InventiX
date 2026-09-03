# Entity relationships

```
                          product_catalog
                          (the keystone)
                        /        |        \
                       /         |         \
        supplier_listings   stock_items   sales_records
               |                 |              |
               |                 |              |
   profiles ───┤                 ├── stock_adjustments
   (role:      |                 |
    customer   |            pos_product_aliases
    or         |
    supplier)  |
       |       |
       |       |
     orders ───┴── order_items ──► supplier_listings
       |
       ├── supplier_ratings
       |
   notifications ◄── device_tokens
                              (per user)

   seasonal_events   app_config      (standalone reference tables)
   sales_uploads ──► sales_records

   profiles ──► supplier_ranking   (one row per supplier, rewritten daily)
```

## Relationships and why each exists

| From | To | Why |
|---|---|---|
| `stock_items.owner_id` | `profiles.id` | A stock item belongs to one shop. |
| `stock_items.catalog_product_id` | `product_catalog.id` | So a shop's item and a supplier's listing are the *same* product. |
| `stock_items.preferred_supplier_id` | `profiles.id` | The default supplier when generating a restock message. Nullable. |
| `supplier_listings.supplier_id` | `profiles.id` | A listing belongs to one supplier. |
| `supplier_listings.catalog_product_id` | `product_catalog.id` | Same reason as above. |
| `orders.customer_id` / `supplier_id` | `profiles.id` | The two parties. Both are needed for the RLS policy in §15.1. |
| `order_items.order_id` | `orders.id` | One order can restock several products going to the same supplier. |
| `order_items.listing_id` | `supplier_listings.id` | Records exactly what was ordered from whom. |
| `order_items.catalog_product_id` | `product_catalog.id` | Denormalised, so reports do not need a three-table join. |
| `supplier_ratings.order_id` | `orders.id` | One rating per completed order, which is what keeps ratings honest. |
| `sales_records.upload_id` | `sales_uploads.id` | So a bad upload can be found and reversed as a unit. |
| `sales_records.stock_item_id` | `stock_items.id` | Nullable — an unmatched line has no stock item yet. |
| `stock_adjustments.stock_item_id` | `stock_items.id` | Every quantity change, with a reason and a source. |
| `pos_product_aliases.catalog_product_id` | `product_catalog.id` | Maps this shop's POS wording to the canonical product, once. |
| `notifications.related_order_id` / `related_stock_item_id` | `orders.id` / `stock_items.id` | So tapping a notification opens the right screen. |
| `supplier_ranking.supplier_id` | `profiles.id` | The precomputed score, one row per supplier. Not in spec §5 — see `0016`. |

## Two things worth understanding before changing anything

**`order_items.unit_price_at_order` is deliberately a copy.** It duplicates the listing price on
purpose, so that when a supplier changes their price next month, last month's order history does not
silently change with it.

**`stock_items.restock_requested` is a flag, not a status.** It exists so a low item that already
has an open order shows a Requested badge and cannot be ordered twice. It is set when an order is
created and cleared on every terminal state — purchased, rejected and cancelled. If double ordering
ever becomes possible, this flag is the first thing to check.
