/**
 * Stage labels
 * 
 * Purpose : The display names, order and colours of the delivery stages, and what the supplier may advance to from each. One place, so the two role apps can never disagree about wording.
 * Spec    : Section 11.1
 * Look here when : A stage shows a wrong label.
 */

import type { OrderStatus } from '../types/orderStatus';
import { colors } from '../theme/colors';

interface StageMeta {
  label: string;
  /** Short form for the progress indicator, where space is tight. */
  short: string;
  color: string;
  bg: string;
}

export const STAGE: Record<OrderStatus, StageMeta> = {
  requested: { label: 'Requested', short: 'Requested', color: colors.warning, bg: colors.warningBg },
  confirmed: { label: 'Confirmed', short: 'Confirmed', color: colors.success, bg: colors.successBg },
  processing: { label: 'Processing', short: 'Processing', color: colors.info, bg: colors.infoBg },
  put_to_delivery: { label: 'Put to delivery', short: 'Dispatched', color: colors.info, bg: colors.infoBg },
  on_the_way: { label: 'On the way', short: 'On the way', color: colors.info, bg: colors.infoBg },
  purchased: { label: 'Completed', short: 'Completed', color: colors.success, bg: colors.successBg },
  rejected: { label: 'Rejected', short: 'Rejected', color: colors.danger, bg: colors.dangerBg },
  cancelled: { label: 'Cancelled', short: 'Cancelled', color: colors.textSubtle, bg: colors.surfaceMuted },
};

/**
 * Spec 10.3 — what the supplier Delivery queue offers for each stage group.
 * on_the_way has next: null because marking delivered records a timestamp and notifies
 * the customer but does NOT change the status. Only the customer can set purchased (spec 11.3).
 */
export const SUPPLIER_ADVANCE: Partial<
  Record<OrderStatus, { next: OrderStatus | null; action: string }>
> = {
  confirmed: { next: 'processing', action: 'Move to Processing' },
  processing: { next: 'put_to_delivery', action: 'Put to delivery' },
  put_to_delivery: { next: 'on_the_way', action: 'Mark on the way' },
  on_the_way: { next: null, action: 'Mark as delivered' },
};
