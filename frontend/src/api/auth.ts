/**
 * Auth API
 * 
 * Purpose : Calls the shared auth feed. Sessions themselves go straight to Supabase through lib/supabase.ts; this file is only for the profile row, because that carries the role.
 * Spec    : Section 4.1
 * Look here when : Registration or profile calls fail.
 */

import { mock, request, useMockData } from './client';
import type { AuthProfile } from '../types/api';
import type { Role } from '../types/database';

export interface ProfileSetupInput {
  role: Role;
  business_name: string;
  contact_person: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  city: string;
  /** Suppliers only. Spec 4.1 step 6. */
  delivery_areas?: string[];
}

/**
 * Spec 4.2 and 15.2: the role is written by the backend, never by the app. A client that can
 * write its own profiles row can grant itself a role, and every check below that point
 * becomes decorative. RLS must also forbid the client inserting into profiles.
 */
export async function createProfile(input: ProfileSetupInput): Promise<AuthProfile> {
  if (useMockData) {
    return mock({
      id: 'demo-user',
      role: input.role,
      business_name: input.business_name,
      contact_person: input.contact_person,
      email: 'demo@inventix.lk',
      phone: input.phone,
    });
  }
  return request('/auth/profile', { method: 'POST', body: JSON.stringify(input) });
}

export async function getProfile(): Promise<AuthProfile> {
  return request('/auth/profile');
}
