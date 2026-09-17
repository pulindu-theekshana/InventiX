-- More demo data: catalog products, four suppliers' listings, and a shop's stock
--
-- Purpose : Enough data for a believable demo. Suppliers overlap on popular products, so
--           Suppliers search has several sellers to rank for the same thing, and the shop has
--           a mix of in-stock and low items.
-- Spec    : Section 6.1, 9.1 and 12
-- Look here when : The demo shop looks empty, or a product has only one supplier to compare.
--
-- BEFORE RUNNING
--   1. Register the shop and four supplier accounts in the app (Register, then profile setup).
--   2. Put their emails in the five lines marked EDIT below.
--   3. Paste this whole file into the Supabase SQL editor and run it.
--
-- Safe to run twice: every insert skips rows that already exist. It never changes a quantity or
-- price that is already there. Ratings and delivery times are NOT seeded -- those come from real
-- orders completed in the app, or the ranking would be built on invented history.

create temp table seed_accounts (key text primary key, email text not null, role text not null);

insert into seed_accounts (key, email, role) values
  ('shop', 'SHOP_EMAIL@example.com',       'customer'),   -- EDIT
  ('s1',   'SUPPLIER_1_EMAIL@example.com', 'supplier'),   -- EDIT: cheapest, slowest
  ('s2',   'SUPPLIER_2_EMAIL@example.com', 'supplier'),   -- EDIT: fastest, pricier
  ('s3',   'SUPPLIER_3_EMAIL@example.com', 'supplier'),   -- EDIT: middle of the road
  ('s4',   'SUPPLIER_4_EMAIL@example.com', 'supplier');   -- EDIT: small, few units

-- Stop before inserting anything if an email is wrong or has the wrong role. A silent partial
-- seed is worse than an error: the demo would look fine until someone searched for a supplier.
do $$
declare
  missing text;
begin
  select string_agg(a.email || ' (' || a.role || ')', ', ') into missing
  from seed_accounts a
  left join profiles p on lower(p.email) = lower(a.email) and p.role = a.role
  where p.id is null;

  if missing is not null then
    raise exception 'No finished account for: %. Register it in the app and complete profile setup first.', missing;
  end if;
end $$;


-- 1. Catalog ----------------------------------------------------------------------------------

insert into product_catalog (name, category, pack_size, unit, is_seasonal) values
  ('Munchee Chocolate Cream Biscuits', 'Biscuits',  '200 g',  'packet', true),
  ('Maliban Gold Marie Biscuits',      'Biscuits',  '400 g',  'packet', true),
  ('Ratthi Milk Powder',               'Dairy',     '400 g',  'packet', true),
  ('Astra Margarine',                  'Dairy',     '250 g',  'packet', true),
  ('Elephant House Cream Soda',        'Beverages', '1.5 L',  'bottle', true),
  ('Lipton Ceylonta Tea',              'Beverages', '100 g',  'packet', false),
  ('Prima Kottu Mee',                  'Groceries', '80 g',   'packet', false),
  ('Kist Mixed Fruit Jam',             'Groceries', '510 g',  'bottle', true),
  ('Soya Meat',                        'Groceries', '90 g',   'packet', false),
  ('Kithul Treacle',                   'Sugar',     '350 ml', 'bottle', true),
  ('Lifebuoy Soap',                    'Cleaning',  '100 g',  'packet', false),
  ('Signal Toothpaste',                'Cleaning',  '120 g',  'tube',   false)
on conflict (name, pack_size) do nothing;


-- 2. Supplier listings ------------------------------------------------------------------------
-- Six each. Overlaps, so ranking has something to compare:
--   White Sugar (3), Anchor Milk Powder (3), Keeri Samba (2), Dhal 1 kg (2),
--   Coconut Oil (2), Tikiri Mari (2), Sunlight Soap (2).
-- Prices and lead times differ on purpose: s1 is cheap but slow, s2 fast but dear.

insert into supplier_listings
  (supplier_id, catalog_product_id, quantity_available, unit_price, min_order_quantity, lead_time_days)
