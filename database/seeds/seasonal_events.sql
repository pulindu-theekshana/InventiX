-- Seasonal seed
--
-- Purpose : Awurudu, Christmas, Ramadan and Vesak with lead times, affected categories and expected uplift.
-- Spec    : Section 5.11
-- Look here when : The smart dashboard has nothing to warn about.

-- Dates are for 2026 and must be refreshed each year: Awurudu is fixed, but
-- Ramadan moves about eleven days earlier annually and Vesak follows the lunar
-- calendar. A stale row here means a warning that fires at the wrong time, which
-- is worse than no warning.
--
-- affected_categories is matched against product_catalog.category, so the
-- strings must be exactly the categories used in the catalog seed.

insert into seasonal_events
  (name, event_date, lead_time_months, affected_categories, expected_uplift_pct)
values
  ('Sinhala and Tamil New Year', '2026-04-14', 3,
   array['Rice','Sugar','Dairy','Biscuits','Beverages','Groceries'], 60),

  ('Vesak', '2026-05-01', 2,
   array['Sugar','Dairy','Beverages','Groceries'], 30),

  ('Ramadan', '2026-02-18', 2,
   array['Rice','Sugar','Dairy','Groceries','Beverages'], 45),

  ('Christmas', '2026-12-25', 3,
   array['Biscuits','Dairy','Sugar','Beverages'], 50),

  ('Deepavali', '2026-11-08', 2,
   array['Sugar','Dairy','Groceries'], 35)
on conflict (name, event_date) do nothing;
