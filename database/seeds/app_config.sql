-- Config seed
--
-- Purpose : Starting ranking weights and timeouts from the spec.
-- Spec    : Section 12.1
-- Look here when : Config values are missing on a fresh install.

-- Not an optional extra. A missing row here means the value reads as null and
-- the job that depends on it misbehaves silently.
--
-- Spec 17 leaves all of these open, with these values as the suggested defaults.
-- They are here rather than in Python so they can be tuned after testing without
-- a release (spec 12.1).

insert into app_config (key, value, description) values
  ('ranking_weight_quality',    '40',
   'Percent of the supplier ranking from average rating. Spec 12.1.'),
  ('ranking_weight_delivery',   '30',
   'Percent from measured delivery speed, not the supplier stated lead time.'),
  ('ranking_weight_quantity',   '20',
   'Percent from whether the supplier can meet the requested quantity. Applied per query.'),
  ('ranking_weight_price',      '10',
   'Percent from unit price against other suppliers of the same product. Applied per query.'),

  ('new_supplier_min_orders',   '3',
   'Completed orders below which a supplier scores neutral and shows the New supplier badge. Spec 12.2. Spec 9.2 says one; 12.2 says three and explains why, so three wins.'),

  ('unanswered_order_hours',    '24',
   'Hours before an order still in requested notifies both parties. Spec 14, open question Q2.'),
  ('auto_confirm_days',         '3',
   'Days after the supplier marks delivered before the order closes itself. Spec 11.5, open question Q3.'),
  ('auto_confirm_warning_days', '1',
   'Days before auto confirmation that the customer is warned.'),

  ('stale_upload_days',         '7',
   'Days without a sales report before the owner is reminded stock may be stale. Spec 6.6.'),
  ('rating_prompt_repeats',     '2',
   'How many times the rating prompt is shown before giving up. Spec 12.3, open question Q6.')
on conflict (key) do nothing;
