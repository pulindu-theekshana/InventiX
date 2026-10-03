-- Cashier accounts: a boundary in the data, not only on the screen
--
-- Purpose : Lets a shop give the person at the counter their own login, tied to the shop. The
--           till then knows who is selling because they signed in, not because a name was
--           tapped on a list.
-- Spec    : Section 6.6
-- Look here when : A cashier cannot sign in, sees nothing at the till, or can reach the owner's
--                  screens.

-- Phase 5 named the cashier with a PIN stored on the shop's record. That is a lock on the
-- screens: the account at the till was still the owner's, so every bill was signed by whoever
-- knew a four digit number. This migration makes the cashier a real account with its own
-- password, which is the only version of "who did this" that survives a dispute.

-- ---------------------------------------------------------------------------
-- A third role, and the shop it belongs to
-- ---------------------------------------------------------------------------
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('customer', 'supplier', 'cashier'));

-- The shop this person works for. Null for everyone else: an owner is their own shop.
-- on delete cascade, because a cashier account has no meaning once the shop is gone.
alter table profiles add column employer_id uuid references profiles(id) on delete cascade;

-- Both directions. A cashier with no employer could see nothing; an owner with one would be
-- reading someone else's shop.
alter table profiles add constraint cashier_has_employer
  check ((role = 'cashier') = (employer_id is not null));

create index profiles_cashiers_of on profiles (employer_id) where role = 'cashier';

-- ---------------------------------------------------------------------------
-- The shop the caller is acting for
-- ---------------------------------------------------------------------------
-- Every policy below used to read `owner_id = auth.uid()`, which is exactly right while the
-- only person signing in is the owner. A cashier is a different user id acting on the same
-- shop's rows, so the question becomes "whose shop is this caller in", asked in one place.
--
-- security definer for the same reason auth_role() needs it: this reads profiles, and the
-- caller's own policy on profiles would otherwise apply inside the check.
create or replace function app_shop_id() returns uuid
language sql stable security definer set search_path = public
as $$ select coalesce(employer_id, id) from profiles where id = auth.uid() $$;

-- Added alongside the owner policies rather than replacing them: policies are OR'd, so the
-- owner's path is untouched and a bug here cannot lock a shop out of its own data.
-- Reads only. Every write still goes through the backend with the service key.
create policy stock_items_till_read on stock_items
  for select using (owner_id = app_shop_id());

create policy pos_sales_till_read on pos_sales
  for select using (owner_id = app_shop_id());

create policy pos_sale_items_till_read on pos_sale_items
  for select using (exists (
    select 1 from pos_sales s
     where s.id = pos_sale_items.sale_id and s.owner_id = app_shop_id()
  ));

-- The limits, and the owner's PIN hash for approving a discount above them while offline.
create policy pos_settings_till_read on pos_settings
  for select using (owner_id = app_shop_id());

-- A cashier reads the shop's profile so the till can show the shop's name.
create policy profiles_read_employer on profiles
  for select using (id = app_shop_id());

-- ---------------------------------------------------------------------------
-- Who rang the bill
-- ---------------------------------------------------------------------------
-- cashier_label is what the till sent. This is who was signed in, stamped by the backend from
-- the token, so it cannot be typed. The label stays for bills taken before this migration and
-- for a shop that sells under the owner's own login.
alter table pos_sales add column cashier_id uuid references profiles(id) on delete set null;

create index pos_sales_by_cashier on pos_sales (owner_id, cashier_id, sold_at desc);

-- ---------------------------------------------------------------------------
-- Stock movement, for a caller who is not the owner
-- ---------------------------------------------------------------------------
-- Unchanged except for the ownership check: a cashier's sale moves the shop's stock, and
-- auth.uid() is no longer the owner of the row. Same function otherwise.
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

  select owner_id into v_owner from stock_items where id = p_stock_item_id;

  if v_owner is null then
    raise exception 'stock item % not found', p_stock_item_id;
  end if;

  -- Was auth.uid(). A cashier is a different user acting on their shop's stock; anyone else
  -- is still refused. Null means the backend's service key, which is already trusted.
  if auth.uid() is not null and v_owner <> app_shop_id() then
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

notify pgrst, 'reload schema';
