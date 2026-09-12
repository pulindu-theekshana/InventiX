/**
 * Own profile hook
 * 
 * Purpose : The signed-in user's whole profiles row. useAuth carries only the six fields the router needs, so anything wanting the address, WhatsApp number or delivery areas reads them here.
 * Spec    : Section 5.1
 * Look here when : My profile shows "Not given" where the database has a value.
 */

import { useAsync } from './useAsync';
import { supabase } from '../lib/supabase';
import { getState } from '../stores/authStore';
import type { AuthProfile } from '../types/api';
import type { Profile } from '../types/database';

/** Every column of spec 5.1 except the timestamps, which nothing displays. */
const COLUMNS =
  'id, role, business_name, contact_person, phone, whatsapp_number, email, address, city, delivery_areas, is_active';

/**
 * Read straight from Supabase rather than through FastAPI. This is a read for display and
 * `profiles_read_own` already restricts it to the caller's own row, which is exactly the case
 * docs/01-architecture.md allows to go direct.
 */
export function useProfile() {
  return useAsync<Profile | null>(async () => {
    const { profile } = getState();
    if (!profile) return null;
    /** Demo mode has no database behind it, so show what the store already holds. */
    if (!supabase) return widen(profile);

    const { data, error } = await supabase
      .from('profiles')
      .select(COLUMNS)
      .eq('id', profile.id)
      .single();

    if (error) throw error;
    return data as Profile;
  }, []);
}

/** The six fields the auth store keeps, padded out to a full row so the screen has one shape. */
function widen(profile: AuthProfile): Profile {
  return {
    ...profile,
    whatsapp_number: null,
    address: null,
    city: null,
    delivery_areas: null,
    is_active: true,
  };
}
