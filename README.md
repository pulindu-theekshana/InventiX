# InventiX

Mobile inventory management for small and medium grocery businesses in Sri Lanka.
Team 4 — Member P, Member R, Member N, Member I. Target completion 14 September 2026.

## The three folders

| Folder | What lives here | Language |
|---|---|---|
| `frontend/` | The React Native app both roles install. Screens, components, API calls. | TypeScript, Expo, expo-router |
| `backend/` | Every business rule, message, ranking calculation and scheduled job. | Python, FastAPI |
| `database/` | Schema migrations, row level security policies, seed data. | SQL, Supabase Postgres |

## Where to start reading

1. `docs/01-architecture.md` — how the three talk to each other and the rules that must not be broken.
2. `docs/02-file-structure.md` — where every kind of file belongs and why.
3. `docs/03-bug-map.md` — **when something is broken, start here.**

## The one rule that matters most

The app never calls WhatsApp, email or any external service directly, and never performs a
write with business consequences except through the backend. Reads for display may go
straight to Supabase, protected by row level security. See `docs/01-architecture.md`.
