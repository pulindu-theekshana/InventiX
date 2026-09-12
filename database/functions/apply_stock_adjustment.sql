-- Stock adjustment helper
--
-- Purpose : Transactional helper so a quantity change and its audit row can never separate.
-- Spec    : Section 5.10
-- Look here when : A quantity changed without an audit row.

-- Every quantity change in the application goes through this function: manual
-- adjustments, sales uploads and delivery receipts. Nothing else may write
-- stock_items.quantity_on_hand.
--
-- Why a function rather than two queries from Python: between an update and an
-- insert a process can crash, a connection can drop, or a second request can
-- interleave. Any of those leaves a quantity with no explanation, which is the
-- exact situation spec 5.10 exists to prevent. Here it is one statement -- both
-- happen or neither does.

-- Why SECURITY DEFINER.
--
-- policies/sales_data.sql gives stock_adjustments a read policy and no insert
-- policy on purpose: the audit trail is only trustworthy if rows come from here
-- and nowhere else. But the function runs on behalf of the signed-in shop, so
-- without SECURITY DEFINER that same policy refuses the function's own insert,
-- and every quantity change fails -- manual adjustments, sales uploads and
-- delivery receipts alike.
--
-- Running as the owner bypasses row level security, so the ownership check the
-- policy would have made is made here instead. auth.uid() is null when the
-- backend calls with the service key, which is already trusted and unrestricted.

create or replace function apply_stock_adjustment(
  p_stock_item_id uuid,
  p_change        integer,
  p_reason        text,
  p_source_id     uuid,
  p_created_by    uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_after integer;
  v_owner uuid;
begin
  if p_change = 0 then
    raise exception 'adjustment of zero is not a change';
  end if;

  -- Never trust p_created_by for this: under SECURITY DEFINER a caller could
  -- name any shop. The identity comes from the token, as everywhere else.
  select owner_id into v_owner from stock_items where id = p_stock_item_id;

  if v_owner is null then
    raise exception 'stock item % not found', p_stock_item_id;
  end if;

  if auth.uid() is not null and v_owner <> auth.uid() then
    raise exception 'that stock item does not belong to you';
  end if;

  update stock_items
     set quantity_on_hand = quantity_on_hand + p_change,
         last_counted_at  = now()
   where id = p_stock_item_id
  returning quantity_on_hand into v_after;

  if v_after is null then
    raise exception 'stock item % not found', p_stock_item_id;
  end if;

  -- The column check would catch this too, but raising here names the item and
  -- the attempted change, which is what the caller needs to show the user.
  if v_after < 0 then
    raise exception 'quantity for % cannot go below zero (tried %)',
      p_stock_item_id, p_change;
  end if;

  insert into stock_adjustments
    (stock_item_id, change_quantity, quantity_after, reason, source_id, created_by)
  values
    (p_stock_item_id, p_change, v_after, p_reason, p_source_id, p_created_by);

  return v_after;
end $$;
