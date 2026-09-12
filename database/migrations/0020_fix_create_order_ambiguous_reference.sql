-- create_order: qualify the returning columns
--
-- Purpose : Replaces create_order from 0017, which failed with "column reference \"reference\" is ambiguous" on every send.
-- Spec    : Section 6.5 and 15.4
-- Look here when : Sending a restock order returns 500 and the log says 42702.

-- What was wrong.
--
-- The function returns TABLE (order_id uuid, reference text), and RETURNS TABLE
-- declares those names as variables inside the body. So in
--
--   returning id, reference into v_order_id, v_ref
--
-- the name `reference` matched both the orders column and the function's own
-- output variable, and PL/pgSQL refuses to guess (error 42702). It cannot be
-- caught before running, because the conflict only exists once the statement is
-- executed -- which is why every send failed while the tests passed.
--
-- Naming the table fixes it without changing the function's signature: the
-- backend still reads order_id and reference from the result.

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
  -- Qualified: unqualified `reference` is ambiguous against the OUT column.
  returning orders.id, orders.reference into v_order_id, v_ref;

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
