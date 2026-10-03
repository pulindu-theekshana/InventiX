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

## 2026-10-03 - Phase 7: printing, scanning, and installing on the laptop
**Added.** Till activity for the owner: `GET /customer/pos/activity` and **Reports -> Till — who
sold what**. Takings per cashier over a day, a week or a month, and every discount and return with
the name of the account that rang it. Owner only; no new SQL, it reads what phase 6 stamps.

**Added.** A printed receipt (`src/pos/receipt.ts`), from the till's last bill and from any bill
the returns screen finds. Markup and `window.print()` into a hidden iframe — a thermal roll
printer on a laptop is an ordinary printer to the browser, so there is no driver and no
dependency.

**Added.** Installable till: `public/manifest.webmanifest`, `public/sw.js` and
`public/index.html`. Opens from a desktop icon in its own window, and starts with no connection.
`npm run build:web` and `npm run serve:web`.

**Fixed.** An installed till with no connection showed the login screen to someone who was
already signed in: the app asked the server who they were on every launch and read a failed
request as a sign-out. The profile is remembered on the device and used when the server cannot be
reached, and cleared on sign-out.

**Added.** `src/pos/day.ts` — day close works offline. The day is built from what the backend has
been sent (live, or the copy saved for today) plus the bills still in the queue, priced on the
device, with the screen saying which half is which.

**Added.** `src/pos/catalog.ts` — the till keeps the last product list it saw, so an offline
counter can still find a product and build a bill. The screen says when the list is a stored one.

**Added.** A "newer version is ready — reload now" bar instead of a worker that takes over
mid-sale, and `src/components/UpdateReady.tsx` behind it.

**Changed.** A character typed anywhere on the till now starts a search, so a scan after a tap on
a stepper or a payment button is not lost.

**Added.** Scan-to-link: an unknown barcode at the till offers to be saved to a product, which is
how a shop whose catalog has no barcodes ever gets any. `POST /customer/stocks/{id}/barcode`,
reachable by a cashier, written to the shared catalog and never overwritten.

**Changed.** The Reports sales tab no longer says it is waiting for an uploaded POS file: sales
from the shop's own till are already counted.

**Not built.** Phase 8, the packaged `.exe`. `docs/16-pos-system.md` says what it would take and
when it is worth it.

**Decisions.** D-023, D-024.

## 2026-10-02 - Phase 6: cashier accounts
**Added.** Staff logins. The owner types a name and a password in till settings and gets back a
login address for that person; they sign in at the normal screen and land on the till. New role
`'cashier'` on `profiles` with `employer_id`, created through `POST /customer/pos/cashiers`.

**Added.** `app_shop_id()` in the database and `CurrentUser.shop_id` in the backend - the same
`coalesce(employer_id, id)`, so a policy and a service cannot disagree about whose shop a row
belongs to. Read policies for the till on `stock_items`, `pos_sales`, `pos_sale_items` and
`pos_settings`, added beside the owner's rather than replacing them.

**Changed.** The name and id on a bill are stamped from the token. `pos_sales.cashier_id` is new,
and the `cashier_label` the till sends is ignored - a field the client chooses is a field the
client can lie about, and this is the one an owner would rely on in a dispute.

**Changed.** The till's endpoints and `GET /customer/stocks` moved to `require_till` (owner or
cashier). Everything else a shop can do stays on `require_customer`, so a cashier gets 403.

**Changed.** The owner PIN is now asked for one thing only: a discount or refund above the shop's
limit, while a cashier is at the counter. It no longer guards leaving the till or opening settings,
because an account does that properly.

**Removed.** `/pos/shift`, `src/pos/shift.ts` and the per-cashier PIN list. `pos_settings.cashiers`
stays in the database, unread.

**Migration.** `0029_cashier_accounts.sql` - run it before using the till.

**Decisions.** D-022.

## 2026-10-02 — Till: sales that could never be sent
**Fixed.** A bill whose receipt number the shop had already used made the backend return 500, and
the till kept it waiting for ever. It is now a 409 (`receipt_taken`); the till renumbers the bill
and sends it again.

**Added.** `GET /customer/pos/next-receipt` — the till moves its counter forward on opening, so a
device whose storage was cleared does not restart at 1 and collide.

**Added.** A request timeout (20s) in `api/client.ts`, a stuck-run guard in the send queue, and the
reason and address shown on day close when something has not been sent.

