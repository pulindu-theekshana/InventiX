/**
 * Auth hook
 * 
 * Purpose : Current session, profile and role. Read role from here, never from a screen.
 * Spec    : Section 4.2
 * Look here when : Role checks disagree between screens.
 */

import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '../stores/authStore';

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  return {
    ...state,
    role: state.profile?.role ?? null,
    isCustomer: state.profile?.role === 'customer',
    isSupplier: state.profile?.role === 'supplier',
    /** A staff login created by a shop. Sees the till and nothing else. */
    isCashier: state.profile?.role === 'cashier',
    /**
     * The shop this user is working in: their own id, or their employer's if they are a
     * cashier. Anything stored or salted per shop uses this, never profile.id -- the same
     * coalesce the database makes in app_shop_id().
     */
    shopId: state.profile?.employer_id ?? state.profile?.id ?? null,
  };
}
