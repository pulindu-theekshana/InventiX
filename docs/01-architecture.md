# Architecture

## The shape of the system

```
   React Native app  ──── reads for display ────►  Supabase (Postgres)
   (Expo, TypeScript)                                    ▲
          │                                              │
          │  everything with a side effect               │  all writes
          ▼                                              │
      FastAPI backend  ─────────────────────────────────┘
          │
          ├──► WhatsApp Business API
          ├──► Email service
          └──► Firebase Cloud Messaging
```

## Rules that must not be broken

**1. Secrets never enter the app.** WhatsApp, email and Firebase credentials live only in the
backend environment. A JavaScript bundle can be unpacked from an installed APK in minutes, so
anything shipped inside it is public. (Spec §15.3)

**2. Every rule exists in exactly one file.** What counts as low stock, which order transitions
are legal, how suppliers are ranked, how a restock message reads — each of these is defined once,
in the backend, in the file named in `03-bug-map.md`. This is not tidiness for its own sake: it
is what makes a bug fixable in one place instead of four.

**3. The app is never trusted.** It may send a request; it may not decide whether it is allowed.
Every endpoint re-checks identity and role from the token, and the database re-checks again through
row level security. Hiding a tab is a convenience for the user, not a security control. (Spec §15.2)

**4. Reads may be direct, writes may not.** The app can query Supabase for display and subscribe
to realtime updates, because RLS makes that safe. Anything that changes a quantity, a status or a
message goes through FastAPI. (Spec §3.1)

## The three layers inside every backend feed

Each feed is a folder containing exactly three files. This is the refinement of "one file per feed":
one file per feed proved too coarse, because a feed contains three genuinely different kinds of code
that fail in three different ways.

| File | Contains | Never contains |
|---|---|---|
| `routes.py` | URL paths, HTTP methods, status codes, dependency declarations. Parses the request, calls the service, returns the result. | Business logic, database queries. |
| `service.py` | The actual work: queries, orchestration, calls into `domain/`. | HTTP concepts. It does not know what a status code is. |
| `schemas.py` | Pydantic models describing what goes in and what comes out. | Logic of any kind. |

**Why this matters for debugging.** The symptom tells you the file before you open anything:

- Wrong status code, 404, route not found, request body rejected → **routes.py**
- Right response shape but wrong data in it → **service.py**
- The app says a field is missing or undefined → **schemas.py**

## The `domain/` layer

Some rules belong to no single feed. The order state machine is used by the customer delivery
feed *and* the supplier orders feed *and* the supplier delivery feed *and* the auto-confirm job.
If each wrote its own transition checks, they would drift apart, and the bug would be "the supplier
app allows something the customer app forbids" — the worst kind, because nothing looks wrong in
either file alone.

So cross-cutting rules live in `backend/app/domain/`, and feeds call into them. Nothing in `domain/`
knows about HTTP or about which feed is asking.

## Frontend mirrors backend

`frontend/src/api/` has one file per backend feed, with matching names. `stocks.ts` calls
`feeds/customer/stocks/`. When a screen shows wrong data, the trail is: screen → `src/api/x.ts` →
`feeds/.../x/routes.py` → `service.py`. Four hops, each one obvious.