## 2026-10-02 — Till settings made readable, and three till bugs
**Fixed.** Settings were read from an empty cache before the real ones arrived, so the shift screen
said "no cashiers added yet" to a shop with three, and the settings screen opened unlocked for a
shop that had set a PIN. `src/pos/settings.ts` now waits for the first load and tells open screens
when fresh settings arrive.

**Fixed.** `/pos` rendered for a signed-out browser. The till now requires a signed-in shop account
and sends a supplier to their own home.

**Changed.** Settings show what is saved — "A PIN is set", the two limits as amounts — each with a
single Change button, instead of an empty field that read like nothing was saved. The limits say
they apply to the whole shop. Cashiers can be added or removed at any time, and the shift screen
always links to settings.

**Added.** A Settings link on the till itself, behind the owner PIN.

## 2026-10-01 — Phase 5 of the POS: who may use the till
**Added.** `database/migrations/0028_pos_settings.sql` — one row per shop: the owner's PIN hash,
the cashiers, and the limits above which the owner is asked.

**Added.** `GET/PUT /customer/pos/settings`, `frontend/app/pos/shift.tsx`,
`frontend/app/pos/settings.tsx`, `frontend/src/components/OwnerPin.tsx`,
`frontend/src/pos/{pin,settings,shift}.ts`.

**Changed.** The till now requires a shift before selling, stamps every bill with the cashier's
name, asks the owner for a discount or refund above the limit and for leaving the till, and the day
close has a "worth a look" list of discounts and returns per cashier.

**Added.** Dependency `expo-crypto`, for hashing PINs on the device.

**Decisions.** D-020.

**Next.** Phase 6 — a real cashier account, where the data boundary is real.

## 2026-10-01 — Phase 4 of the POS: returns and day close
**Added.** `POST /customer/pos/returns` — prices taken from the original bill, a line cannot be
returned twice, stock comes back through the audited path.

**Added.** `frontend/app/pos/returns.tsx` and `frontend/app/pos/close.tsx`, both reachable from the
sell screen.

**Changed.** The day summary now splits takings per cashier, ready for phase 5 to put a real person
behind the label.

**Added.** `database/migrations/0027_sales_records_allow_returns.sql` — a return is stored as a
negative row in the sales history, so Reports count net sales rather than gross.

**Next.** Phase 5 — cashier PIN at shift start, owner PIN on discounts, returns and leaving the
till.

## 2026-10-01 — Phase 3 of the POS: the sell screen
**Added.** `frontend/app/(pos)/` — the till: scan or search, cart with quantity steppers, discount,
cash with change, three payment methods, finish. Reached from the menu as "Open the till".

**Added.** `frontend/src/pos/cart.ts` — cart arithmetic and parked bills.

**Changed.** `frontend/src/components/ui/Input.tsx` now accepts a ref, so the till can put the
cursor back in the search box after every scan.

**Next.** Phase 4 — returns and day close.

## 2026-10-01 — Phase 2 of the POS: the till's outbox
**Added.** `frontend/src/pos/queue.ts` — a bill is written to the device, then sent. Retries what
could not be delivered, separates a refusal from a bad connection, and never drops a bill by itself.

**Added.** `frontend/src/pos/device.ts` — this till's prefix and the receipt counter, so an offline
till can still number its bills.

**Added.** `frontend/src/api/pos.ts` and the till types in `frontend/src/types/api.ts`.

**Added.** `frontend/src/hooks/usePosQueue.ts` — unsent and stuck counts for a screen, with a
background retry while anything is waiting.

**Decisions.** D-019.

**Next.** Phase 3 — the sell screen.

## 2026-10-01 — Phase 1 of the POS: database and backend
**Added.** `database/migrations/0025_pos_adjustment_reasons.sql` — `pos_sale` and `return` join the
closed list of reasons a quantity may change.

**Added.** `database/migrations/0026_pos_sales.sql` — `pos_sales` and `pos_sale_items`, readable by
their owner and writable only by the backend. `sales_records` now accepts a till sale as well as an
uploaded one (`source`, `pos_sale_id`, and `upload_id` no longer mandatory), so Reports count both.

**Added.** `backend/app/domain/pos.py` — receipt format, line and bill totals, how far stock may
move, how much of a line is still returnable. Tested without a database in `tests/test_pos.py`.

**Added.** `backend/app/feeds/customer/pos/` — record a sale, the day's bills, one bill by receipt
number, and the day-close summary.

**Added.** `docs/16-pos-system.md` — what the till is, where it sits, and the decisions behind it.

**Decisions.** D-015 to D-018.

**Next.** Phase 2 — the till's local storage and its sync queue, so a sale is saved on the device
before it is sent.

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
