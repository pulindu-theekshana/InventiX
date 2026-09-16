/**
 * Auth store
 * 
 * Purpose : Session and profile state shared across the app. A module-level store read through useSyncExternalStore, so there is no provider to nest and no extra dependency. Read the role through hooks/useAuth.ts, never from here directly in a screen.
 * Spec    : Section 4.2
 * Look here when : The app forgets who is signed in.
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
 * Google through Supabase OAuth. The browser returns to the app with the session tokens in the
 * URL fragment (implicit flow, the supabase-js default). A first-time Google user has an auth
 * user but no profiles row, so they still need to pick a role and fill in profile-setup.
 */
export async function signInWithGoogle(): Promise<'signedIn' | 'needsProfile' | 'cancelled'> {
  if (!supabase) throw new Error('Supabase is not configured. Use Explore the app instead.');
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  // Tokens arrive after '#', errors after '?' — read both.
  const params = new URLSearchParams(result.url.split(/[?#]/).slice(1).join('&'));
  const failure = params.get('error_description');
  if (failure) throw new Error(failure);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Google sign-in did not return a session.');

  const { data: session, error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError || !session.user) throw sessionError ?? new Error('Google sign-in failed.');
  await loadProfile(session.user.id, session.user.email ?? '');
  return state.status === 'signedIn' ? 'signedIn' : 'needsProfile';
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

/**
 * Changes the signed-in user's password. No backend involved: spec 3.1 keeps raw passwords
 * out of FastAPI entirely, so this goes straight to Supabase Auth like sign-in does.
 *
 * The current password is checked first, by signing in with it. Supabase updates a password
 * from the session alone, which would let anyone holding an unlocked phone change it and lock
 * the owner out. Re-authenticating is the only way to know the person typing is the owner.
 * A failed sign-in does not disturb the session that is already open.
 */
export async function changePassword(current: string, next: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured. Use Explore the app instead.');
  const { profile } = getState();
  if (!profile) throw new Error('You need to be signed in to change your password.');

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: current,
  });
  if (wrong) throw new Error('That is not your current password.');

  const { error } = await supabase.auth.updateUser({ password: next });
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
