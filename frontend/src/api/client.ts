/**
 * HTTP client
 * 
 * Purpose : The single fetch wrapper. Attaches the auth token, sets the base URL, and turns backend errors into typed errors. Every API file uses it.
 * Spec    : Section 3.1
 * Look here when : Every request fails, or errors lose their message.
 */

import { supabase } from '../lib/supabase';
import { ApiError } from '../lib/errors';

/**
 * Point this at the machine running FastAPI. On a phone, localhost is the phone itself, so
 * during development this must be your computer's LAN address, e.g. http://192.168.1.5:8000.
 * See docs/06-open-questions.md Q10.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * While the backend does not exist, every api/*.ts returns fixture data instead of calling it.
 * Setting EXPO_PUBLIC_API_URL switches the whole app onto the real backend at once.
 */
export const useMockData = !API_BASE_URL;

/** Lets a screen show "showing sample data" rather than pretending the numbers are real. */
export const MOCK_NOTICE = 'Sample data — the backend is not connected yet.';

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...init.headers,
    },
  });

  if (!response.ok) {
    /** Keep the backend's own message when it sends one — it is written for the shop owner. */
    let message = '';
    let code: string | undefined;
    try {
      const body = await response.json();
      message = body.detail ?? body.message ?? '';
      code = body.code;
    } catch {
      /* body was not JSON; fall back to the status message */
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Small helper so fixtures feel like a request rather than resolving in the same tick. */
export function mock<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
