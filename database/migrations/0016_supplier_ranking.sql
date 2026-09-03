-- supplier_ranking table
--
-- Purpose : The precomputed ranking score per supplier, rewritten daily by the ranking job. NOT a table in specification section 5 -- added because section 12 needs a score and section 14 says search must not compute it live.
-- Spec    : Section 12 and 14
-- Look here when : Suppliers appear in the wrong order, or every score is null.

-- Why this table exists, since it is not in the specification's schema.
--
-- Spec 12 defines a weighted ranking, and spec 14 requires a daily job that
-- "recomputes supplier ranking scores so search results do not have to compute
-- them live". A score has to be written somewhere, and nothing in section 5
-- holds it. Without this table the choice is to aggregate every order and rating
-- in the system on every supplier search, which is exactly what spec 14 rules out.
--
-- A view was the alternative and was rejected: a view would re-run that
-- aggregate on each read, which is the live computation under a different name.
--
-- It holds only the two context-free components of the formula -- quality rating
-- at 40 percent and measured delivery speed at 30 percent, renormalised to 100.
-- Availability and price depend on what the customer is currently ordering and
-- are applied per query in backend/app/domain/ranking.py.

create table supplier_ranking (
  supplier_id            uuid        primary key
                                     references profiles(id) on delete cascade,

  -- 0-100. Null until the job has run at least once, which is why every query
  -- ordering by it must say "nulls last".
  score                  numeric(5,2),

  average_rating         numeric(3,2),
  rating_count           integer     not null default 0,

  -- Measured from purchased_at - requested_at across completed orders. Never the
  -- supplier's own stated lead_time_days (spec 12.1).
  measured_delivery_days numeric(6,2),
  completed_orders       integer     not null default 0,

  -- Spec 12.2. Below the configured minimum of completed orders a supplier gets
  -- a neutral default rather than zero, and carries the badge that says so.
  -- Scoring a missing rating as zero would rank every new supplier last forever,
  -- so they could never earn the first order that would give them a rating.
  is_new_supplier        boolean     not null default true,

  computed_at            timestamptz not null default now()
);

-- Every product search orders by this.
create index supplier_ranking_score on supplier_ranking (score desc nulls last);
