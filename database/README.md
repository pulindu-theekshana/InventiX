# InventiX database

Supabase (PostgreSQL). Schema, row level security policies and seed data.

## Applying it

Run in this order, in the Supabase SQL editor or through the Supabase CLI:

1. `migrations/` — `0001` through `0016`, **in numerical order**. They have foreign key
   dependencies, so order is not optional.
2. `functions/` — both files. `policies/profiles.sql` defines `auth_role()` which the other
   policies call, and `seeds/demo_data.sql` calls `apply_stock_adjustment()`, so the functions
   have to exist before either.
3. `policies/` — every file, starting with `profiles.sql` because it defines `auth_role()`.
   Until these run, any signed-in user can read any row.
4. `seeds/product_catalog.sql`, `seeds/seasonal_events.sql`, `seeds/app_config.sql`.
5. `seeds/demo_data.sql` — only for demonstrations, never on a real database. It needs two
   Supabase auth users to exist first; the file explains which and how.

Then regenerate the frontend types:

```bash
npx supabase gen types typescript --project-id <id> > ../frontend/src/types/database.ts
```

## The rule about changing the schema

**A migration is never edited after it has been run.** Changing a table means writing the next
numbered file, `0017_...sql`. This keeps the database rebuildable from zero, gives every change a
date and an author in git, and means nobody's local database silently disagrees with anybody else's.

## Why policies are separate from tables

Row level security is the part most likely to be wrong and hardest to notice: a missing policy is
invisible until a supplier can read a shop's sales history. Keeping the policies in one folder means
they can be reviewed as a set against specification §15.1, which is exactly how they should be
checked before submission.

## The table that holds everything together

`product_catalog`. Customer stock items and supplier listings both point at it instead of storing
product names as text. If a shop types "Rice 5kg" and a supplier types "5kg rice bag", nothing can
ever match them — so supplier search, ranking and POS report matching would all fail at once.
Users pick from the catalog; they never type a product name. (Spec §5.2)
