-- app_config table
--
-- Purpose : Tunable values the spec says must not be hard coded: ranking weights, unanswered-order limit, auto-confirm delay.
-- Spec    : Section 12.1 and 17
-- Look here when : A tuned value has no effect.

-- Spec 12.1 and 17 both require these to be tunable without a release. A literal
-- in Python is not tunable; it is a redeploy. Read through
-- backend/app/domain/config_store.py, never with a direct query from a feed.

create table app_config (
  key         text        primary key,

  -- jsonb rather than text so a weight stays a number and a list stays a list.
  -- Every reader would otherwise have to know how to parse its own value.
  value       jsonb       not null,

  -- What this key does, in words, so nobody has to guess before changing it.
  description text        not null,

  updated_at  timestamptz not null default now()
);

create or replace function app_config_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger app_config_updated_at before update on app_config
  for each row execute function app_config_touch();
