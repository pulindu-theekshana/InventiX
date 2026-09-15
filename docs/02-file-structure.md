# File structure

Every file in this project carries a header block naming its purpose, the specification section
it implements, and the symptom that should send you to it. `docs/03-bug-map.md` is generated from
those headers. Keep the header current when you change a file's job, and debugging stays cheap.

## Root

```
InventiX/
|-- backend/     FastAPI. Every business rule lives here.
|-- frontend/    React Native app, Expo with expo-router.
|-- database/    Supabase schema, policies and seeds.
|-- docs/        Architecture, decisions, changelog, bug map.
`-- README.md
```

## Backend

Your instinct was right: one module per feed, imported into `api.py`, with routes kept separate.
Two refinements were made to it, and both exist to make bugs easier to find.

**Refinement 1 — a feed is a folder of three files, not one file.** A feed contains three kinds of
code that break in three different ways: HTTP handling, business logic, and data shapes. Keeping
them in one file means every bug starts with scrolling. Splitting them means the symptom names the
file before you open anything. See `docs/01-architecture.md` for the symptom-to-layer table.

**Refinement 2 — feeds are grouped by role, and shared rules are lifted into `domain/`.** Both
roles have a feed called "Stocks" and both have one called "Delivery", but they do different work,
so they need separate folders under `customer/` and `supplier/`. What they genuinely share — the
order state machine above all — is lifted into `domain/`, where it exists once. Without this, the
same rule would be written four times and would drift, producing bugs where the supplier app allows
what the customer app forbids.

Note the naming: the supplier's "Stocks" feed is the folder `feeds/supplier/listings/`, because
the thing it manages is `supplier_listings`, not stock. The tab still says Stocks to the user.

```
backend/
|-- app/
|   |-- core/
|   |   |-- exceptions.py
|   |   |-- idempotency.py
|   |   |-- logging.py
|   |   |-- security.py
|   |   `-- supabase.py
|   |-- domain/
|   |   |-- config_store.py
|   |   |-- message_builder.py
|   |   |-- order_state_machine.py
|   |   |-- ranking.py
|   |   |-- seasonal.py
|   |   |-- stock.py
|   |   `-- thresholds.py
|   |-- feeds/
|   |   |-- customer/
|   |   |   |-- delivery/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   |-- ordering/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   |-- reports/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   |-- stocks/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   |-- suppliers/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   `-- uploads/
|   |   |       |-- applier.py
|   |   |       |-- mapping.py
|   |   |       |-- parser.py
|   |   |       |-- routes.py
|   |   |       |-- schemas.py
|   |   |       `-- service.py
|   |   |-- shared/
|   |   |   |-- auth/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   |-- catalog/
|   |   |   |   |-- routes.py
|   |   |   |   |-- schemas.py
|   |   |   |   `-- service.py
|   |   |   `-- notifications/
|   |   |       |-- routes.py
|   |   |       |-- schemas.py
|   |   |       `-- service.py
|   |   `-- supplier/
|   |       |-- delivery/
|   |       |   |-- routes.py
|   |       |   |-- schemas.py
|   |       |   `-- service.py
|   |       |-- listings/
|   |       |   |-- routes.py
|   |       |   |-- schemas.py
|   |       |   `-- service.py
|   |       `-- orders/
|   |           |-- routes.py
|   |           |-- schemas.py
|   |           `-- service.py
|   |-- integrations/
|   |   |-- email_sender.py
|   |   |-- fcm.py
|   |   |-- queue.py
|   |   `-- whatsapp.py
|   |-- jobs/
|   |   |-- auto_confirm.py
|   |   |-- forecast_recalc.py
|   |   |-- ranking_recalc.py
|   |   |-- scheduler.py
|   |   |-- seasonal_warnings.py
|   |   |-- stale_stock.py
|   |   `-- unanswered_orders.py
|   |-- ml/
|   |   |-- forecast.py
|   |   |-- seasonal_uplift.py
|   |   |-- storage.py
|   |   |-- supplier_recommendation.py
|   |   `-- threshold_suggestion.py
|   |-- api.py
|   |-- config.py
|   |-- dependencies.py
|   `-- main.py
|-- tests/
|   |-- conftest.py
|   |-- test_message_builder.py
|   |-- test_order_state_machine.py
|   |-- test_ranking.py
|   |-- test_stock.py
|   `-- test_uploads.py
|-- .env.example
|-- .gitignore
|-- README.md
`-- requirements.txt
```

### Where does new backend code go?

| What you are adding | Where it goes |
|---|---|
| A new endpoint for an existing feed | That feed's `routes.py`, plus logic in its `service.py` |
| A rule used by one feed | That feed's `service.py` |
| A rule used by two or more feeds, or by a job | `domain/` |
| Anything that changes a stock quantity | `domain/stock.py` — nowhere else may touch a quantity |
| Anything that changes an order status | `domain/order_state_machine.py` — nowhere else |
| A call to an outside service | `integrations/` — one file per service, and only that file |
| Something that runs on a clock | `jobs/`, registered in `jobs/scheduler.py` |
| A tunable number | The `app_config` table, read through `domain/config_store.py` — never a literal in code |

## Frontend

`app/` is routing: with expo-router the folder structure *is* the navigation, so a screen's URL and
its file path are the same thing and no screen can be hard to find. `src/` is everything else.

The three route groups in brackets are the two apps and the signed-out state. `app/_layout.tsx`
reads the role once and sends the user into `(customer)` or `(supplier)`; nothing below that point
needs to think about roles again.

```
frontend/
|-- app/
|   |-- (auth)/
|   |   |-- _layout.tsx
|   |   |-- choose-role.tsx
|   |   |-- login.tsx
|   |   |-- profile-setup.tsx
|   |   `-- register.tsx
|   |-- (customer)/
|   |   |-- delivery/
|   |   |   |-- [id].tsx
|   |   |   |-- history.tsx
|   |   |   `-- index.tsx
|   |   |-- reports/
|   |   |   |-- [type].tsx
|   |   |   `-- index.tsx
|   |   |-- stocks/
|   |   |   |-- upload/
|   |   |   |   |-- index.tsx
|   |   |   |   |-- mapping.tsx
|   |   |   |   `-- unmatched.tsx
|   |   |   |-- [id].tsx
|   |   |   |-- add.tsx
|   |   |   `-- index.tsx
|   |   |-- suppliers/
|   |   |   |-- [id].tsx
|   |   |   `-- index.tsx
|   |   `-- _layout.tsx
|   |-- (supplier)/
|   |   |-- delivery/
|   |   |   `-- index.tsx
|   |   |-- listings/
|   |   |   |-- [id].tsx
|   |   |   |-- add.tsx
|   |   |   `-- index.tsx
|   |   |-- orders/
|   |   |   |-- [id].tsx
|   |   |   `-- index.tsx
|   |   `-- _layout.tsx
|   |-- settings/
|   |   `-- index.tsx
|   |-- _layout.tsx
|   |-- index.tsx
|   `-- notifications.tsx
|-- src/
|   |-- api/
|   |   |-- auth.ts
|   |   |-- catalog.ts
|   |   |-- client.ts
|   |   |-- delivery.ts
|   |   |-- listings.ts
|   |   |-- notifications.ts
|   |   |-- ordering.ts
|   |   |-- orders.ts
|   |   |-- reports.ts
|   |   |-- stocks.ts
|   |   |-- suppliers.ts
|   |   `-- uploads.ts
|   |-- components/
|   |   |-- ui/
|   |   |   |-- Badge.tsx
|   |   |   |-- Button.tsx
|   |   |   |-- Card.tsx
|   |   |   |-- Input.tsx
|   |   |   `-- Modal.tsx
|   |   |-- EmptyState.tsx
|   |   |-- ErrorBanner.tsx
|   |   |-- OrderCard.tsx
|   |   |-- RatingPrompt.tsx
|   |   |-- SeasonalCard.tsx
|   |   |-- StageProgress.tsx
|   |   |-- StockRow.tsx
|   |   |-- StockStatusChart.tsx
|   |   `-- SupplierRow.tsx
|   |-- constants/
|   |   |-- channels.ts
|   |   `-- stages.ts
|   |-- hooks/
|   |   |-- useAsync.ts
|   |   |-- useAuth.ts
|   |   |-- useNotifications.ts
|   |   |-- useOrders.ts
|   |   |-- useRealtime.ts
|   |   |-- useStocks.ts
|   |   |-- useSubmit.ts
|   |   `-- useSuppliers.ts
|   |-- lib/
|   |   |-- errors.ts
|   |   |-- format.ts
|   |   `-- supabase.ts
|   |-- stores/
|   |   |-- authStore.ts
|   |   `-- restockDraftStore.ts
|   |-- theme/
|   |   |-- colors.ts
|   |   |-- spacing.ts
|   |   `-- typography.ts
|   `-- types/
|       |-- api.ts
|       |-- database.ts
|       `-- orderStatus.ts
`-- README.md
```

### Where does new frontend code go?

| What you are adding | Where it goes |
|---|---|
| A new screen | `app/`, in the group and folder matching its place in navigation |
| A piece of UI used on two screens | `src/components/` |
| A generic control used everywhere | `src/components/ui/` |
| A call to the backend | `src/api/`, in the file matching the backend feed |
| Data fetching and caching | `src/hooks/` |
| State that outlives one screen | `src/stores/` |
| A colour, size or font | `src/theme/` — never a literal in a component |
| A type mirroring the backend | `src/types/` |

## Database

Migrations are numbered in dependency order, one table each. A table is never edited in place:
changing the schema means adding `0021_...sql`, so the database can always be rebuilt from zero
and every change has a date and an author in git.

Policies are separated from tables deliberately. Row level security is the thing most likely to be
wrong and hardest to notice — a missing policy is invisible until a supplier can read a shop's
sales history. Keeping them in their own folder means they can be reviewed as a set, against
specification §15.1, without reading the schema at the same time.

```
database/
|-- functions/
|   |-- apply_stock_adjustment.sql
|   `-- recompute_supplier_ranking.sql
|-- migrations/
|   |-- 0001_profiles.sql
|   |-- 0002_product_catalog.sql
|   |-- 0003_supplier_listings.sql
|   |-- 0004_stock_items.sql
|   |-- 0005_orders.sql
|   |-- 0006_order_items.sql
|   |-- 0007_supplier_ratings.sql
|   |-- 0008_sales_uploads.sql
|   |-- 0009_sales_records.sql
|   |-- 0010_pos_product_aliases.sql
|   |-- 0011_stock_adjustments.sql
|   |-- 0012_seasonal_events.sql
|   |-- 0013_notifications.sql
|   |-- 0014_device_tokens.sql
|   |-- 0015_app_config.sql
|   |-- 0016_supplier_ranking.sql
|   |-- 0017_create_order.sql
|   |-- 0018_job_tracking_columns.sql
|   |-- 0019_realtime.sql
|   `-- 0020_fix_create_order_ambiguous_reference.sql
|-- policies/
|   |-- catalog.sql
|   |-- notifications.sql
|   |-- order_items.sql
|   |-- orders.sql
|   |-- profiles.sql
|   |-- sales_data.sql
|   |-- stock_items.sql
|   |-- supplier_listings.sql
|   `-- supplier_ratings.sql
|-- seeds/
|   |-- app_config.sql
|   |-- demo_data.sql
|   |-- product_catalog.sql
|   `-- seasonal_events.sql
|-- ERD.md
`-- README.md
```

## Docs

```
docs/
|-- 00-INDEX.md
|-- 01-architecture.md
|-- 02-file-structure.md
|-- 03-bug-map.md
|-- 04-decision-log.md
|-- 05-changelog.md
|-- 06-open-questions.md
`-- 07-design-vs-spec.md
```
