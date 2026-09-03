# Bug location map

**Start every debugging session in this document.** Find the symptom, open the file it names.

Regenerate this file whenever a file is added or a rule moves. It is derived from the header
block at the top of every source file, so the two can never disagree if you keep both current.

## Part 1 — Symptom to file

| When this happens | Open this file |
|---|---|
| A background job never runs, or runs at the wrong time. | `backend/app/jobs/scheduler.py` |
| A badge colour is wrong. | `frontend/src/components/ui/Badge.tsx` |
| A card shows a wrong or missing field. | `frontend/src/components/OrderCard.tsx` |
| A card shows the wrong products or timing. | `frontend/src/components/SeasonalCard.tsx` |
| A channel is offered when it should not be. | `frontend/src/constants/channels.ts` |
| A chart on the phone cannot read the report data. | `backend/app/feeds/customer/reports/schemas.py` |
| A colour is inconsistent with the brand guide. | `frontend/src/theme/colors.ts` |
| A customer taps Send once but two orders appear. | `backend/app/core/idempotency.py` |
| A delivery endpoint fails or an action button does nothing. | `backend/app/feeds/customer/delivery/routes.py` |
| A dialog behaves oddly. | `frontend/src/components/ui/Modal.tsx` |
| A duplicate upload is not rejected. | `database/migrations/0008_sales_uploads.sql` |
| A festival card appears too early, too late, or not at all. | `backend/app/domain/seasonal.py` |
| A festival notification never arrives. | `backend/app/jobs/seasonal_warnings.py` |
| A festival warning appears at the wrong time. | `database/migrations/0012_seasonal_events.sql` |
| A field name mismatch between app and database. | `frontend/src/types/database.ts` |
| A forecast is implausible. | `backend/app/ml/forecast.py` |
| A listing endpoint fails. | `backend/app/feeds/supplier/listings/routes.py` |
| A listing field is missing in the app. | `backend/app/feeds/supplier/listings/schemas.py` |
| A listing field is missing. | `database/migrations/0003_supplier_listings.sql` |
| A live update does not arrive. | `frontend/src/hooks/useRealtime.ts` |
| A mapped product is unmatched again. | `database/migrations/0010_pos_product_aliases.sql` |
| A menu item is missing. | `frontend/app/settings/index.tsx` |
| A new user sees a blank screen with no guidance. | `frontend/src/components/EmptyState.tsx` |
| A notification arrives on the phone but not in the list, or the reverse. | `backend/app/feeds/shared/notifications/service.py` |
| A notification is missing from the list. | `database/migrations/0013_notifications.sql` |
| A notification opens the wrong screen. | `frontend/app/notifications.tsx` |
| A previously mapped product is asked about again. | `frontend/app/(customer)/stocks/upload/unmatched.tsx` |
| A price or date renders differently on two screens. | `frontend/src/lib/format.ts` |
| A product cannot be found, or a duplicate catalog entry appears. | `backend/app/feeds/shared/catalog/service.py` |
| A product that was mapped before is unmatched again. | `backend/app/feeds/customer/uploads/mapping.py` |
| A profile field is missing. | `frontend/app/(customer)/suppliers/[id].tsx` |
| A quantity changed without an audit row. | `database/functions/apply_stock_adjustment.sql` |
| A quantity is wrong and you need to know why. | `database/migrations/0011_stock_adjustments.sql` |
| A quantity is wrong, an item does not become low when it should, or a change has no audit row. | `backend/app/domain/stock.py` |
| A rejected order clutters or vanishes. | `frontend/app/(customer)/delivery/history.tsx` |
| A report chart is wrong. | `frontend/app/(customer)/reports/[type].tsx` |
| A report endpoint fails. | `backend/app/feeds/customer/reports/routes.py` |
| A report number looks wrong or a report is slow. | `backend/app/feeds/customer/reports/service.py` |
| A requested item still opens the popup. | `frontend/src/components/StockRow.tsx` |
| A screen is slow because it is computing predictions live. | `backend/app/ml/storage.py` |
| A secret or junk file shows up in git status. | `backend/.gitignore` |
| A setting reads as None or the wrong value. | `backend/app/config.py` |
| A stage advance button returns an error. | `backend/app/feeds/supplier/delivery/routes.py` |
| A stage advance does not work from the card. | `frontend/app/(supplier)/delivery/index.tsx` |
| A stage group renders empty on the phone. | `backend/app/feeds/supplier/delivery/schemas.py` |
| A stage shows a wrong label. | `frontend/src/constants/stages.ts` |
| A stage timestamp is missing or status is invalid. | `database/migrations/0005_orders.sql` |
| A status string is misspelled somewhere. | `frontend/src/types/orderStatus.ts` |
| A stocks endpoint 404s, returns the wrong status code, or rejects a valid body. | `backend/app/feeds/customer/stocks/routes.py` |
| A stocks screen shows no data. | `frontend/src/api/stocks.ts` |
| A suggested threshold is obviously wrong. | `backend/app/domain/thresholds.py` |
| A supplier can see a shop's sales history. | `database/policies/sales_data.sql` |
| A supplier can see shop stock levels. | `database/policies/stock_items.sql` |
| A supplier card is missing a field the design shows. | `backend/app/feeds/customer/suppliers/schemas.py` |
| A supplier edits another supplier's listing. | `database/policies/supplier_listings.sql` |
| A supplier edits or deletes a rating. | `database/policies/supplier_ratings.sql` |
| A supplier row is missing its badge or marker. | `frontend/src/components/SupplierRow.tsx` |
| A supplier sees a customer tab. | `frontend/app/(supplier)/_layout.tsx` |
| A tab is missing or in the wrong order. | `frontend/app/(customer)/_layout.tsx` |
| A threshold edit or manual adjustment misbehaves. | `frontend/app/(customer)/stocks/[id].tsx` |
| A tuned value has no effect, or a timeout fires at the wrong time. | `backend/app/domain/config_store.py` |
| A tuned value has no effect. | `database/migrations/0015_app_config.sql` |
| A user edits the shared catalog. | `database/policies/catalog.sql` |
| A user ends up with the wrong role. | `frontend/app/(auth)/choose-role.tsx` |
| A user field is missing or the role is wrong. | `database/migrations/0001_profiles.sql` |
| A user has the wrong role, or role fields are missing after registration. | `backend/app/feeds/shared/auth/service.py` |
| A user lands in the wrong app after login. | `frontend/app/_layout.tsx` |
| A user reaches an endpoint their role should not reach, or a valid user gets 401 or 403. | `backend/app/dependencies.py` |
| A user reads a profile they should not. | `database/policies/profiles.sql` |
| A user sees another user's alerts. | `database/policies/notifications.sql` |
| A valid file will not parse, or dates and numbers come out wrong. | `backend/app/feeds/customer/uploads/parser.py` |
| A validation message does not reach the app, or the send body is rejected. | `backend/app/feeds/customer/ordering/schemas.py` |
| A WhatsApp message is not delivered. | `backend/app/integrations/whatsapp.py` |
| Adding a listing fails. | `frontend/app/(supplier)/listings/add.tsx` |
| Adding a product fails. | `frontend/app/(customer)/stocks/add.tsx` |
| After changing message wording. | `backend/tests/test_message_builder.py` |
| After changing the upload pipeline. | `backend/tests/test_uploads.py` |
| After touching anything that changes quantity. | `backend/tests/test_stock.py` |
| An action button is missing or does the wrong thing. | `frontend/app/(customer)/delivery/[id].tsx` |
| An edit is lost when changing supplier. | `frontend/src/stores/restockDraftStore.ts` |
| An email order is not delivered. | `backend/app/integrations/email_sender.py` |
| An endpoint returns 404, or you want to see every route the backend exposes. | `backend/app/api.py` |
| An error happens silently. | `frontend/src/components/ErrorBanner.tsx` |
| An error message is unhelpful. | `frontend/src/lib/errors.ts` |
| An error reaches the phone as a 500 with no useful message. | `backend/app/core/exceptions.py` |
| An import fails or a package version needs changing. | `backend/requirements.txt` |
| An order appears in the wrong section. | `frontend/app/(customer)/delivery/index.tsx` |
| An order card shows a missing or wrong field. | `backend/app/feeds/customer/delivery/schemas.py` |
| An order closes too early, too late, or never. | `backend/app/jobs/auto_confirm.py` |
| An order exists but its message was never sent. | `backend/app/integrations/queue.py` |
| An order is in the wrong section or a filter fails. | `frontend/app/(supplier)/orders/index.tsx` |
| An order is in the wrong section, or a supplier confirms stock they do not have. | `backend/app/feeds/supplier/orders/service.py` |
| An order is visible to the wrong party. | `database/policies/orders.sql` |
| An order list does not refresh after an action. | `frontend/src/hooks/useOrders.ts` |
| An order moves to a state it should not, a legal transition is refused, or a supplier changes something only a customer may change. | `backend/app/domain/order_state_machine.py` |
| An order sits in the wrong section, or confirming receipt does not top up stock. | `backend/app/feeds/customer/delivery/service.py` |
| An order total is wrong after a price change. | `database/migrations/0006_order_items.sql` |
| An upload gets stuck in a status, or a duplicate file is not rejected. | `backend/app/feeds/customer/uploads/service.py` |
| An upload step fails from the app. | `frontend/src/api/uploads.ts` |
| An upload step returns an error. | `backend/app/feeds/customer/uploads/routes.py` |
| Auth or realtime fails. | `frontend/src/lib/supabase.ts` |
| Auth screens have wrong headers or back behaviour. | `frontend/app/(auth)/_layout.tsx` |
| Available quantity does not drop after confirming, or a deactivated listing still appears in search. | `backend/app/feeds/supplier/listings/service.py` |
| Before changing anything about order status. | `backend/tests/test_order_state_machine.py` |
| Before tuning weights. | `backend/tests/test_ranking.py` |
| Buttons look inconsistent. | `frontend/src/components/ui/Button.tsx` |
| Cards look inconsistent. | `frontend/src/components/ui/Card.tsx` |
| Catalog search returns nothing. | `backend/app/feeds/shared/catalog/routes.py` |
| Choosing a file fails. | `frontend/app/(customer)/stocks/upload/index.tsx` |
| Columns map to the wrong fields. | `frontend/app/(customer)/stocks/upload/mapping.tsx` |
| Config values are missing on a fresh install. | `database/seeds/app_config.sql` |
| Confirm or Reject misbehaves. | `frontend/app/(supplier)/orders/[id].tsx` |
| Confirm or Reject returns an error. | `backend/app/feeds/supplier/orders/routes.py` |
| Delivery screens show no data. | `frontend/src/api/delivery.ts` |
| Editing a listing fails. | `frontend/app/(supplier)/listings/[id].tsx` |
| Every database call fails, or RLS blocks a call it should not. | `backend/app/core/supabase.py` |
| Every request fails, or errors lose their message. | `frontend/src/api/client.ts` |
| Forecasts have no data. | `database/migrations/0009_sales_records.sql` |
| Inputs look inconsistent. | `frontend/src/components/ui/Input.tsx` |
| Layouts feel uneven. | `frontend/src/theme/spacing.ts` |
| Listings render wrongly. | `frontend/app/(supplier)/listings/index.tsx` |
| Listings show no data. | `frontend/src/api/listings.ts` |
| Login fails or the screen does not match the design. | `frontend/app/(auth)/login.tsx` |
| Login works in the app but every API call returns 401. | `backend/app/core/security.py` |
| Low stock or double-ordering behaves wrongly. | `database/migrations/0004_stock_items.sql` |
| Marking delivered wrongly completes the order, or an order is missing from the queue. | `backend/app/feeds/supplier/delivery/service.py` |
| No reminder despite an old last upload. | `backend/app/jobs/stale_stock.py` |
| Nobody is warned about a stale order. | `backend/app/jobs/unanswered_orders.py` |
| Order lines leak. | `database/policies/order_items.sql` |
| Predictions never update. | `backend/app/jobs/forecast_recalc.py` |
| Product search shows nothing. | `frontend/src/api/catalog.ts` |
| Products do not match between a customer and a supplier. | `database/migrations/0002_product_catalog.sql` |
| Profile fields are missing after registration. | `frontend/app/(auth)/profile-setup.tsx` |
| Push does not reach a device. | `database/migrations/0014_device_tokens.sql` |
| Push notifications do not arrive on a device. | `backend/app/integrations/fcm.py` |
| Push registration fails. | `frontend/src/api/notifications.ts` |
| Ranking recompute is slow. | `database/functions/recompute_supplier_ranking.sql` |
| Rankings are stale after new ratings. | `backend/app/jobs/ranking_recalc.py` |
| Ratings are duplicated or missing. | `database/migrations/0007_supplier_ratings.sql` |
| Ratings are never collected, which breaks 40 percent of the ranking. | `frontend/src/components/RatingPrompt.tsx` |
| Recommendations disagree badly with the formula. | `backend/app/ml/supplier_recommendation.py` |
| Registration fails. | `frontend/app/(auth)/register.tsx` |
| Registration or profile calls fail. | `frontend/src/api/auth.ts` |
| Registration or profile setup fails. | `backend/app/feeds/shared/auth/routes.py` |
| Registration rejects a valid form. | `backend/app/feeds/shared/auth/schemas.py` |
| Reports show no data. | `frontend/src/api/reports.ts` |
| Role checks disagree between screens. | `frontend/src/hooks/useAuth.ts` |
| Seasonal suggestions are far off. | `backend/app/ml/seasonal_uplift.py` |
| Segment counts are wrong or tapping does nothing. | `frontend/src/components/StockStatusChart.tsx` |
| Send is wrongly disabled or enabled, the wrong supplier is used, or stock is not marked as requested. | `backend/app/feeds/customer/ordering/service.py` |
| Send is wrongly disabled, or changing supplier loses an edit without warning. | `frontend/src/components/RestockPopup.tsx` |
| Stock data is stale after a change. | `frontend/src/hooks/useStocks.ts` |
| Stock was reduced twice, or half an upload was applied. | `backend/app/feeds/customer/uploads/applier.py` |
| Suggested thresholds are wrong. | `backend/app/ml/threshold_suggestion.py` |
| Supplier data is stale. | `frontend/src/hooks/useSuppliers.ts` |
| Supplier orders show no data. | `frontend/src/api/orders.ts` |
| Supplier search returns nothing or errors. | `backend/app/feeds/customer/suppliers/routes.py` |
| Supplier search shows nothing. | `frontend/src/api/suppliers.ts` |
| Suppliers appear in the wrong order, or a new supplier is stuck at the bottom forever. | `backend/app/domain/ranking.py` |
| Suppliers are ordered wrongly or selection mode misbehaves. | `frontend/app/(customer)/suppliers/index.tsx` |
| Tapping a notification opens the wrong screen. | `backend/app/feeds/shared/notifications/schemas.py` |
| Tapping a push does not open the right screen. | `frontend/src/hooks/useNotifications.ts` |
| Tests cannot start. | `backend/tests/conftest.py` |
| Text sizes are inconsistent. | `frontend/src/theme/typography.ts` |
| The app cannot start, or a secret is missing. | `backend/.env.example` |
| The app expects a field the backend does not send. | `frontend/src/types/api.ts` |
| The app forgets who is signed in. | `frontend/src/stores/authStore.ts` |
| The app opens on a blank or wrong screen. | `frontend/app/index.tsx` |
| The app says a field is missing or undefined. | `backend/app/feeds/customer/stocks/schemas.py` |
| The catalog is empty on a fresh install. | `database/seeds/product_catalog.sql` |
| The generated message has wrong wording, a missing product, or a wrong total. | `backend/app/domain/message_builder.py` |
| The home screen renders wrongly. | `frontend/app/(customer)/stocks/index.tsx` |
| The in-app notification list fails to load. | `backend/app/feeds/shared/notifications/routes.py` |
| The indicator shows the wrong stage. | `frontend/src/components/StageProgress.tsx` |
| The mapping screen cannot read the columns. | `backend/app/feeds/customer/uploads/schemas.py` |
| The popup cannot load or send. | `frontend/src/api/ordering.ts` |
| The popup cannot load, or Send returns an error. | `backend/app/feeds/customer/ordering/routes.py` |
| The product picker shows the wrong fields. | `backend/app/feeds/shared/catalog/schemas.py` |
| The reports feed renders wrongly. | `frontend/app/(customer)/reports/index.tsx` |
| The server will not start, CORS blocks the app, or an error returns the wrong shape. | `backend/app/main.py` |
| The smart dashboard has nothing to warn about. | `database/seeds/seasonal_events.sql` |
| The supplier order card is missing a field. | `backend/app/feeds/supplier/orders/schemas.py` |
| The wrong items appear in a section, or the pie chart numbers are wrong. | `backend/app/feeds/customer/stocks/service.py` |
| The wrong suppliers appear, or measured delivery time looks wrong. | `backend/app/feeds/customer/suppliers/service.py` |
| You are new to the backend or forgot where a kind of code belongs. | `backend/README.md` |
| You are setting up the app for the first time. | `frontend/README.md` |
| You are unsure how two tables connect. | `database/ERD.md` |
| You cannot tell what happened during a failed request. | `backend/app/core/logging.py` |
| You need a populated app for a demo. | `database/seeds/demo_data.sql` |
| You need to change the schema. | `database/README.md` |

