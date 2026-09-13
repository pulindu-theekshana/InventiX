# Changelog

What was added, changed or removed. Newest first. Group by the build phase in specification §18.

**Entry template**

```
## YYYY-MM-DD — Phase N: Title
Added. ...
Changed. ...
Removed. ...
Decisions. D-00N (link to the decision log entry if this came from a decision)
```

---

## 2026-09-13 — Phase 2: Customer side connected to the backend
**Added.** `frontend/src/hooks/useSubmit.ts` — one place that owns the busy flag and the error
message for a write, because nine screens awaited a write with no `catch`. See D-011.

**Added.** `migrations/0019_realtime.sql` — `orders`, `stock_items`, `notifications` and
`supplier_listings` added to the `supabase_realtime` publication. Subscriptions had been connecting,
reporting no error, and never firing.

**Added.** `migrations/0020_fix_create_order_ambiguous_reference.sql` — replaces `create_order()`.

**Added.** A permanent link to the sales report upload on the Stocks screen. The only way in was the
empty state, so the feature became unreachable as soon as a shop had any products.

**Added.** `CLAUDE.md`, `docs/11-integration-plan.pdf`, `docs/12-supplier-handover.pdf`.

**Changed.** `core/security.py` accepts ES256 and RS256 tokens as well as HS256, choosing the key by
the token's own algorithm. Our Supabase project signs with ES256, so every request had been 401.
See D-009.

**Changed.** `apply_stock_adjustment()` is now `security definer` and checks ownership itself. See
D-010.

**Changed.** `api/uploads.ts` sends the file rather than its name, reading it into a Blob first,
because Expo's fetch rejects React Native's `{uri}` part. See D-014.

**Changed.** The upload mapping screen reads the session started by the upload screen instead of
starting a second upload.

**Changed.** An upload abandoned before it was applied no longer blocks re-uploading that file. See
D-012.

**Changed.** `CUSTOMER_CONFIRMED` no longer includes `purchased`. See D-013.

**Fixed.** `create_order()` failed on every send: `returning reference` was ambiguous against the
function's own `reference` output column (42702). The 119 backend tests could not catch it — they
run without a database.

**Fixed.** The supplier profile showed an order's UUID where its total belongs; the query had
aliased `total_value:id`. The value is now summed from the order's items.

**Fixed.** `useRealtime` gives each subscription its own channel name. Three screens subscribe to
`orders`, and two are alive at once during a screen change, which realtime refuses.

**Fixed.** The restock message endpoint answers with `{ message_body, problems }`, not text; a
cleared delivery date sent `''` and was refused.

**Verified on a phone against the real backend and database:** auth, catalog, stocks, suppliers,
ordering, delivery and sales report uploads.

**Decisions.** D-009 to D-014.

**Next.** Supplier side (listings, orders, supplier delivery), then the full order journey across
both roles. Then saving a rating, which is collected and discarded today.

---

## 2026-09-03 — Phase 1a: Database schema, policies and seeds
**Added.** All 16 migrations, both SQL functions, all 9 policy files and all 4 seeds — 31 files,
1,373 lines. Every table from specification §5, with the constraints that carry a rule written as
constraints rather than left to service code.

**Added.** `migrations/0016_supplier_ranking.sql` — a table **not** in specification §5. §12 needs a
score and §14 requires it precomputed rather than calculated on every search, and nothing in §5
holds one. See D-006.

**Added.** Three columns not in §5.5: `orders.reference` (the DEL-0001 the UI already displays),
`orders.idempotency_key` (§15.4 requires send to be idempotent), and `orders.notes` (the restock
popup collects it). See D-007.

**Added.** A `set_updated_at()` trigger on every table. `default now()` fires only on insert, so
without this every `updated_at` column would have been permanently wrong.

**Verified.** The whole schema was executed against a real PostgreSQL 16 instance, and the six-step
row level security procedure in `docs/09-database-build.md` Part 5 was run rather than assumed.

**Next.** Create the Supabase project, apply these files, then Phase 1b — `backend/app/core/` and
`shared/auth`.

---

## 2026-09-01 — Phase 0: Project skeleton
**Added.** Full folder and file skeleton for `backend/`, `frontend/`, `database/` and `docs/`.
Every file carries a header naming its purpose, its specification section, and the symptom that
should send a developer to it.

**Added.** `docs/03-bug-map.md`, generated from those headers: symptom to file, and specification
section to file.

**Decisions.** D-001 to D-005.

**Next.** Phase 1 of specification §18 — Supabase project, migrations 0001 to 0015, row level
security policies, catalog seed, authentication, role-based routing.
