# What the till changed in the app that already existed

The POS was built as a seventh feed rather than a second product, so most of it is new files in
`frontend/app/pos/`, `frontend/src/pos/` and `backend/app/feeds/customer/pos/`. This document is
about the other part: the thirty-six files that already existed and had to be changed to make room
for it, and why each one moved.

Written for someone reviewing the branch, or picking the project up later. Dated 3 October 2026.

---

## The short version

| Area | What changed | Why |
|---|---|---|
| Accounts | A third role, `cashier`, with an employer | A person at the counter is not the shop owner |
| Backend guards | A new `require_till`; one existing endpoint opened to it | The till needs the stock list and nothing else |
| Stock movement | `apply_stock_adjustment` compares against the shop, not the user | A cashier's sale moves their employer's stock |
| Policies | Read policies for the till, and a tightened update policy on profiles | The database has to know about staff too |
| API client | A timeout, and one retry after a 401 | A till that hangs stops selling |
| Errors | A 500 now carries CORS headers | A 500 a browser cannot read is a 500 nobody can diagnose |
| Web build | Single-page output, a real HTML template, a manifest and a worker | The till is installed on a laptop |
| Reports | A card and a screen for the owner's till view | Someone has to read what the cashiers did |
| Types | Shared shapes gained the POS fields | The app and the backend describe the same bills |
| Tests | A frontend test runner, and rules moved where tests can reach them | The money arithmetic deserved it |

Nothing in ordering, delivery, suppliers, uploads or notifications changed. No existing endpoint
changed its request or response shape. Every existing read still returns what it did.

---

## 1. There is now a third kind of account

**`database/migrations/0029_cashier_accounts.sql`, `backend/app/dependencies.py`,
`frontend/src/types/database.ts`, `frontend/src/hooks/useAuth.ts`,
`frontend/src/stores/authStore.ts`, `frontend/app/index.tsx`**

The app was built around two roles: a shop (`customer`) and a supplier. A till needs a third,
because the person at the counter is not the person who owns the shop, and "hide the tab" is not a
boundary — anyone holding the owner's token could reach everything the owner could.

So `profiles.role` accepts `cashier`, and a cashier row carries `employer_id`: the shop they work
for. From that one column everything else follows:

- the database answers "whose rows may this user read" with `app_shop_id()`, which is
  `coalesce(employer_id, id)` — an owner is their own shop;
- the backend answers the same question with `CurrentUser.shop_id`, the same coalesce;
- the app answers it with `useAuth().shopId`.

Three layers, one rule, written three times on purpose: if the backend alone enforced it, a token
pointed straight at the database would walk round it.

The entry screen gained one line — a cashier is sent to `/pos` instead of the stocks feed — and the
customer tab layout gained a redirect for anyone who types a shop URL by hand.

**Why `Role` did not simply gain a third member:** `Role` is the question the registration screens
ask ("are you a shop or a supplier?"), and nobody signs up as a cashier — the owner creates them.
A separate `AccountRole` keeps the sign-up screens honest.

## 2. One existing endpoint opened up, and the rest stayed shut

**`backend/app/dependencies.py`, `backend/app/feeds/customer/stocks/routes.py`**

`require_customer` refuses a cashier, which is the right default and means every endpoint written
before the till was automatically closed to staff. Exactly one had to open: `GET /customer/stocks`,
because the till searches the shop's products to build a bill. It now names a new `require_till`,
which accepts the owner or one of their cashiers and hands the service `user.shop_id`.

Everything else in that file — adding a product, editing a threshold, adjusting a quantity, reading
the history — kept `require_customer` and answers a cashier `403`.

## 3. Stock movement had to stop assuming the owner

**`database/functions/apply_stock_adjustment.sql`**

Every quantity change in the application goes through this one SQL function, which checks that the
stock row belongs to the caller: `v_owner <> auth.uid()`. That is exactly right while the only
person signing in is the owner, and wrong the moment a cashier sells something — their `auth.uid()`
is their own id, not the shop's.

One line: the comparison is now against `app_shop_id()`. Without it, every cashier sale would have
recorded the bill correctly and silently failed to move any stock — the worst kind of bug, because
the receipt looks right.

## 4. The database learned about staff

**`database/policies/profiles.sql`, `database/policies/stock_items.sql`, migrations 0029 and 0031**

New policies let a cashier *read* their shop's stock, bills, sale lines and till settings. They were
added beside the owner's policies rather than replacing them: policies are OR'd, so the owner's path
is untouched and a mistake in the new ones cannot lock a shop out of its own data. There are no new
write policies at all — every write still goes through the backend with the service key.

Then a review before merging found the other half of the story. `profiles_update_own` let a user
edit their own row and pinned `role`, which was the whole story while role was the only column that
decided anything. Migration 0029 had just added two more:

- `employer_id` decides whose shop every new policy lets you read;
- `is_active` decides whether you may sign in at all.

Neither was pinned. With their own token and no help from the app, a cashier could point
`employer_id` at another shop — reading its stock, its bills and its owner PIN hash — or switch
`is_active` back on after being removed. Both were reproduced against the real project, then closed
by migration 0031, which pins all three. `backend/scripts/try_profile_escalation.py` is the check,
and it is worth re-running after any change to that policy.

## 5. The app's network layer got two hard edges

**`frontend/src/api/client.ts`**

- **A 20-second timeout.** A request that never answers is worse than one that fails: the till's
  send queue waited on it for ever and stopped retrying, so sales sat on the laptop while the shop
  believed they were sent.
