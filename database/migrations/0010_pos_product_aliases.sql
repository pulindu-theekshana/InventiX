-- pos_product_aliases table
--
-- Purpose : Maps a shop's POS product names to catalog products, once, forever.
-- Spec    : Section 5.9
-- Look here when : A mapped product is unmatched again.

-- Built once by the shop owner and reused on every later upload. This is why the
-- unmatched list shrinks toward nothing: matching "RICE-NADU-5KG" is a one-time
-- cost, not a per-upload chore.

create table pos_product_aliases (
  id                 uuid        primary key default gen_random_uuid(),

  -- Per shop, not global. Two shops may export the same product under different
  -- names, and one shop's naming must never leak into another's matching.
  customer_id        uuid        not null references profiles(id) on delete cascade,

  -- Exact text as it appears in the POS export, for example "RICE-NADU-5KG".
  pos_product_name   text        not null,
  catalog_product_id uuid        not null references product_catalog(id),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint one_alias_per_name_per_shop unique (customer_id, pos_product_name)
);

create trigger pos_product_aliases_updated_at before update on pos_product_aliases
  for each row execute function set_updated_at();
