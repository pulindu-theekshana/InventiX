-- create_order function
--
-- Purpose : Creates an order, its lines, and the restock flags in ONE transaction. Added because spec 6.5 requires all of it to happen together and PostgREST cannot span three writes.
-- Spec    : Section 6.5 and 15.4
-- Look here when : An order exists with no items, or a product can be ordered twice.

-- Why this exists.
--
-- Spec 6.5 lists what must happen when Send is tapped: one orders row, one
-- order_items row per product, and restock_requested set on every stock item.
-- Over three separate calls a crash between them leaves an order with no lines,
-- or lines with no flags -- and the flag is the only thing preventing the same
-- product being ordered twice.
--
-- The backend reaches the database over PostgREST, which has no transaction
-- spanning several requests. So the transaction lives here, the same reasoning
-- that put apply_stock_adjustment in the database.

create or replace function create_order(
  p_customer_id     uuid,
  p_supplier_id     uuid,
  p_channel         text,
  p_message_body    text,
  p_message_edited  boolean,
  p_delivery_date   date,
  p_notes           text,
  p_idempotency_key text,
  -- [{stock_item_id, listing_id, catalog_product_id, quantity, unit_price}]
  p_lines           jsonb
) returns TABLE (order_id uuid, reference text)
language plpgsql
as $$
declare
  v_order_id uuid;
  v_ref      text;
  v_line     jsonb;
begin
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'an order needs at least one product';
  end if;

  insert into orders (customer_id, supplier_id, status, channel, message_body,
                      message_edited, requested_delivery_date, notes, idempotency_key)
  values (p_customer_id, p_supplier_id, 'requested', p_channel, p_message_body,
          coalesce(p_message_edited, false), p_delivery_date, p_notes, p_idempotency_key)
  returning id, reference into v_order_id, v_ref;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into order_items (order_id, stock_item_id, listing_id, catalog_product_id,
                             quantity_requested, unit_price_at_order)
    values (v_order_id,
            (v_line ->> 'stock_item_id')::uuid,
            (v_line ->> 'listing_id')::uuid,
            (v_line ->> 'catalog_product_id')::uuid,
            (v_line ->> 'quantity')::integer,
            (v_line ->> 'unit_price')::numeric);

    -- Spec 6.5 step 13. Scoped to the caller so an order cannot flag another
    -- shop's stock, even if a bad line reached this far.
    update stock_items
       set restock_requested = true
     where id = (v_line ->> 'stock_item_id')::uuid
       and owner_id = p_customer_id;
  end loop;

  return query select v_order_id, v_ref;
end $$;
