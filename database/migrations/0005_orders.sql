-- orders table
--
-- Purpose : One row per restock request, with status, channel, message and every stage timestamp.
-- Spec    : Section 5.5
-- Look here when : A stage timestamp is missing or status is invalid.

-- Produces the human reference the app shows: DEL-0001, DEL-0002. A sequence
-- rather than a row number, so the reference of an existing order never changes
-- when another is deleted.
create sequence order_reference_seq;

create table orders (
  id                           uuid        primary key default gen_random_uuid(),

  -- Both parties are profiles rows. This is the reason customers and suppliers
  -- share one table: a foreign key can only point at one table, so separate
  -- customer and supplier tables would leave both of these columns untrusted.
  customer_id                  uuid        not null references profiles(id),
  supplier_id                  uuid        not null references profiles(id),

  reference                    text        not null unique
    default 'DEL-' || lpad(nextval('order_reference_seq')::text, 4, '0'),

  -- The last line of defence behind domain/order_state_machine.py. The database
  -- refusing an unknown status is what makes the state machine trustworthy.
  status                       text        not null default 'requested'
    check (status in ('requested','rejected','cancelled','confirmed',
                      'processing','put_to_delivery','on_the_way','purchased')),

  channel                      text        not null
    check (channel in ('in_app','whatsapp','email')),

  message_body                 text        not null,
  message_edited               boolean     not null default false,
  requested_delivery_date      date,
  notes                        text,
  rejection_reason             text,

  -- Spec 15.4. Nullable because only the send endpoint sets it; unique so a
  -- replayed request fails on the constraint instead of creating a second order.
  idempotency_key              text        unique,

  -- Separate columns rather than a log table: the order detail screen needs the
  -- whole history in one row read, and purchased_at - requested_at is the
  -- delivery-speed measurement behind 30 percent of the supplier ranking.
  requested_at                 timestamptz not null default now(),
  confirmed_at                 timestamptz,
  rejected_at                  timestamptz,
  cancelled_at                 timestamptz,
  processing_at                timestamptz,
  put_to_delivery_at           timestamptz,
  on_the_way_at                timestamptz,

  -- Spec 11.3: the supplier states they have delivered. This does NOT change
  -- status. The order stays on_the_way until the customer confirms, because
  -- stock must not rise on a claim.
  supplier_marked_delivered_at timestamptz,
  purchased_at                 timestamptz,

  -- True when the job closed the order because nobody confirmed. Excluded from
  -- delivery-speed statistics, so a supplier is not credited with a fast
  -- delivery that was never verified (spec 11.5).
  auto_confirmed               boolean     not null default false,

  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  constraint rejection_needs_a_reason
    check (status <> 'rejected' or rejection_reason is not null),
  constraint customer_and_supplier_differ
    check (customer_id <> supplier_id)
);

create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- The two feeds read this table from opposite ends, so they need separate indexes.
create index orders_by_customer on orders (customer_id, status);
create index orders_by_supplier on orders (supplier_id, status);
create index orders_pending_oldest on orders (supplier_id, requested_at)
  where status = 'requested';
