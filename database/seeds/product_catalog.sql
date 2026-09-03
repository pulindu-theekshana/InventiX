-- Catalog seed
--
-- Purpose : Common Sri Lankan grocery products so the app is usable on day one. Open decision in section 17.
-- Spec    : Section 17
-- Look here when : The catalog is empty on a fresh install.

-- Required for a fresh install to function at all. An empty catalog means nobody
-- can add a stock item or a listing, so the app is unusable from the first screen.
--
-- Open question Q1 covers who curates this long term. The suggested default is to
-- seed common products and let users submit a request that creates a pending
-- entry, rather than typing free text.
--
-- `category` values here are the ones seasonal_events.affected_categories matches
-- against. Adding a new category means checking that seed too.

insert into product_catalog (name, category, pack_size, unit, is_seasonal) values
  -- Rice
  ('Araliya Keeri Samba Rice',    'Rice',      '5 kg',   'packet', false),
  ('Araliya Basmathi Rice',       'Rice',      '8 kg',   'packet', false),
  ('Nadu Rice',                   'Rice',      '5 kg',   'packet', false),
  ('Red Raw Rice',                'Rice',      '5 kg',   'packet', false),
  ('Samba Rice',                  'Rice',      '25 kg',  'packet', false),

  -- Sugar and sweeteners
  ('White Sugar',                 'Sugar',     '1 kg',   'packet', true),
  ('Brown Sugar',                 'Sugar',     '1 kg',   'packet', true),
  ('Treacle',                     'Sugar',     '750 ml', 'bottle', true),

  -- Dairy
  ('Highland Milk Powder',        'Dairy',     '400 g',  'packet', true),
  ('Anchor Milk Powder',          'Dairy',     '400 g',  'packet', true),
  ('Highland Milk Powder',        'Dairy',     '1 kg',   'packet', true),
  ('Ambewela Fresh Milk',         'Dairy',     '1 L',    'bottle', false),
  ('Highland Butter',             'Dairy',     '227 g',  'packet', true),

  -- Biscuits and confectionery
  ('Maliban Tikiri Mari Biscuits','Biscuits',  '400 g',  'packet', true),
  ('Maliban Lemon Puff Biscuits', 'Biscuits',  '400 g',  'packet', true),
  ('Munchee Marie Biscuits',      'Biscuits',  '400 g',  'packet', true),
  ('Munchee Cream Cracker',       'Biscuits',  '190 g',  'packet', false),

  -- Beverages
  ('Dilmah Pure Green Tea',       'Beverages', '40 g',   'box',    false),
  ('Dilmah Ceylon Black Tea',     'Beverages', '100 g',  'box',    false),
  ('Nescafe Classic',             'Beverages', '50 g',   'bottle', false),
  ('Milo Powder',                 'Beverages', '400 g',  'packet', true),

  -- Staples
  ('Dhal',                        'Groceries', '500 g',  'packet', false),
  ('Dhal',                        'Groceries', '1 kg',   'packet', false),
  ('Chickpeas',                   'Groceries', '500 g',  'packet', true),
  ('Green Gram',                  'Groceries', '500 g',  'packet', true),
  ('Sunflower Cooking Oil',       'Groceries', '1 L',    'bottle', false),
  ('Coconut Oil',                 'Groceries', '750 ml', 'bottle', true),
  ('Wheat Flour',                 'Groceries', '1 kg',   'packet', false),
  ('Table Salt',                  'Groceries', '400 g',  'packet', false),
  ('Chilli Powder',               'Groceries', '100 g',  'packet', true),
  ('Curry Powder',                'Groceries', '100 g',  'packet', true),
  ('Turmeric Powder',             'Groceries', '100 g',  'packet', false),
  ('Papadam',                     'Groceries', '100 g',  'packet', true),

  -- Household
  ('Sunlight Soap',               'Cleaning',  '110 g',  'packet', false),
  ('Vim Dishwash Liquid',         'Cleaning',  '500 ml', 'bottle', false),
  ('Rin Detergent Powder',        'Cleaning',  '1 kg',   'packet', false)
on conflict (name, pack_size) do nothing;
