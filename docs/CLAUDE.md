# InventiX — notes for AI assistants

Mobile inventory app for Sri Lankan grocery shops. Three parts: `frontend/` (React Native,
Expo SDK 57, expo-router), `backend/` (FastAPI, Python), `database/` (Supabase Postgres).

Read `docs/00-INDEX.md` first for the full documentation set. This file is the short version
plus the traps already discovered, so they are not rediscovered one 500 at a time.

## Architecture rules that must not be broken

- **Every write goes through the backend.** The app may read Supabase directly and subscribe to
  realtime, because row level security makes that safe. Nothing with a side effect may go direct.
- **The app is never trusted.** Identity comes from the JWT, never from the request body. Role is
  read from `profiles`, never from what the client claims. Hiding a tab is a convenience, not a
  control — every endpoint re-checks (`app/dependencies.py`).
- **The `service_role` key never appears in the frontend.** Anything prefixed `EXPO_PUBLIC_` is
  compiled into the installed app and can be unpacked from it.
- **One rule, one place.** `StockItemView.status` is derived in `domain/stock.py` only, so the pie
  chart and the list can never disagree. Do not recompute derived values in the app.

## Database — already built, do not rebuild

The whole team shares **one** Supabase project. Everyone's app and backend point at it, so a change
made once is a change for everybody. As of 12 September 2026 it already holds:

- migrations `0001`–`0022` (0021 and 0022 were pasted into the SQL editor by hand, then `notify pgrst, 'reload schema';`), both files in `functions/`, all of `policies/`
- seeds `product_catalog` (36 products), `seasonal_events`, `app_config`
- `demo_data`: two auth users (`wasantha.kade@inventix.lk` shop, `demo.supplier@inventix.lk`
  supplier), 4 stock items, 4 supplier listings, 2 orders, 1 rating

**Do not re-run any of it** unless a specific instruction says so. What happens if you do:

| File | Re-running it |
|---|---|
| `migrations/*` | Errors with "already exists". Harmless, but it is not a fix — the schema is current. |
| `functions/*`, `policies/*` | `create or replace` is safe; a `create policy` errors if it exists. Re-run these when a fix changes them. |
| `seeds/product_catalog`, `seasonal_events`, `app_config` | Safe, all guarded with `on conflict`. |
| **`seeds/demo_data.sql`** | **Not safe.** Its `orders`, `order_items` and `supplier_ratings` inserts have no conflict guard, so a second run creates duplicate orders and a duplicate rating — which quietly skews the supplier's score and measured delivery time. Only ever run against an empty database. |

New test accounts are made through the app's Register screen, never by SQL. The UUIDs at the top of
`demo_data.sql` are placeholders that only fit one project — leave them as placeholders in git.

## Where things live, per feed

| Layer | Path |
|---|---|
| Screen | `frontend/app/(customer)/…` or `frontend/app/(supplier)/…` |
| Request | `frontend/src/api/<feed>.ts` (all through `api/client.ts`) |
| Shape the app expects | `frontend/src/types/api.ts` |
| Routes | `backend/app/feeds/<role>/<feed>/routes.py` |
| Shape the backend sends | `backend/app/feeds/<role>/<feed>/schemas.py` |
| Logic | `backend/app/feeds/<role>/<feed>/service.py` |
| Cross-feed rules | `backend/app/domain/` |

Every file starts with a header naming its purpose, its spec section, and the symptom that should
send someone to it. Keep that style when adding files.

## Running it

```bash
# backend (from backend/, venv active)
.venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # 0.0.0.0 or phones cannot reach it

# frontend (from frontend/)
npx expo start --clear     # --clear or EXPO_PUBLIC_* changes are not picked up
```

Checks to run before claiming something works:

```bash
cd backend && .venv\Scripts\python.exe -m pytest -q     # 119 tests, no database needed
cd frontend && npx tsc --noEmit
```

`.env` files are gitignored and must stay that way. `EXPO_PUBLIC_API_URL` must be the LAN IP of the
machine running FastAPI — `localhost` is the phone itself. While it is unset, `api/client.ts` serves
fixture data and makes no request at all (`useMockData`).

## Traps already hit — do not rediscover these

