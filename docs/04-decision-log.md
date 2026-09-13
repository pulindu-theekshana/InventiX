# Decision log

Append a new entry whenever you decide, or change your mind about, how the app works.
Never delete or rewrite an entry — a reversal is a new entry that references the old one.
This is the document your project report's justification chapter is written from.

**Entry template**

```
## D-00N — Short title
Date: YYYY-MM-DD · Decided by: Member X (and whoever else)
Status: accepted | superseded by D-00M

Decision. What we are doing now, in one or two sentences.
Reason. Why, including what would go wrong otherwise.
Alternatives. What else we considered and why it lost.
Affects. Spec sections, files and documents changed as a result.
```

---

## D-001 — Two roles in one application, chosen at registration
Date: 2026-09-01 · Decided by: Team 4 · Status: accepted

**Decision.** Customer and supplier are two navigation graphs inside one React Native codebase,
selected by the `role` field on the profile. The role is fixed at registration.

**Reason.** The supplier is what makes delivery stages trustworthy: someone has to actually press
"On the way". Building a second app would double the interface work for a four-person team.

**Alternatives.** A separate supplier app (rejected: double the work, shared code drifts).
Suppliers as passive contact records (rejected: nobody would update the stages).

**Affects.** Spec §4, §10. `frontend/app/_layout.tsx`, `frontend/app/(customer)/`, `frontend/app/(supplier)/`, `backend/app/feeds/customer/`, `backend/app/feeds/supplier/`.

---

## D-002 — Backend feeds are folders of three files, not single modules
Date: 2026-09-01 · Decided by: Team 4 · Status: accepted

**Decision.** Each feed is a package containing `routes.py`, `service.py` and `schemas.py`.
`api.py` imports each feed's router and mounts it.

**Reason.** The original plan of one `.py` per feed keeps related code together, which is right,
but a feed contains three kinds of code that fail in three different ways. Splitting them means the
symptom identifies the file before anything is opened. It also satisfies the requirement to keep
routes in their own file, per feed rather than in one large shared routes file — which would grow to
hundreds of lines and become the file everyone edits at once and conflicts in.

**Alternatives.** One file per feed (rejected: every bug starts with scrolling). One project-wide
`routes.py` (rejected: merge conflicts, and it separates a route from the logic it calls).

**Affects.** All of `backend/app/feeds/`. `docs/01-architecture.md`, `docs/02-file-structure.md`.

---

## D-003 — Cross-cutting rules live in `domain/`, not inside feeds
Date: 2026-09-01 · Decided by: Team 4 · Status: accepted

**Decision.** The order state machine, supplier ranking, message generation, stock movement,
seasonal windows and threshold defaults live in `backend/app/domain/`. Feeds and jobs call them.

**Reason.** The order state machine alone is needed by four callers. Written four times it would
drift, and the resulting bug — the supplier app permitting what the customer app forbids — is the
hardest kind to spot, because each file looks correct on its own.

**Affects.** Spec §11, §12, §6.5, §6.6, §6.2. `backend/app/domain/`.

---

## D-004 — Expo with expo-router for the mobile app
Date: 2026-09-01 · Decided by: Team 4 · Status: accepted

**Decision.** Expo, TypeScript, and expo-router for file-based navigation.

**Reason.** Expo removes the Android Studio setup burden for a four-person team on a deadline.
With expo-router a screen's file path is its route, so no screen is ever hard to find, and the
two role graphs are expressed as two folders rather than as navigator configuration.

**Alternatives.** Bare React Native CLI (rejected: no native module in the spec requires it).
React Navigation configured by hand (rejected: routing spread across configuration files).

**Affects.** All of `frontend/`.

---

## D-005 — Tunable values live in the database, not in code
Date: 2026-09-01 · Decided by: Team 4 · Status: accepted

**Decision.** Ranking weights, the unanswered-order limit and the auto-confirm delay live in an
`app_config` table, read through `domain/config_store.py`.

