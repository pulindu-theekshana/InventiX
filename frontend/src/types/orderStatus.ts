/**
 * Order status type
 * 
 * Purpose : The eight statuses as a TypeScript union, mirroring the backend state machine.
 * Spec    : Section 11.1
 * Look here when : A status string is misspelled somewhere.
 */

export type OrderStatus =
  | 'requested'
  | 'rejected'
  | 'cancelled'
  | 'confirmed'
  | 'processing'
  | 'put_to_delivery'
  | 'on_the_way'
  | 'purchased';

/** The happy path, in order. Used by StageProgress. Excludes the two failure states. */
export const PIPELINE: OrderStatus[] = [
  'requested',
  'confirmed',
  'processing',
  'put_to_delivery',
  'on_the_way',
  'purchased',
];

export const TERMINAL: OrderStatus[] = ['rejected', 'cancelled', 'purchased'];

/** Customer Delivery feed, spec 8.1. Requested waits on the supplier; Confirmed is everything accepted. */
export const CUSTOMER_REQUESTED: OrderStatus[] = ['requested'];
export const CUSTOMER_CONFIRMED: OrderStatus[] = [
  'confirmed',
  'processing',
  'put_to_delivery',
  'on_the_way',
];

/** Supplier Orders feed, spec 10.2. Three sections, not two. */
export const SUPPLIER_PENDING: OrderStatus[] = ['requested'];
export const SUPPLIER_ACTIVE: OrderStatus[] = [
  'confirmed',
  'processing',
  'put_to_delivery',
  'on_the_way',
];
export const SUPPLIER_HISTORY: OrderStatus[] = ['purchased', 'rejected', 'cancelled'];

/** Supplier Delivery working queue, spec 10.3. In flight only, never terminal states. */
export const SUPPLIER_QUEUE: OrderStatus[] = [
  'confirmed',
  'processing',
  'put_to_delivery',
  'on_the_way',
];