**Expo's fetch is not React Native's.** Expo SDK 54+ installs a WinterCG fetch. It rejects the old
`{uri, name, type}` FormData part outright (see `expo/src/winter/fetch/convertFormData.ts`). A file
upload must read the file into a Blob first (XHR handles `file://`, fetch does not) and append it as
a **plain Blob with the filename as the third argument** — a `File` throws, because `append` writes
`value.name` and `File.name` is read-only. See `src/api/uploads.ts`.

**`request()` must not force JSON on FormData.** Multipart writes its own content type with a
boundary.

**PL/pgSQL `RETURNS TABLE` names are variables inside the body.** `create_order` returns
`(order_id, reference)`, so an unqualified `returning reference` was ambiguous with the `reference`
column (error 42702) and every send failed. Qualify as `returning orders.reference`. Tests did not
catch it: the 119 backend tests run without a database.

**`stock_adjustments` has a read policy and no insert policy, on purpose** — the audit trail is only
trustworthy if rows come from `apply_stock_adjustment()` and nowhere else. That function therefore
must be `security definer` and must check ownership itself against `auth.uid()`. Without it, every
quantity change fails: manual adjustments, sales uploads and delivery receipts alike.

**Realtime needs the table added to the publication.** Subscriptions otherwise connect, report no
error, and never fire. See `migrations/0019_realtime.sql`.

**One channel name per `useRealtime` call.** Three screens listen to `orders`; sharing a name makes
the second one attach to a channel that has already subscribed, which realtime refuses.

**Supabase signs tokens with ES256 here, not HS256.** `core/security.py` picks the key by the
token's own algorithm — HS256 against the shared secret, ES256/RS256 against the JWKS. Never let a
token choose a key type it was not signed with.

**Route handlers and dependencies are `def`, never `async def`.** supabase-py is blocking. Inside
`async def` it blocks the event loop, so the whole backend serves one request at a time and every
screen that fires several requests at once crawls. Plain `def` runs in FastAPI's thread pool. Read an
upload with `file.file.read()`, not `await file.read()`.

**Google sign-in in Expo Go returns to `localhost:3000`.** Supabase's Redirect URLs allow-list did
not match the `exp://<ip>:8081/--/` address, even entered exactly, so it fell back to the Site URL.
Workaround for testing: set the Site URL itself to `exp://<laptop ip>:8081/--/` (changes with the
network). For a real build set it to `inventix://`.

**Upload rows live in memory between steps** (`_pending` in `uploads/service.py`). Editing a backend
file restarts uvicorn and loses them, so do not edit the backend while someone is mid-upload.

## Conventions

- **A migration is never edited after it has run.** Write the next numbered file. `database/functions/`
  and `database/policies/` are `create or replace` definitions and *are* edited in place.
- **Writes from a screen go through `hooks/useSubmit.ts`.** It keeps the busy flag and the error
  message in step. Without it a refused write leaves the button spinning for ever and the error
  reaches only the console. `app/(customer)/stocks/add.tsx` is the reference.
- One commit per feed. Never commit `.env`, and keep the placeholder UUIDs in
  `database/seeds/demo_data.sql` — real ones only fit one Supabase project.
- Prefer fixing the root cause in `service.py` over correcting a number in the app. The app shows
  what the backend sends.

## Known gaps (not bugs to "fix" silently — they are unbuilt)

- A rating is never saved. `RatingPrompt` collects a score and discards it; there is no endpoint.
- No way to change a saved POS product match (`pos_product_aliases`) once made.
- "My profile", "Change password" and "Help and support" in Settings have no screens.
- Push notifications are off: no Firebase credentials, and Expo Go cannot receive push anyway.
- These screens still write without `useSubmit`, so they freeze on a refusal:
  `(supplier)/listings/add.tsx`, `(supplier)/listings/[id].tsx`, `(supplier)/orders/[id].tsx`,
  `settings/index.tsx`.
- Fixture data still sits in `src/api/*.ts`. It is unreachable while `EXPO_PUBLIC_API_URL` is set.
  If deleting it, note that `REPORT_SECTIONS` and `CATALOG` are imported by real screens.

## Status

Customer side integrated and tested against the real backend: auth, catalog, stocks, suppliers,
ordering, delivery, uploads. Supplier side (listings, orders, supplier delivery) is not yet tested.
`docs/11-integration-plan.pdf` has the full plan; `docs/05-changelog.md` and `docs/10-connections.md`
still describe the pre-integration state and need updating.
