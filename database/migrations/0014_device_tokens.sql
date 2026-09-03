-- device_tokens table
--
-- Purpose : FCM tokens with the platform, since the app builds for android and ios.
-- Spec    : Section 5.12
-- Look here when : Push does not reach a device.

create table device_tokens (
  id           uuid        primary key default gen_random_uuid(),

  user_id      uuid        not null references profiles(id) on delete cascade,

  -- Unique across the whole table, not per user: a phone handed to someone else
  -- must move to the new account rather than notify both.
  fcm_token    text        not null unique,

  -- Firebase requires knowing which platform a token belongs to, which is why
  -- spec 5.12 records it rather than inferring it.
  platform     text        not null check (platform in ('ios', 'android')),

  -- Refreshed on every registration so a job can expire tokens that have gone
  -- quiet. Push to a dead token fails silently otherwise.
  last_seen_at timestamptz not null default now(),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger device_tokens_updated_at before update on device_tokens
  for each row execute function set_updated_at();

create index device_tokens_by_user on device_tokens (user_id);
