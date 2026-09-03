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
