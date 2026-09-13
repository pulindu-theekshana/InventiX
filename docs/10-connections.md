# How the three layers connect

What actually talks to what, through which file, using which key. `01-architecture.md` states the
rules; this document traces the wiring as it is built.

## The shape: a triangle, not a chain

Most systems are a chain — app talks to backend, backend talks to database, and the app never sees
the database. InventiX is not that:

```
                        React Native app
                        (phone, Expo Go)
                               |
              +----------------+----------------+
              |                                 |
        (1) anon key                      (2) Bearer token
            auth . realtime                   27 endpoints
            own profile row                   HTTP + JSON
              |                                 |
              v                                 v
      +-----------------+             +--------------------+
      |    Supabase     | <---------- |  FastAPI backend   |
      |   PostgreSQL    |     (3)     |                    |
      |                 | service_role|  every write       |
      |   RLS APPLIES   | RLS BYPASSED|  every rule        |
      +-----------------+             +--------------------+
```

The app has **two** outbound connections, not one. Understanding why is most of understanding the
architecture.

The reason is in specification §3.1: row level security makes direct reads safe, so the app is
allowed to read Supabase itself and to subscribe to realtime. Anything with a *side effect* must go
through FastAPI, because that is where the rules live and where the secrets live.

## Edge 1 — App to Database, directly

**File:** `frontend/src/lib/supabase.ts`
**Key:** the `anon` public key, from `EXPO_PUBLIC_SUPABASE_ANON_KEY`
**Protected by:** row level security, on every query

Three uses, and at the moment only three:

| Use | Where in the code |
|---|---|
| Sign in, sign up, sign out, token refresh | `stores/authStore.ts` |
| Reading your own `profiles` row to learn your role at launch | `stores/authStore.ts` — the only direct table read in the whole app |
| Realtime subscriptions on `orders` and `stock_items` | `hooks/useRealtime.ts` |

### Why only three, when §3.1 allows more

§3.1 *permits* the app to read Supabase directly for display. That permission is deliberately not
used. Every list, card and number goes through the backend instead.

The reason is one field: `StockItemView.status`. The pie chart and the two list sections both read
it, and it is derived from a three-way rule about quantity, threshold and whether an open order
exists. If the app ran its own query and derived it independently, the chart could say four items
are low while the list below shows three — and both would look correct in isolation. One rule, one
place, and that place is `backend/app/domain/stock.py`.

The cost of that choice is real: the app cannot display anything without the backend running.

### How realtime actually works

PostgreSQL writes every change to a write-ahead log for crash recovery. Supabase tails that log and
pushes changes to subscribers. So when a supplier advances an order, the customer's screen updates
without a refresh.

`useRealtime` only ever triggers a **refetch**. It never applies the change itself:

```ts
useRealtime('orders', null, orders.refresh);
```

Reads may be direct; conclusions may not. The refreshed data still comes back through the backend,
which is what keeps `status` derived in one place.

## Edge 2 — App to Backend

**File:** `frontend/src/api/client.ts`
**Base URL:** `EXPO_PUBLIC_API_URL`
**Callers:** 12 API files, 43 endpoints

One `fetch()` wrapper. Every request looks like this:

```
POST http://192.168.1.5:8000/customer/ordering/send
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
Content-Type: application/json
Idempotency-Key: m8x2k9qp4a7f
```

On a phone, `localhost` is the phone itself. During development `EXPO_PUBLIC_API_URL` must be the
**LAN address of the machine running FastAPI**, not localhost. This is the single most common reason
a working backend appears to be unreachable.

While that variable is unset, `client.ts` serves fixture data instead and no request is made at all.

## Edge 3 — Backend to Database

**File:** `backend/app/core/supabase.py`
**Key:** the `service_role` key, from `backend/.env`
**Protected by:** nothing. That is the point.

| | Key used | PostgreSQL role | Row level security |
|---|---|---|---|
| App | `anon` | `authenticated` | **applies** — you see only your own rows |
| Backend | `service_role` | `service_role` | **bypassed entirely** |

`BYPASSRLS` is a PostgreSQL role attribute, not a Supabase convention. Every policy in
`database/policies/` is simply skipped for the backend.

This is deliberate and necessary — the backend must write `profiles.role`, which no client is
allowed to write — but it has a consequence that must be understood: **the backend receives no
protection from the database at all.** Every check the database would have made, the backend has to
make itself. That is what specification §15.2 requires and what `backend/app/dependencies.py` exists
to do.

