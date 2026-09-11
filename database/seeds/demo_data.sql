-- Demo data
--
-- Purpose : A demo shop, supplier, listings and orders for the presentation. Never run in production.
-- Spec    : -
-- Look here when : You need a populated app for a demo.

-- ---------------------------------------------------------------------------
-- BEFORE RUNNING THIS
--
-- profiles.id references auth.users(id), so the two accounts must exist as real
-- Supabase auth users first. This file cannot create them: auth users are made
-- through the Supabase Auth API or the dashboard, not by SQL.
--
--   1. Supabase dashboard, Authentication, Add user:
--        wasantha.kade@inventix.lk      becomes the customer
--        demo.supplier@inventix.lk  becomes the supplier
--   2. Copy each new user UUID.
--   3. Replace the two values below.
--   4. Run this file.
--
-- Never run against real data. It writes orders and adjustments that will look
-- like genuine history.
-- ---------------------------------------------------------------------------

do $$
declare
  v_customer uuid := '00000000-0000-0000-0000-000000000001';  -- replace
  v_supplier uuid := '00000000-0000-0000-0000-000000000002';  -- replace

  v_rice    uuid; v_milk    uuid; v_sugar   uuid; v_biscuit uuid;
  v_listing_rice uuid; v_listing_milk uuid;
  v_stock_rice uuid; v_stock_milk uuid; v_stock_sugar uuid; v_stock_biscuit uuid;
  v_order uuid;
begin
  if not exists (select 1 from auth.users where id = v_customer) then
    raise exception 'Create the demo auth users first and set the UUIDs at the top of this file.';
  end if;

  insert into profiles (id, role, business_name, contact_person, phone,
                        whatsapp_number, email, address, city)
  values (v_customer, 'customer', 'Wasantha Kade', 'Mahinda', '077 123 4567',
          '077 123 4567', 'wasantha.kade@inventix.lk', 'No 44, Horowpathana Road', 'Galle')
  on conflict (id) do nothing;

  insert into profiles (id, role, business_name, contact_person, phone,
                        whatsapp_number, email, address, city, delivery_areas)
  values (v_supplier, 'supplier', 'Lanka Traders (pvt) Ltd', 'Nimal Perera',
          '077 234 5678', '077 234 5678', 'demo.supplier@inventix.lk',
          'No 12, Main Street', 'Colombo 11',
          array['Colombo','Gampaha','Kalutara','Galle'])
  on conflict (id) do nothing;

  select id into v_rice    from product_catalog where name = 'Araliya Keeri Samba Rice';
  select id into v_milk    from product_catalog where name = 'Highland Milk Powder' and pack_size = '400 g';
  select id into v_sugar   from product_catalog where name = 'White Sugar';
  select id into v_biscuit from product_catalog where name = 'Maliban Tikiri Mari Biscuits';

  if v_rice is null then
    raise exception 'Run seeds/product_catalog.sql first.';
  end if;

  insert into supplier_listings (supplier_id, catalog_product_id, quantity_available,
                                 unit_price, min_order_quantity, lead_time_days)
  values (v_supplier, v_rice,    240, 1250.00, 10, 2),
         (v_supplier, v_milk,     30, 1180.00, 12, 3),
         (v_supplier, v_sugar,   180,  258.00, 20, 2),
         (v_supplier, v_biscuit,  90,  345.00, 10, 2)
  on conflict (supplier_id, catalog_product_id) do nothing;

  select id into v_listing_rice from supplier_listings
   where supplier_id = v_supplier and catalog_product_id = v_rice;
  select id into v_listing_milk from supplier_listings
   where supplier_id = v_supplier and catalog_product_id = v_milk;

  -- Milk sits below its threshold, so the app opens with something in the Low
  -- stock section and something to demonstrate the restock popup with.
  insert into stock_items (owner_id, catalog_product_id, quantity_on_hand,
                           low_threshold, preferred_supplier_id, last_counted_at)
  values (v_customer, v_rice,    120, 30, v_supplier, now() - interval '2 days'),
         (v_customer, v_milk,     12, 25, v_supplier, now() - interval '2 days'),
         (v_customer, v_sugar,    85, 20, v_supplier, now() - interval '5 days'),
         (v_customer, v_biscuit,  15, 12, v_supplier, now() - interval '5 days')
  on conflict (owner_id, catalog_product_id) do nothing;

  select id into v_stock_rice    from stock_items where owner_id = v_customer and catalog_product_id = v_rice;
  select id into v_stock_milk    from stock_items where owner_id = v_customer and catalog_product_id = v_milk;
  select id into v_stock_sugar   from stock_items where owner_id = v_customer and catalog_product_id = v_sugar;
  select id into v_stock_biscuit from stock_items where owner_id = v_customer and catalog_product_id = v_biscuit;

  -- One completed order, so the supplier has a measured delivery time and the
  -- ranking job has something real to compute from rather than a neutral default.
  insert into orders (customer_id, supplier_id, status, channel, message_body,
                      requested_delivery_date, requested_at, confirmed_at,
                      processing_at, put_to_delivery_at, on_the_way_at,
                      supplier_marked_delivered_at, purchased_at)
  values (v_customer, v_supplier, 'purchased', 'in_app',
          'Hi Lanka Traders, this is a reorder from Wasantha Kade.',
          (now() - interval '10 days')::date,
          now() - interval '17 days', now() - interval '17 days',
          now() - interval '16 days', now() - interval '15 days',
          now() - interval '15 days', now() - interval '14 days',
          now() - interval '14 days')
  returning id into v_order;

  insert into order_items (order_id, stock_item_id, listing_id, catalog_product_id,
                           quantity_requested, unit_price_at_order)
  values (v_order, v_stock_rice, v_listing_rice, v_rice, 40, 1250.00);

  insert into supplier_ratings (order_id, customer_id, supplier_id, quality_score, comment)
  values (v_order, v_customer, v_supplier, 5, 'Arrived early, packaging was good.');

  -- One order still in flight, so the customer Delivery feed and the supplier
  -- working queue both have a card to show.
  insert into orders (customer_id, supplier_id, status, channel, message_body,
                      requested_delivery_date, requested_at, confirmed_at, processing_at)
  values (v_customer, v_supplier, 'processing', 'in_app',
          'Hi Lanka Traders, we are low on Highland Milk Powder 400 g.',
          (now() + interval '4 days')::date,
          now() - interval '3 days', now() - interval '3 days', now() - interval '2 days')
  returning id into v_order;

  insert into order_items (order_id, stock_item_id, listing_id, catalog_product_id,
                           quantity_requested, unit_price_at_order)
  values (v_order, v_stock_milk, v_listing_milk, v_milk, 60, 1180.00);

  -- The flag that stops the milk being ordered a second time while this is open.
  update stock_items set restock_requested = true where id = v_stock_milk;

  -- Movement history, written through the function so the audit trail looks
  -- exactly like real usage rather than hand-inserted rows.
  perform apply_stock_adjustment(v_stock_sugar,   -15, 'sales_upload', null, v_customer);
  perform apply_stock_adjustment(v_stock_biscuit,  -8, 'sales_upload', null, v_customer);
  perform apply_stock_adjustment(v_stock_rice,     -5, 'damage',       null, v_customer);

  perform recompute_supplier_ranking();

  raise notice 'Demo data loaded for customer % and supplier %', v_customer, v_supplier;
end $$;