## Part 2 — Specification section to file

Every numbered section of the functional specification, and the file that owns it.
If a section has no file, that rule has no home and will be implemented inconsistently.

| Spec section | Owned by |
|---|---|
| Section 3 | `backend/README.md`<br>`backend/requirements.txt`<br>`backend/app/main.py`<br>`backend/app/api.py`<br>`backend/app/core/supabase.py`<br>`frontend/README.md`<br>`frontend/src/types/api.ts` |
| Section 3.1 and 15.3 | `backend/app/integrations/whatsapp.py` |
| Section 3.1 | `backend/app/integrations/email_sender.py`<br>`frontend/src/api/client.ts`<br>`frontend/src/hooks/useRealtime.ts`<br>`frontend/src/lib/supabase.ts` |
| Section 4.1 | `backend/app/feeds/shared/auth/routes.py`<br>`backend/app/feeds/shared/auth/schemas.py`<br>`frontend/app/(auth)/_layout.tsx`<br>`frontend/app/(auth)/login.tsx`<br>`frontend/app/(auth)/register.tsx`<br>`frontend/app/(auth)/choose-role.tsx`<br>`frontend/app/(auth)/profile-setup.tsx`<br>`frontend/src/api/auth.ts` |
| Section 4.1 and 4.2 | `backend/app/feeds/shared/auth/service.py` |
| Section 4.2 | `frontend/app/_layout.tsx`<br>`frontend/app/index.tsx`<br>`frontend/app/(customer)/_layout.tsx`<br>`frontend/src/hooks/useAuth.ts`<br>`frontend/src/stores/authStore.ts` |
| Section 4.2 and 10 | `frontend/app/(supplier)/_layout.tsx` |
| Section 5 | `frontend/src/types/database.ts`<br>`database/README.md`<br>`database/ERD.md` |
| Section 5.1 | `database/migrations/0001_profiles.sql` |
| Section 5.2 | `backend/app/feeds/shared/catalog/routes.py`<br>`backend/app/feeds/shared/catalog/service.py`<br>`backend/app/feeds/shared/catalog/schemas.py`<br>`frontend/src/api/catalog.ts`<br>`database/migrations/0002_product_catalog.sql` |
| Section 5.3 | `database/migrations/0003_supplier_listings.sql` |
| Section 5.4 | `database/migrations/0004_stock_items.sql` |
| Section 5.5 | `database/migrations/0005_orders.sql` |
| Section 5.6 | `database/migrations/0006_order_items.sql` |
| Section 5.7 | `database/migrations/0007_supplier_ratings.sql` |
| Section 5.8 | `database/migrations/0008_sales_uploads.sql`<br>`database/migrations/0009_sales_records.sql` |
| Section 5.9 | `database/migrations/0010_pos_product_aliases.sql` |
| Section 5.10 | `database/migrations/0011_stock_adjustments.sql`<br>`database/functions/apply_stock_adjustment.sql` |
| Section 5.11 | `database/migrations/0012_seasonal_events.sql`<br>`database/seeds/seasonal_events.sql` |
| Section 5.12 | `backend/app/feeds/shared/notifications/schemas.py`<br>`database/migrations/0013_notifications.sql`<br>`database/migrations/0014_device_tokens.sql` |
| Section 5.12 and 13 | `backend/app/integrations/fcm.py` |
| Section 6 | `backend/app/feeds/customer/stocks/routes.py`<br>`backend/app/feeds/customer/stocks/schemas.py`<br>`frontend/src/api/stocks.ts`<br>`frontend/src/hooks/useStocks.ts` |
| Section 6.1 to 6.4 and 6.7 | `backend/app/feeds/customer/stocks/service.py` |
| Section 6.1 | `frontend/app/(customer)/stocks/index.tsx` |
| Section 6.2 | `backend/app/domain/seasonal.py`<br>`frontend/src/components/StockStatusChart.tsx`<br>`frontend/src/components/SeasonalCard.tsx` |
| Section 6.3 and 6.6 | `frontend/app/(customer)/stocks/[id].tsx` |
| Section 6.3 and 6.4 | `frontend/src/components/StockRow.tsx` |
| Section 6.5 | `backend/app/domain/message_builder.py`<br>`backend/app/feeds/customer/ordering/routes.py`<br>`backend/app/feeds/customer/ordering/service.py`<br>`backend/app/feeds/customer/ordering/schemas.py`<br>`backend/tests/test_message_builder.py`<br>`frontend/src/api/ordering.ts`<br>`frontend/src/components/RestockPopup.tsx`<br>`frontend/src/components/ErrorBanner.tsx`<br>`frontend/src/stores/restockDraftStore.ts`<br>`frontend/src/lib/errors.ts`<br>`frontend/src/constants/channels.ts` |
| Section 6.6 and 5.10 | `backend/app/domain/stock.py` |
| Section 6.6 | `backend/app/feeds/customer/uploads/routes.py`<br>`backend/app/feeds/customer/uploads/service.py`<br>`backend/app/feeds/customer/uploads/parser.py`<br>`backend/app/feeds/customer/uploads/applier.py`<br>`backend/app/feeds/customer/uploads/schemas.py`<br>`backend/tests/test_stock.py`<br>`backend/tests/test_uploads.py`<br>`frontend/app/(customer)/stocks/upload/index.tsx`<br>`frontend/app/(customer)/stocks/upload/mapping.tsx`<br>`frontend/app/(customer)/stocks/upload/unmatched.tsx`<br>`frontend/src/api/uploads.ts` |
| Section 6.6 and 5.9 | `backend/app/feeds/customer/uploads/mapping.py` |
| Section 6.7 | `backend/app/domain/thresholds.py`<br>`frontend/app/(customer)/stocks/add.tsx`<br>`frontend/src/components/EmptyState.tsx` |
| Section 7 | `backend/app/feeds/customer/reports/routes.py`<br>`backend/app/feeds/customer/reports/schemas.py`<br>`frontend/app/(customer)/reports/index.tsx`<br>`frontend/src/api/reports.ts` |
| Section 7.1 | `backend/app/feeds/customer/reports/service.py`<br>`frontend/app/(customer)/reports/[type].tsx` |
| Section 7.2 | `backend/app/ml/forecast.py`<br>`backend/app/ml/seasonal_uplift.py`<br>`backend/app/ml/threshold_suggestion.py`<br>`backend/app/ml/supplier_recommendation.py`<br>`backend/app/ml/storage.py` |
| Section 8 | `backend/app/feeds/customer/delivery/routes.py`<br>`frontend/src/api/delivery.ts` |
| Section 8 and 10.2 | `frontend/src/hooks/useOrders.ts` |
| Section 8.1 and 8.3 | `backend/app/feeds/customer/delivery/service.py` |
| Section 8.1 | `frontend/app/(customer)/delivery/index.tsx`<br>`frontend/app/(customer)/delivery/history.tsx` |
| Section 8.2 | `backend/app/feeds/customer/delivery/schemas.py` |
| Section 8.2 and 8.3 | `frontend/app/(customer)/delivery/[id].tsx` |
| Section 8.2 and 10.2 | `frontend/src/components/OrderCard.tsx` |
| Section 9 | `backend/app/feeds/customer/suppliers/routes.py`<br>`backend/app/feeds/customer/suppliers/service.py`<br>`backend/app/feeds/customer/suppliers/schemas.py`<br>`frontend/src/api/suppliers.ts`<br>`frontend/src/hooks/useSuppliers.ts` |
| Section 9.1 and 9.3 | `frontend/app/(customer)/suppliers/index.tsx` |
| Section 9.2 | `frontend/app/(customer)/suppliers/[id].tsx` |
| Section 9.3 and 12.2 | `frontend/src/components/SupplierRow.tsx` |
| Section 10.1 | `backend/app/feeds/supplier/listings/routes.py`<br>`backend/app/feeds/supplier/listings/service.py`<br>`backend/app/feeds/supplier/listings/schemas.py`<br>`frontend/app/(supplier)/listings/index.tsx`<br>`frontend/app/(supplier)/listings/[id].tsx`<br>`frontend/app/(supplier)/listings/add.tsx`<br>`frontend/src/api/listings.ts` |
| Section 10.2 | `backend/app/feeds/supplier/orders/routes.py`<br>`backend/app/feeds/supplier/orders/service.py`<br>`backend/app/feeds/supplier/orders/schemas.py`<br>`frontend/app/(supplier)/orders/index.tsx`<br>`frontend/app/(supplier)/orders/[id].tsx`<br>`frontend/src/api/orders.ts` |
| Section 10.3 | `backend/app/feeds/supplier/delivery/routes.py`<br>`backend/app/feeds/supplier/delivery/schemas.py`<br>`frontend/app/(supplier)/delivery/index.tsx` |
| Section 10.3 and 11.3 | `backend/app/feeds/supplier/delivery/service.py` |
| Section 11.1 and 11.2 | `backend/app/domain/order_state_machine.py` |
| Section 11.1 | `frontend/src/components/StageProgress.tsx`<br>`frontend/src/types/orderStatus.ts`<br>`frontend/src/constants/stages.ts` |
| Section 11.2 | `backend/tests/test_order_state_machine.py` |
| Section 11.5 and 14 | `backend/app/jobs/auto_confirm.py` |
| Section 12 | `backend/app/domain/ranking.py`<br>`backend/tests/test_ranking.py` |
| Section 12.1 and 17 | `backend/app/domain/config_store.py`<br>`database/migrations/0015_app_config.sql` |
| Section 12.1 | `database/seeds/app_config.sql` |
| Section 12.3 | `frontend/src/components/RatingPrompt.tsx` |
| Section 13 | `backend/app/feeds/shared/notifications/routes.py`<br>`backend/app/feeds/shared/notifications/service.py`<br>`frontend/app/notifications.tsx`<br>`frontend/src/api/notifications.ts`<br>`frontend/src/hooks/useNotifications.ts` |
| Section 14 | `backend/app/jobs/scheduler.py`<br>`backend/app/jobs/unanswered_orders.py`<br>`backend/app/jobs/seasonal_warnings.py`<br>`backend/app/jobs/stale_stock.py`<br>`backend/app/jobs/ranking_recalc.py`<br>`backend/app/jobs/forecast_recalc.py`<br>`database/functions/recompute_supplier_ranking.sql` |
| Section 15.1 | `database/policies/profiles.sql`<br>`database/policies/stock_items.sql`<br>`database/policies/supplier_listings.sql`<br>`database/policies/orders.sql`<br>`database/policies/order_items.sql`<br>`database/policies/supplier_ratings.sql`<br>`database/policies/sales_data.sql`<br>`database/policies/notifications.sql`<br>`database/policies/catalog.sql` |
| Section 15.2 | `backend/app/dependencies.py`<br>`backend/app/core/security.py`<br>`backend/app/core/exceptions.py` |
| Section 15.3 | `backend/.env.example`<br>`backend/.gitignore`<br>`backend/app/config.py` |
| Section 15.4 | `backend/app/core/idempotency.py`<br>`backend/app/integrations/queue.py` |
| Section 17 | `database/seeds/product_catalog.sql` |

## Part 3 — The four questions that locate almost any bug

**1. Is it wrong on the phone, or wrong in the answer the phone was given?**
Check the network response first. If the response is correct, the bug is in the screen or a
component. If the response is wrong, the app is innocent and you never need to open it.

**2. Wrong shape, or wrong data?**
A missing or undefined field is a `schemas.py` and `src/types/` problem. Correct fields holding
wrong values is a `service.py` problem.

**3. Does more than one feed do this?**
If the same wrongness appears in two feeds, stop looking in the feeds. The bug is in `domain/`,
and fixing it in one feed will hide it rather than remove it.

**4. Is a number wrong, or did it become wrong?**
Any quantity that looks wrong has a full history in `stock_adjustments`. Read the rows before
reading any code — they tell you which write caused it, and therefore which file to open.
