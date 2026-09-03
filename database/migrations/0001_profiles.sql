-- profiles table
--
-- Purpose : One row per user, id matches the Supabase auth user id. Holds role and the role-specific fields.
-- Spec    : Section 5.1
-- Look here when : A user field is missing or the role is wrong.

-- ---------------------------------------------------------------------------
-- Shared helper, defined here because 0001 is the first file to run and every
-- table below needs it. `updated_at default now()` only fires on insert; SQL has
-- no "on update" for a default, so without this trigger every row would claim it
-- was last touched on the day it was created.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table profiles (
  -- Not generated. Must equal the Supabase auth user id, which is what ties a
  -- login to a profile. on delete cascade removes the profile with the account.
  id               uuid primary key references auth.users(id) on delete cascade,

  -- Decides which navigation graph loads, which endpoints the caller may reach,
  -- and which policies apply. Spec 4.2 fixes it at registration.
  role             text        not null check (role in ('customer', 'supplier')),

  business_name    text        not null,
  contact_person   text        not null,
  phone            text        not null,
  whatsapp_number  text,
  email            text        not null,
  address          text,
  city             text,

  -- Suppliers only (spec 4.1 step 6). Null for every customer row. An array
  -- rather than a join table because the list is short, never queried on its
  -- own, and only ever read whole.
  delivery_areas   text[],

  -- Lets an account be disabled without deleting it and orphaning its orders.
  is_active        boolean     not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A customer with delivery areas is a data error, not a shrug.
  constraint delivery_areas_are_supplier_only
    check (role = 'supplier' or delivery_areas is null)
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Customers browse suppliers by name; suppliers are never listed by customer.
create index profiles_supplier_name on profiles (business_name) where role = 'supplier';
