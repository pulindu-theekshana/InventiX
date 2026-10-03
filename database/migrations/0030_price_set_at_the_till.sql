-- A price typed at the counter
--
-- Purpose : Marks a sale line whose price was not the shop's own. Some products have no price in
--           Stocks and no supplier listing to borrow one from, so the cashier is asked -- and the
--           owner should be able to see which bills that happened on.
-- Spec    : Section 6.6
-- Look here when : The owner's till view flags a bill and it is not clear why.

-- Before this, a product with no price was added to a bill at zero and the till let the sale
-- finish: free goods, and the stock dropped anyway. Asking the cashier is the useful answer at a
-- counter -- a customer is standing there -- and this column is what keeps it honest, because a
-- price a cashier can choose is a price a cashier can choose too low.
alter table pos_sale_items
  add column price_from_till boolean not null default false;

comment on column pos_sale_items.price_from_till is
  'The cashier typed this price because the shop had none. The owner sees it in the till view.';

notify pgrst, 'reload schema';
