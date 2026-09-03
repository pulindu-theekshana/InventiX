-- Ranking recompute
--
-- Purpose : Rewrites supplier_ranking for every supplier. Called daily by jobs/ranking_recalc.py.
-- Spec    : Section 12 and 14
-- Look here when : Ranking recompute is slow.

-- Computes only the two context-free components of the spec 12.1 formula:
-- quality rating (40 percent) and measured delivery speed (30 percent),
-- renormalised to 100. Availability (20) and price (10) depend on what the
-- customer is currently ordering and are applied per query in
-- backend/app/domain/ranking.py.
--
-- Done in SQL rather than Python because it aggregates every order and rating in
-- the system. Pulling that into the application to average it would be slow and
-- pointless.

create or replace function recompute_supplier_ranking() returns integer
language plpgsql
as $$
declare
  v_min_orders  integer := coalesce(
    (select (value #>> '{}')::integer from app_config where key = 'new_supplier_min_orders'), 3);
  v_weight_q    numeric := coalesce(
    (select (value #>> '{}')::numeric from app_config where key = 'ranking_weight_quality'), 40);
  v_weight_d    numeric := coalesce(
    (select (value #>> '{}')::numeric from app_config where key = 'ranking_weight_delivery'), 30);
  v_rows        integer;
begin
  with ratings as (
    select supplier_id,
           avg(quality_score)::numeric(3,2) as avg_score,
           count(*)                          as n
      from supplier_ratings
     group by supplier_id
  ),
  deliveries as (
    -- auto_confirmed orders are excluded: the system closed them because nobody
    -- confirmed, so they say nothing about how fast the supplier actually was.
    select supplier_id,
           avg(extract(epoch from (purchased_at - requested_at)) / 86400)::numeric(6,2) as days,
           count(*) as n
      from orders
     where status = 'purchased' and not auto_confirmed
     group by supplier_id
  ),
  bounds as (
    select min(days) as fastest, max(days) as slowest from deliveries
  ),
  scored as (
    select p.id as supplier_id,
           r.avg_score,
           coalesce(r.n, 0)                                as rating_count,
           d.days                                          as delivery_days,
           coalesce(d.n, 0)                                as completed_orders,
           coalesce(d.n, 0) < v_min_orders                 as is_new,

           -- Quality, 0-1, weighted by how many ratings exist so one five-star
           -- rating does not outrank fifty four-star ones (spec 12.2). New
           -- suppliers get a neutral 0.6, never zero.
           case
             when r.avg_score is null then 0.6
             else ((r.avg_score - 1) / 4.0) * (r.n::numeric / (r.n + 5))
                  + 0.6 * (5.0 / (r.n + 5))
           end as q,

           -- Speed, 0-1, relative to the fastest and slowest measured supplier.
           case
             when d.days is null then 0.6
             when b.slowest = b.fastest then 1.0
             else 1.0 - ((d.days - b.fastest) / (b.slowest - b.fastest))
           end as s
      from profiles p
      left join ratings    r on r.supplier_id = p.id
      left join deliveries d on d.supplier_id = p.id
      cross join bounds b
     where p.role = 'supplier'
  )
  insert into supplier_ranking as sr
    (supplier_id, score, average_rating, rating_count,
     measured_delivery_days, completed_orders, is_new_supplier, computed_at)
  select supplier_id,
         round(((q * v_weight_q + s * v_weight_d) / (v_weight_q + v_weight_d)) * 100, 2),
         avg_score, rating_count, delivery_days, completed_orders, is_new, now()
    from scored
  on conflict (supplier_id) do update
    set score                  = excluded.score,
        average_rating         = excluded.average_rating,
        rating_count           = excluded.rating_count,
        measured_delivery_days = excluded.measured_delivery_days,
        completed_orders       = excluded.completed_orders,
        is_new_supplier        = excluded.is_new_supplier,
        computed_at            = excluded.computed_at;

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