- **One retry after a 401.** A screen can mount while the session is still being written; the first
  request after signing in went out with no token. Once, never in a loop, so a real 401 still
  reaches the screen and says "sign in again".

Both are the till's requirements, but every other screen benefits.

## 6. A server error now reaches the screen

**`backend/app/core/exceptions.py`**

A handler registered for `Exception` runs in Starlette's outermost middleware, outside the CORS
middleware — so an unhandled 500 arrived at the browser with no CORS headers, and the browser
reported a CORS failure. That cost a day of looking at CORS configuration while three real sales sat
unsent behind a 500 the till could only read as "Failed to fetch". The handler now adds the headers
itself, for an origin that is actually allowed.

## 7. The web build became something a shop can install

**`frontend/app.json`, `frontend/public/`, `frontend/package.json`, `frontend/scripts/stamp-sw.mjs`**

The till runs on a laptop, so the web build stopped being a side effect and became the product.

- `app.json`: web output changed from `static` to `single`. Static output pre-renders every route in
  Node, where `window is not defined`, and the build crashed.
- Because output is `single`, the HTML template is `public/index.html` (an `app/+html.tsx` is only
  rendered by static output). That template carries the manifest link and registers the service
  worker.
- `public/manifest.webmanifest` and `public/sw.js` make it installable and able to open offline.
- `npm run build:web` runs `scripts/stamp-sw.mjs` afterwards, which writes the build time into the
  worker and the page. Without it the worker's bytes never changed between builds, so no browser
  ever noticed an update — a till served a cached version for days while two builds of fixes sat on
  disk. The stamp is also printed in till settings, so a shop can say which version it is running.

## 8. Small changes to existing screens

- **`frontend/app/(customer)/reports/`** — a card on the Sales tab opening the new **Till — who sold
  what** screen, and the sales tab's copy corrected: it said sales reports were waiting for an
  uploaded POS file, which stopped being true the moment the shop had its own till.
- **`frontend/app/settings/index.tsx` and `profile.tsx`** — "Open the till" is offered to anyone who
  is not a supplier, and the account badge knows about a third role. A cashier who typed `/settings`
  used to be shown the supplier menu and told they held a supplier account.
- **`frontend/src/components/ui/Input.tsx`** — the input can take a `ref`, so the till can put the
  cursor back in the search box after every scan.
- **`frontend/src/components/StockStatusChart.tsx`** — the donut's rotation is written as a plain
  SVG `transform`. On web, `react-native-svg`'s `rotation`/`originX`/`originY` render as a
  `transform-origin` DOM attribute React rejects, and every Stocks render logged a warning. Not a
  POS change at all, but the till is why anyone was looking at the web console.
- **`frontend/src/hooks/useNotifications.ts`, `frontend/src/api/auth.ts`,
  `frontend/src/types/api.ts`** — shared shapes gained the fields the POS needs, and anything that
  switched on two roles now handles three.
- **`frontend/src/stores/authStore.ts`** — the profile is remembered on the device and used when the
  server cannot be reached, so a till that has been signed in all week opens as itself on a dead
  line. It is cleared on sign-out and only ever used for the account whose session is in the
  browser.

## 9. Testing changed shape

**`backend/app/domain/pos.py`, `backend/tests/`, `frontend/package.json`, `frontend/tsconfig.json`**

Two pieces of arithmetic decide money: what the owner reads about their staff, and what the drawer
should hold. Both were written inside functions that also talked to a database or to storage, which
means they could not be tested at all.

- `summarise_till()` moved into `backend/app/domain/pos.py` — rows and limits in, totals out.
- `dayMath.ts` came out of `src/pos/day.ts` for the same reason.
- The frontend got its first test runner (`jest-expo`, `npm test`).

Counts after the branch: **164 backend tests, 15 frontend tests**, neither needing a database.
Three scripts in `backend/scripts/` cover what unit tests cannot — they run against the real project
and put it back as they found it.

---

## Migrations this branch adds

| File | What it does |
|---|---|
| `0025_pos_adjustment_reasons.sql` | `pos_sale` and `return` become reasons a quantity may change |
| `0026_pos_sales.sql` | `pos_sales` and `pos_sale_items`; sales history no longer needs an upload |
| `0027_sales_records_allow_returns.sql` | A sales history row may be negative |
| `0028_pos_settings.sql` | The owner's PIN, the limits, and (now unused) PIN cashiers |
| `0029_cashier_accounts.sql` | The `cashier` role, `employer_id`, `app_shop_id()`, till read policies, `pos_sales.cashier_id` |
| `0030_price_set_at_the_till.sql` | Marks a line the cashier priced because the shop had none |
| `0031_a_profile_cannot_rewrite_its_own_rank.sql` | Pins `role`, `employer_id` and `is_active` against self-promotion |

All seven are applied on the shared project.

## What a reviewer should look at hardest

1. **`dependencies.py`** — the role gates. Everything else trusts them.
2. **Migration 0031** — and whether any future column that decides access is pinned there too.
3. **`apply_stock_adjustment`** — the only place a quantity changes anywhere in the application.
4. **`src/pos/queue.ts`** — the outbox. It is the one piece of code holding sales that exist nowhere
   else yet.

## What this branch does not fix

`bugfix/increase-security` is still unmerged. Until it lands, a signed-in user can write orders,
stock quantities and supplier ratings straight to PostgREST with their own token, skipping every
rule the backend enforces. That is a larger hole than anything described above, and it predates the
till.
