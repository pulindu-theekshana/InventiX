-- Till settings: who may use it, and what needs the owner
--
-- Purpose : The cashiers of one shop, the owner's PIN, and the limits above which a discount or a
--           return needs the owner. One row per shop.
-- Spec    : Section 6.6
-- Look here when : The till asks for a PIN it should not, or a cashier cannot start a shift.

-- On the shop's record rather than on the laptop, for two reasons: a browser's storage can be
-- cleared, which would quietly remove every lock; and an owner changing a limit should not have
-- to walk to the counter to do it.
--
-- PINs are stored as SHA-256 hashes, hashed on the device, so the server never sees the number.
-- Honest about what that is worth: a four digit PIN has ten thousand possibilities, so this is a
-- lock on the screens, not a secret. The boundary that holds is a separate cashier account.

create table pos_settings (
  owner_id        uuid        primary key references profiles(id) on delete cascade,

  -- Null until the owner sets one. With no PIN the till does not lock, which is the right
  -- default for a one-person shop that has no cashier to lock out.
  owner_pin_hash  text,

  -- A discount or a refund at or below these goes through; above them the owner is asked.
  -- Zero means "ask me every time", which is a legitimate choice for a small counter.
  discount_limit  numeric(12,2) not null default 100 check (discount_limit >= 0),
  return_limit    numeric(12,2) not null default 500 check (return_limit >= 0),

  -- [{ "name": "Nimal", "pin_hash": "..." }]. A handful of people per shop, so a table of their
  -- own would be three joins for nothing. They are not accounts: they name who is at the till.
  cashiers        jsonb       not null default '[]'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger pos_settings_updated_at before update on pos_settings
  for each row execute function set_updated_at();

alter table pos_settings enable row level security;

-- Read your own; writes go through the backend with the service key, as migration 0024 set out.
create policy pos_settings_read_own on pos_settings
  for select using (owner_id = auth.uid());

notify pgrst, 'reload schema';
