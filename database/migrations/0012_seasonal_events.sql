-- seasonal_events table
--
-- Purpose : The festival calendar driving the smart dashboard.
-- Spec    : Section 5.11
-- Look here when : A festival warning appears at the wrong time.

create table seasonal_events (
  id                  uuid        primary key default gen_random_uuid(),

  name                text        not null,

  -- The date for the current year. Awurudu, Ramadan and Vesak move, so this
  -- needs updating annually; it is not a fixed calendar.
  event_date          date        not null,

  -- How far ahead to warn. Spec 5.11 defaults to two to three months.
  lead_time_months    integer     not null default 3 check (lead_time_months > 0),

  -- Matched against product_catalog.category to decide which of a shop's
  -- products appear on the warning card.
  affected_categories text[]      not null,

  -- Rough expected increase, used for the suggested order quantity. Spec 7.2
  -- replaces this estimate with a learned per-shop figure later.
  expected_uplift_pct integer     not null default 0 check (expected_uplift_pct >= 0),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint one_event_per_name_per_year unique (name, event_date)
);

create trigger seasonal_events_updated_at before update on seasonal_events
  for each row execute function set_updated_at();

create index seasonal_events_upcoming on seasonal_events (event_date);