select p.id, c.id, v.qty, v.price, v.min_qty, v.lead_days
from (values
  -- key  product                          pack       qty   price    min lead
  ('s1', 'White Sugar',                    '1 kg',    900,  245.00,  10, 5),
  ('s1', 'Anchor Milk Powder',             '400 g',   300,  1080.00, 6,  5),
  ('s1', 'Araliya Keeri Samba Rice',       '5 kg',    200,  1520.00, 4,  6),
  ('s1', 'Dhal',                           '1 kg',    400,  395.00,  10, 5),
  ('s1', 'Coconut Oil',                    '750 ml',  250,  700.00,  6,  6),
  ('s1', 'Maliban Tikiri Mari Biscuits',   '400 g',   350,  355.00,  12, 5),

  ('s2', 'White Sugar',                    '1 kg',    500,  275.00,  5,  1),
  ('s2', 'Anchor Milk Powder',             '400 g',   180,  1150.00, 3,  1),
  ('s2', 'Milo Powder',                    '400 g',   150,  1240.00, 3,  1),
  ('s2', 'Maliban Tikiri Mari Biscuits',   '400 g',   200,  380.00,  6,  1),
  ('s2', 'Munchee Chocolate Cream Biscuits','200 g',  220,  290.00,  6,  2),
  ('s2', 'Dilmah Ceylon Black Tea',        '100 g',   160,  610.00,  4,  1),

  ('s3', 'White Sugar',                    '1 kg',    650,  260.00,  8,  3),
  ('s3', 'Araliya Keeri Samba Rice',       '5 kg',    150,  1580.00, 2,  3),
  ('s3', 'Dhal',                           '1 kg',    300,  410.00,  6,  2),
  ('s3', 'Sunlight Soap',                  '110 g',   800,  118.00,  24, 3),
  ('s3', 'Rin Detergent Powder',           '1 kg',    200,  560.00,  6,  3),
  ('s3', 'Vim Dishwash Liquid',            '500 ml',  180,  470.00,  6,  3),

  ('s4', 'Anchor Milk Powder',             '400 g',   40,   1120.00, 2,  2),
  ('s4', 'Coconut Oil',                    '750 ml',  60,   730.00,  2,  2),
  ('s4', 'Sunlight Soap',                  '110 g',   120,  125.00,  12, 2),
  ('s4', 'Prima Kottu Mee',                '80 g',    300,  135.00,  24, 2),
  ('s4', 'Kist Mixed Fruit Jam',           '510 g',   45,   690.00,  3,  2),
  ('s4', 'Elephant House Cream Soda',      '1.5 L',   90,   420.00,  6,  2)
) as v(key, product, pack, qty, price, min_qty, lead_days)
join seed_accounts a on a.key = v.key
join profiles p on lower(p.email) = lower(a.email) and p.role = 'supplier'
join product_catalog c on c.name = v.product and c.pack_size = v.pack
on conflict (supplier_id, catalog_product_id) do nothing;


-- 3. The shop's stock -------------------------------------------------------------------------
-- Low means quantity at or below the threshold (domain/stock.py is_low). Six low, ten in stock.
-- preferred is the supplier the shop usually buys from; null means it has not picked one yet,
-- which is the case the Suppliers feed is for.

insert into stock_items
  (owner_id, catalog_product_id, quantity_on_hand, low_threshold, preferred_supplier_id, last_counted_at)
select shop.id, c.id, v.qty, v.threshold, pref.id, now()
from (values
  -- product                          pack       qty  threshold  preferred
  -- low stock
  ('White Sugar',                    '1 kg',    6,   15,        's3'),
  ('Anchor Milk Powder',             '400 g',   2,   8,         's2'),
  ('Araliya Keeri Samba Rice',       '5 kg',    3,   6,         's1'),
  ('Sunlight Soap',                  '110 g',   10,  24,        's3'),
  ('Coconut Oil',                    '750 ml',  1,   5,         null),
  ('Maliban Tikiri Mari Biscuits',   '400 g',   4,   10,        's2'),
  -- in stock
  ('Dhal',                           '1 kg',    30,  10,        's1'),
  ('Milo Powder',                    '400 g',   14,  5,         's2'),
  ('Dilmah Ceylon Black Tea',        '100 g',   18,  6,         's2'),
  ('Munchee Chocolate Cream Biscuits','200 g',  25,  8,         null),
  ('Rin Detergent Powder',           '1 kg',    12,  4,         's3'),
  ('Vim Dishwash Liquid',            '500 ml',  9,   3,         's3'),
  ('Prima Kottu Mee',                '80 g',    60,  20,        's4'),
  ('Kist Mixed Fruit Jam',           '510 g',   8,   3,         's4'),
  ('Elephant House Cream Soda',      '1.5 L',   16,  6,         's4'),
  ('Table Salt',                     '400 g',   20,  6,         null)
) as v(product, pack, qty, threshold, preferred)
cross join (
  select p.id from seed_accounts a
  join profiles p on lower(p.email) = lower(a.email) and p.role = 'customer'
  where a.key = 'shop'
) as shop
join product_catalog c on c.name = v.product and c.pack_size = v.pack
left join seed_accounts pa on pa.key = v.preferred
left join profiles pref on lower(pref.email) = lower(pa.email) and pref.role = 'supplier'
on conflict (owner_id, catalog_product_id) do nothing;


-- 4. Refresh the ranking so the new listings show up in Suppliers search straight away ------

select recompute_supplier_ranking();

drop table seed_accounts;

-- What went in, per account. Suppliers should show 6; the shop 16.
select p.business_name, p.role,
       (select count(*) from supplier_listings l where l.supplier_id = p.id) as listings,
       (select count(*) from stock_items s where s.owner_id = p.id)          as stock_items
from profiles p
where p.role = 'supplier' or p.id in (select owner_id from stock_items)
order by p.role, p.business_name;