**Reason.** Specification §12.1 and §17 both require these to be tunable without a release. A
literal in Python is not tunable; it is a redeploy.

**Affects.** `database/migrations/0015_app_config.sql`, `database/seeds/app_config.sql`, `backend/app/domain/config_store.py`.

---

## D-006 — A `supplier_ranking` table, which the specification's schema does not have
Date: 2026-09-03 · Decided by: Team 4 · Status: accepted

**Decision.** Add `migrations/0016_supplier_ranking.sql`, one row per supplier, rewritten daily by
`recompute_supplier_ranking()`. It holds only the two context-free components of the §12.1 formula —
quality rating at 40 percent and measured delivery speed at 30 percent — renormalised to 100.

**Reason.** §12 defines a ranking and §14 requires a daily job that "recomputes supplier ranking
scores so search results do not have to compute them live". A score has to be stored somewhere and
nothing in §5 holds one. Availability and price are excluded because they depend on what the
customer is currently ordering, so they cannot be precomputed; `domain/ranking.py` applies them per
query.

**Alternatives.** A view (rejected: a view re-runs the aggregate on every read, which is the live
computation §14 rules out). Computing in Python on each search (rejected: same problem, plus it
pulls every order and rating into the application to average them).

**Affects.** Spec §12, §14. `database/migrations/0016_supplier_ranking.sql`,
`database/functions/recompute_supplier_ranking.sql`, `database/policies/catalog.sql`,
`database/ERD.md`, `docs/09-database-build.md`.

---

## D-007 — Three columns on `orders` beyond specification §5.5
Date: 2026-09-03 · Decided by: Team 4 · Status: accepted

**Decision.** `orders.reference` (text, unique, defaulted from a sequence — the `DEL-0001` form),
`orders.idempotency_key` (text, unique, nullable) and `orders.notes` (text, nullable).

**Reason.** `reference` is already displayed on every order card and in `OrderSummary`; deriving it
from a row number would change an existing order's reference when another is deleted. §15.4 requires
sending to be idempotent, and a unique column makes a replayed request fail on the constraint rather
than create a second order — no separate table needed. `notes` is collected by the restock popup per
§6.5 and had nowhere to go.

**Alternatives.** A separate `idempotency_keys` table (rejected: a nullable unique column enforces
the same thing with no extra table). Deriving the reference in the application (rejected: not
stable, and two backends could generate the same one).

**Affects.** Spec §5.5, §6.5, §15.4. `database/migrations/0005_orders.sql`,
`backend/app/core/idempotency.py`, `frontend/src/types/api.ts`.

---

## D-008 — The New supplier threshold is three completed orders, not zero
Date: 2026-09-03 · Decided by: Team 4 · Status: accepted

**Decision.** A supplier shows the "New supplier" badge and receives a neutral score below **three**
completed orders. Stored in `app_config` as `new_supplier_min_orders`.

**Reason.** The specification contradicts itself: §9.2 says show the badge when a supplier has "no
completed orders yet", while §12.2 says "fewer than three completed orders" and explains why. §12.2
is the section that reasons about the failure mode, and a supplier with one order has a score built
on a single rating — exactly the case the badge exists to warn about. It is in `app_config` so it can
be retuned once real ratings exist.

**Affects.** Spec §9.2, §12.2. `database/seeds/app_config.sql`,
`database/functions/recompute_supplier_ranking.sql`, `frontend/src/components/SupplierRow.tsx`.

---

## D-009 — The backend accepts both token signing schemes, chosen by the token
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** `core/security.py` reads the algorithm from the token header. HS256 is verified
against `SUPABASE_JWT_SECRET`; ES256 and RS256 against the project's published JWKS key. Each
algorithm may only ever use its own kind of key.

**Reason.** Our Supabase project signs with ES256, and the backend only accepted HS256, so every
authenticated request failed with "your sign-in could not be verified" even though login worked.
Accepting both means neither an older project nor a newer one has to be reconfigured.

