/**
 * Send channels
 * 
 * Purpose : In app, WhatsApp and email, with when each is offered.
 * Spec    : Section 6.5
 * Look here when : A channel is offered when it should not be.
 */

import type { Channel } from '../types/database';

export interface ChannelMeta {
  key: Channel;
  label: string;
  description: string;
  icon: 'phone-portrait-outline' | 'logo-whatsapp' | 'mail-outline';
}

export const CHANNELS: ChannelMeta[] = [
  {
    key: 'in_app',
    label: 'In app',
    description: 'Fully tracked. Only for suppliers registered on InventiX.',
    icon: 'phone-portrait-outline',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Goes to their WhatsApp number. You advance the stages yourself.',
    icon: 'logo-whatsapp',
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Goes to their email address. You advance the stages yourself.',
    icon: 'mail-outline',
  },
];

/**
 * Spec 6.5 — in-app is offered only when the supplier has an InventiX account.
 * WhatsApp and email always work, which is how an unregistered supplier is ordered from.
 */
export function availableChannels(supplierIsRegistered: boolean): ChannelMeta[] {
  return CHANNELS.filter((c) => c.key !== 'in_app' || supplierIsRegistered);
}