It is also why the `service_role` key must never appear in the app. A React Native bundle can be
unpacked from an installed APK in minutes, and that key would hand the holder the entire database.

## One token, two edges

This is the part that ties the triangle together, and it is easy to miss.

```
1. App signs in              Supabase Auth returns a JWT
2. App stores it             AsyncStorage. Survives the app being closed
3. App calls the backend     client.ts pulls that same JWT, attaches it as Bearer
4. Backend decodes it        gets user id, looks up role   -> core/security.py
5. App queries Supabase      auth.uid() reads that same JWT -> RLS filters the rows
```

**One login produces one token, and it satisfies both the backend's authorisation check and the
database's row filter.** There is no second login, no API key of your own, no session to keep in
sync between two systems.

Notice step 3 carefully: the app-to-backend edge **depends on** the app-to-database edge.
`client.ts` cannot build a request header without first asking Supabase for the current session:

```ts
async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

So if Supabase is unreachable, backend calls do not merely lose their identity — they go out
unauthenticated and come back 401.

## Traced: sending a restock order

The most consequential action in the application, through every file it touches. This single flow
uses all three edges.

| # | Layer | What happens |
|---|---|---|
| 1 | Screen | `RestockPopup.tsx` — the customer taps **Send**; the channel chooser opens |
| 2 | Screen | `handleSend('whatsapp')` calls `sendOrder(draft, channel, idempotencyKey)` |
| 3 | API file | `api/ordering.ts` builds the body and calls `request('/customer/ordering/send', …)` |
| 4 | **Edge 1** | `client.ts` calls `supabase.auth.getSession()` to get the JWT |
| 5 | **Edge 2** | `fetch()` sends POST with `Authorization` and `Idempotency-Key` |
| 6 | Backend | `feeds/customer/ordering/routes.py` — parses the body against `schemas.py`, checks the caller is a customer via `dependencies.py` |
| 7 | Backend | `service.py` re-validates every line against the supplier's listing. **The app's validation does not count** — the quantity may have changed since the popup opened |
| 8 | Backend | `core/idempotency.py` checks whether this key has been seen |
| 9 | Backend | `domain/message_builder.py` and `domain/order_state_machine.py` produce the message and confirm `requested` is a legal starting state |
| 10 | **Edge 3** | `core/supabase.py` writes with the service key: one `orders` row, one `order_items` row per product, and `restock_requested = true` on each stock item — in one transaction |
| 11 | Database | Constraints fire: the `status` check, the `idempotency_key` unique index, `check (status <> 'rejected' or rejection_reason is not null)`, both foreign keys to `profiles` |
| 12 | Database | The `reference` default pulls `DEL-0007` from `order_reference_seq` |
| 13 | Backend | Queues the WhatsApp send through `integrations/queue.py`. **If WhatsApp is down the order still exists** and the message retries (§15.4) |
| 14 | Response | `201 { "order_id": "…" }` travels back up |
| 15 | Screen | `draftStore.closeDraft()`, then `router.push('/(customer)/delivery/' + orderId)` |
| 16 | **Edge 1, other device** | On the supplier's phone, `useRealtime('orders')` sees the insert arrive through the write-ahead log and calls `orders.refresh()` — which fetches through edge 2 again |

Step 7 is the one worth remembering. The popup already validated the quantity and disabled Send if
it was too high — and the backend checks again anyway, because between the popup opening and Send
being tapped, another shop may have bought the stock.

## Traced: opening the Stocks screen

The read path, which is shorter and shows why the backend sits in the middle of it.

| # | Layer | What happens |
|---|---|---|
| 1 | Screen | `app/(customer)/stocks/index.tsx` mounts and calls `useStocks()` |
| 2 | Hook | `hooks/useStocks.ts` wraps `useAsync(() => listStocks())`, which owns loading, error and refresh |
| 3 | API file | `api/stocks.ts` — if `useMockData`, return the fixture and stop here. Otherwise `request('/customer/stocks')` |
| 4 | **Edge 1** | Token fetched from the session |
| 5 | **Edge 2** | `GET /customer/stocks` |
| 6 | Backend | `routes.py` confirms the caller is a customer, calls `service.py` |
| 7 | **Edge 3** | One query joining `stock_items` to `product_catalog`, `profiles` and `supplier_listings`. Both supplier joins are `LEFT` — an item with no preferred supplier is normal and must still appear |
| 8 | Backend | `domain/stock.py` derives `status` for each row: `in_stock`, `low_stock` or `restock_requested` |
| 9 | Backend | `schemas.py` serialises to `StockItemView[]` |
| 10 | Screen | `StockStatusChart` reads the summary; `StockRow` renders each item; the badge colour comes from `status` |

Step 8 is where the design decision from Edge 1 pays off. Because `status` is computed once here,
the chart and the list can never disagree.

## Which edge is broken

The symptom usually names the edge before you open anything.

| Symptom | Edge | Open this |
|---|---|---|
| Login fails, but the app otherwise runs | 1 | `lib/supabase.ts`, and check the Supabase URL and anon key |
| Login works; **every** screen is empty or erroring | 2 | `EXPO_PUBLIC_API_URL` — almost always `localhost` where it should be the LAN IP |
| Login works; **one** screen is empty, the rest are fine | 2 | That feed's `service.py` |
| Every API call returns 401 although you are signed in | 1 then 2 | The token was not attached, or expired. Check the `AppState` auto-refresh listener in `lib/supabase.ts` |
| Every API call returns 403 | 2 | `dependencies.py` — the role check, not the token |
| Writes return 500 | 3 | The `service_role` key, or a constraint refusing the row. Read the Postgres error, not the FastAPI one |
| Data loads but never updates live | 1 | `hooks/useRealtime.ts`, and whether realtime is enabled for that table in Supabase |
| **You can see another shop's data** | 1 | A missing or wrong policy in `database/policies/`. Stop and run the six-step check in `09-database-build.md` Part 5 |

The last row is the only one that is an emergency. Everything above it is a bug; that one is a data
breach, and it is invisible until somebody looks.

There is a reason it belongs to edge 1 rather than the backend: the app reads Supabase directly, so
a missing policy is not something FastAPI can protect you from. It never sees the query.

## What is connected today

Everything, for the customer side. Verified on a phone against the real backend and the real
database on 12 September 2026.

| Edge | Status |
|---|---|
| 1 — App to Database | **Live.** The Supabase project exists, the schema and seeds are applied, both demo accounts sign in, and realtime is switched on for the four tables the app subscribes to (`migrations/0019_realtime.sql`) |
| 2 — App to Backend | **Live for the customer side.** `EXPO_PUBLIC_API_URL` is set, so `useMockData` is false and every `api/*.ts` calls the backend. Auth, catalog, stocks, suppliers, ordering, delivery and uploads have each been walked through on a phone |
| 3 — Backend to Database | **Live.** `backend/.env` holds the project URL and the service key; every feed reads and writes real rows |

The supplier side (listings, orders, supplier delivery) uses the same three edges and the same
client, but has not been walked through yet.

### The `useMockData` trap, and why it stopped being one

`client.ts` still has a single global flag:

```ts
export const useMockData = !API_BASE_URL;
```

The original worry was that setting the variable would send all twelve feeds at a backend where
only three existed. That never happened: the backend was finished before the variable was set, so
all 43 endpoints answered from the first request. The flag can stay as it is.

What the flag now protects against is subtler. If `EXPO_PUBLIC_API_URL` is ever missing — a fresh
clone, a forgotten `--clear`, a teammate who copied `.env.example` — the app silently shows invented
data instead of failing. Only one screen (`stocks/index.tsx`) renders `MOCK_NOTICE`, so on the other
fourteen it looks entirely normal. Worth making that case loud before anyone demonstrates this app.

### Lessons from lighting the edges

Three failures cost hours, and none of them looked like what they were:

- **Edge 1 to 2.** Login succeeded while every request came back 401. The token was fine; the
  backend was verifying it with the wrong algorithm (D-009).
- **Edge 3.** Sends and quantity changes returned 500 from inside SQL: one ambiguous column name
  (D-010 concerns the other, a policy refusing the function that exists to satisfy it). Neither was
  reachable by the backend tests, which run without a database.
- **Edge 2.** A file upload sent the file's name only, and Expo's replacement `fetch` rejected the
  React Native form part outright (D-014).

The pattern worth remembering: the backend terminal named the cause every time, in one line, and
guessing from the phone's error message never did.

## The two rules this document exists to protect

**Reads may be direct; writes may not.** The app may query Supabase and subscribe to realtime,
because row level security makes that safe. Anything that changes a quantity, a status or a message
goes through FastAPI, because that is where the rules and the secrets live.

**The app is never trusted.** It may send a request; it may not decide whether it is allowed. Every
endpoint re-checks identity and role from the token, and for the direct edge the database re-checks
through row level security. Hiding a tab is a convenience for the user, not a security control.
