/**
 * Supabase client
 * 
 * Purpose : The app-side Supabase client for auth and realtime reads only. Never for side-effecting writes.
 * Spec    : Section 3.1
 * Look here when : Auth or realtime fails.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The app must boot and be navigable before Supabase exists, otherwise nobody can look at a
 * screen until the database is up. When this is false the auth store runs in demo mode.
 */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('your-project'));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        /** Web-only concept. Leaving it true breaks the native session restore. */
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Token refresh does not run while the app is backgrounded. Without this, a user who leaves
 * the app open overnight returns to expired-token errors that look like random 401s.
 */
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
