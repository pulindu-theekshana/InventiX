-- sales_uploads table
--
-- Purpose : Uploaded report files with the hash that prevents applying the same file twice.
-- Spec    : Section 5.8
-- Look here when : A duplicate upload is not rejected.

create table sales_uploads (
  id              uuid        primary key default gen_random_uuid(),

  customer_id     uuid        not null references profiles(id) on delete cascade,
  file_name       text        not null,

  -- The column that carries a rule. Spec 15.4: uploading the same report twice
  -- must not decrement stock twice. The unique constraint below is what enforces
  -- it -- a service-level check would still let two simultaneous uploads race
  -- past each other.
  file_hash       text        not null,

  period_start    date,
  period_end      date,
  row_count       integer     not null default 0,
  unmatched_count integer     not null default 0,

  status          text        not null default 'pending'
    check (status in ('pending', 'needs_mapping', 'applied', 'failed')),

  -- Remembered so the next upload arrives with the columns already matched,
  -- which is what makes mapping a one-time cost rather than a chore.
  column_mapping  jsonb,

  applied_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint one_upload_per_file_per_shop unique (customer_id, file_hash)
);

create trigger sales_uploads_updated_at before update on sales_uploads
  for each row execute function set_updated_at();

create index sales_uploads_by_customer on sales_uploads (customer_id, created_at desc);
