-- supplier_ratings table
--
-- Purpose : One rating per completed order. The only source of the quality component of ranking.
-- Spec    : Section 5.7
-- Look here when : Ratings are duplicated or missing.

create table supplier_ratings (
  id            uuid        primary key default gen_random_uuid(),

  -- Unique, not just a foreign key: one rating per order. Spec 12.3 makes
  -- ratings per order so a supplier who improves over time is judged fairly.
  order_id      uuid        not null unique references orders(id) on delete cascade,

  customer_id   uuid        not null references profiles(id),
  supplier_id   uuid        not null references profiles(id),

  -- One to five stars, covering goods quality and condition on arrival. This
  -- column is the entire quality component of the ranking, which spec 12.1
  -- weights at 40 percent.
  quality_score integer     not null check (quality_score between 1 and 5),
  comment       text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger supplier_ratings_updated_at before update on supplier_ratings
  for each row execute function set_updated_at();

create index supplier_ratings_by_supplier on supplier_ratings (supplier_id);