**Alternatives.** Hard-coding ES256 (rejected: breaks any project still on the shared secret).
Turning off verification in development (rejected: the check is the authorisation).

**Affects.** Spec §15.2. `backend/app/core/security.py`, `backend/tests/test_security.py`.

---

## D-010 — `apply_stock_adjustment()` runs as its owner and checks ownership itself
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** The function is `security definer` with `set search_path = public`, and refuses a
stock item whose `owner_id` is not `auth.uid()` unless the caller is the service key.

**Reason.** `policies/sales_data.sql` deliberately gives `stock_adjustments` a read policy and no
insert policy, so the audit trail can only come from this function. But the function ran as the
signed-in shop, so that same policy refused the function's own insert and every quantity change
failed — manual adjustments, sales uploads and delivery receipts alike.

**Alternatives.** Adding an insert policy (rejected: any client could then write audit rows
directly with the anon key, which is exactly what the read-only policy exists to prevent).

**Affects.** Spec §5.10, §15.1. `database/functions/apply_stock_adjustment.sql`.

---

## D-011 — Every write from a screen goes through `useSubmit`
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** Screens do not manage their own `busy` flag around a write. They call
`hooks/useSubmit.ts`, which owns the busy flag and the error message and returns whether the action
succeeded, so the caller navigates only on success.

**Reason.** Nine screens awaited a write with no `catch`. A refused write left the button spinning
for ever and the error reached only the developer console, which hid two real backend bugs for
hours. The shop owner saw nothing at all.

**Alternatives.** A try/catch in each screen (rejected: the same mistake in nine places, and it was
already made in nine places).

**Affects.** `frontend/src/hooks/useSubmit.ts` and every screen that writes.

---

## D-012 — An upload abandoned before it was applied does not block that file
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** The duplicate check in `uploads/service.py` only refuses a file whose earlier upload
was actually applied. An unapplied attempt is deleted and replaced.

**Reason.** The duplicate guard exists so a report cannot reduce stock twice. An upload that failed
before applying reduced nothing, but its row still claimed the file's hash, so the owner could never
retry — and the unique index made a second row impossible.

**Alternatives.** Deleting abandoned uploads on a timer (rejected: more moving parts than the
problem deserves).

**Affects.** Spec §6.6. `backend/app/feeds/customer/uploads/service.py`.

---

## D-013 — A completed order leaves the live sections
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** `CUSTOMER_CONFIRMED` no longer contains `purchased`, so a completed order appears only
under Past orders. The history link is labelled "Past orders" rather than naming only failures.

**Reason.** A completed order showed in both Confirmed and history at once. The supplier groups
already excluded it, and `history.tsx` already stated that completed orders are kept out of the two
live sections — the customer constants simply disagreed with both.

**Affects.** Spec §8.1. `frontend/src/types/orderStatus.ts`, `frontend/app/(customer)/delivery/`.

---

## D-014 — A file upload is read into memory before it is sent
Date: 2026-09-12 · Decided by: Pulindu · Status: accepted

**Decision.** `api/uploads.ts` reads the picked file with `XMLHttpRequest` into a Blob and appends
it to `FormData` as a plain Blob with the filename as the third argument. `api/client.ts` does not
set a JSON content type when the body is `FormData`.

**Reason.** Expo SDK 54+ replaces `fetch` with a WinterCG implementation that rejects React Native's
`{uri, name, type}` part outright, and `append` writes `value.name`, which throws on a `File`
because that property is read-only. The previous code sent only the file's name, so the backend
never received a file at all.

**Alternatives.** `expo-file-system` uploads (rejected: a new dependency for something the existing
runtime can do). Sending base64 in JSON (rejected: changes the endpoint's contract and inflates the
payload by a third).

**Affects.** Spec §6.6. `frontend/src/api/uploads.ts`, `frontend/src/api/client.ts`.
