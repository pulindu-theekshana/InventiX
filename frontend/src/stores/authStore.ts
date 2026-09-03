/**
 * Auth store
 * 
 * Purpose : Session and profile state shared across the app. A module-level store read through useSyncExternalStore, so there is no provider to nest and no extra dependency. Read the role through hooks/useAuth.ts, never from here directly in a screen.
 * Spec    : Section 4.2
 * Look here when : The app forgets who is signed in.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthProfile } from '../types/api';
import type { Role } from '../types/database';

export interface AuthState {
  /** `loading` covers the session restore at launch. Route on this, never on session alone. */
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: AuthProfile | null;
  /**
   * The role picked on choose-role during sign-up, before any profile row exists.
   * Spec 4.2: the role is only real once written to profiles, and is not editable after.
   */
  pendingRole: Role | null;
  /** True when running without Supabase, so screens can say so rather than failing silently. */
  demo: boolean;
}

let state: AuthState = {
  status: 'loading',
  profile: null,
  pendingRole: null,
  demo: !isSupabaseConfigured,
};

const listeners = new Set<() => void>();

function set(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AuthState {
  return state;
}

/**
 * Called once from app/_layout.tsx. Restores a persisted session and loads the profile so
 * the router knows which group to enter. Until this resolves, status stays `loading` and the
 * splash stays up — otherwise a signed-in user sees the login screen flash past.
 */
export async function initialise(): Promise<void> {
  if (!supabase) {
    set({ status: 'signedOut', demo: true });
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    set({ status: 'signedOut' });
    return;
  }
  await loadProfile(data.session.user.id, data.session.user.email ?? '');
}

async function loadProfile(userId: string, email: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, business_name, contact_person, email, phone')
    .eq('id', userId)
    .single();

  if (error || !data) {
    /**
     * Signed in with no profile row: registration was interrupted between the auth user and
     * the profile write. Treat as signed out rather than routing into a role-less app.
     */
    set({ status: 'signedOut', profile: null });
    return;
  }
  set({ status: 'signedIn', profile: data as AuthProfile });
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured. Use Explore the app instead.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await loadProfile(data.user.id, data.user.email ?? '');
}

/**
 * Creates the auth user only. The profiles row carrying `role` is written by the backend
 * (feeds/shared/auth), because a client that can write its own role can grant itself one.
 * Spec 4.2 and 15.2. Until that endpoint exists this leaves the user at profile-setup.
 */
export async function signUp(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured. Use Explore the app instead.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export function setPendingRole(role: Role | null): void {
  set({ pendingRole: role });
}

/**
 * Lets the UI be walked end to end before Supabase or the backend exist. Everything else in
 * this file is the real path; only this one is scaffolding, and it is unreachable once
 * EXPO_PUBLIC_SUPABASE_URL is set.
 */
export function signInDemo(role: Role): void {
  set({
    status: 'signedIn',
    profile: {
      id: 'demo-user',
      role,
      business_name: role === 'customer' ? 'Wasantha Kade' : 'Lanka Traders (pvt) Ltd',
      contact_person: 'Mahinda',
      email: 'demo@inventix.lk',
      phone: '077 123 4567',
    },
  });
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  set({ status: 'signedOut', profile: null, pendingRole: null });
}
