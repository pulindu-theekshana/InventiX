-- supplier_ratings RLS
--
-- Purpose : Writable only by the rating customer, readable by that customer and the rated supplier. Averages are public.
-- Spec    : Section 15.1
-- Look here when : A supplier edits or deletes a rating.

alter table supplier_ratings enable row level security;

create policy supplier_ratings_read_parties on supplier_ratings
  for select using (customer_id = auth.uid() or supplier_id = auth.uid());

-- Only the customer who placed the order being rated, and only for an order that
-- actually reached purchased. Rating an order that was never completed would
-- corrupt 40 percent of the ranking with opinions about deliveries that did not
-- happen.
create policy supplier_ratings_insert_own on supplier_ratings
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from orders o
       where o.id = supplier_ratings.order_id
         and o.customer_id = auth.uid()
         and o.supplier_id = supplier_ratings.supplier_id
         and o.status = 'purchased'
    )
  );

-- Deliberately no update and no delete policy for anyone, including the customer
-- who wrote it. Spec 10.4: a supplier cannot edit or remove a rating they were
-- given. Ratings are per order (spec 12.3) so a supplier who improves is
-- reflected by later orders, not by rewriting earlier ones.
--
-- Individual ratings are private to the two parties. The public number is the
-- average, which lives in supplier_ranking and is readable by everyone.
