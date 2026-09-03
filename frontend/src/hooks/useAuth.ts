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
  };
}
