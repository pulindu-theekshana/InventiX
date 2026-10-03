-- profiles RLS
--
-- Purpose : Own profile readable and writable. Supplier public business fields readable by any authenticated user.
-- Spec    : Section 15.1
-- Look here when : A user reads a profile they should not.

-- ---------------------------------------------------------------------------
-- Shared helper. Several policy files need the caller's role, and written inline
-- that becomes a subquery repeated across nine files -- repeated conditions drift.
--
-- security definer is required: this function reads profiles, and without it the
-- caller's own policy on profiles would apply recursively and deadlock the check.
-- ---------------------------------------------------------------------------
create or replace function auth_role() returns text
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

alter table profiles enable row level security;

-- Your own row, whole.
create policy profiles_read_own on profiles
  for select using (id = auth.uid());

-- Spec 15.1: any authenticated user may read a supplier's public business
-- fields, because customers must be able to browse suppliers. Column-level
-- restriction is not available in RLS, so the service layer selects only the
-- public columns -- the sensitive ones on a supplier profile are the same
-- contact details a customer needs anyway.
create policy profiles_read_suppliers on profiles
  for select using (role = 'supplier');

-- using decides which row you may touch; with check decides what it may look
-- like afterwards. Both are needed: using stops you editing someone else's row,
-- with check stops you changing your own role.
-- Every column that decides what this account may reach is pinned here: role (which graph it
-- loads), employer_id (whose shop its policies read, migration 0029) and is_active (whether it may
-- sign in at all). Migration 0031 added the last two after a review found that a cashier could
-- move themselves to another shop, or undo their own removal, with their own token.
create policy profiles_update_own on profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and employer_id is not distinct from
        (select p.employer_id from profiles p where p.id = auth.uid())
    and is_active is not distinct from
        (select p.is_active from profiles p where p.id = auth.uid())
  );

-- There is deliberately NO insert policy, and that absence is load-bearing.
-- It is what forces registration through POST /auth/profile, where the backend
-- writes the role with the service key. A client that can insert its own profile
-- row can grant itself a supplier account, and every check below that point
-- becomes decorative.
--
-- There is also no delete policy. Deleting the auth user cascades to the profile.

-- ---------------------------------------------------------------------------
-- Migration 0029: cashier accounts.
--
-- coalesce(employer_id, id): an owner is their own shop, a cashier works for one. Every policy
-- that used to ask "is this row yours" now asks "is this row your shop's", in one place.
create or replace function app_shop_id() returns uuid
language sql stable security definer set search_path = public
as $$ select coalesce(employer_id, id) from profiles where id = auth.uid() $$;

-- So the till can show the shop's name while a cashier is signed in.
create policy profiles_read_employer on profiles
  for select using (id = app_shop_id());
