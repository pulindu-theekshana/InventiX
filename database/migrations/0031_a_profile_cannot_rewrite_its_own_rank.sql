-- A profile cannot change what it is, or who it works for
--
-- Purpose : Pins the three columns that decide what an account may reach, so the row that grants
--           access cannot grant itself more.
-- Spec    : Section 15.1
-- Look here when : An account reaches another shop's data, or a removed cashier can sign in again.

-- profiles_update_own (policies/profiles.sql) let a user edit their own row and pinned `role`,
-- which was the whole story while role was the only column that decided anything. Migration 0029
-- added two more:
--
--   employer_id  -> app_shop_id() -> which shop's rows every policy lets this user read
--   is_active    -> whether get_current_user() lets them in at all
--
-- Neither was pinned, so with their own token and no help from the app a cashier could:
--   * set employer_id to another shop's id and read that shop's stock, bills and till settings --
--     including the owner PIN hash -- and have the backend sell into it as them;
--   * set is_active back to true after the owner removed them, and sign in again.
--
-- The app never does either. A person holding the token could, which is the only test that counts.
-- `is not distinct from` rather than `=`, because employer_id is null for every owner and
-- `null = null` is null, which a check constraint reads as "no".

drop policy profiles_update_own on profiles;

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

notify pgrst, 'reload schema';
