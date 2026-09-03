/**
 * Error mapping
 * 
 * Purpose : Turns a backend or Supabase error into a message a shop owner can act on. Spec 6.5 is explicit that a disabled button with no explanation is not acceptable, and the same applies to a failed request.
 * Spec    : Section 6.5
 * Look here when : An error message is unhelpful.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BY_STATUS: Record<number, string> = {
  400: 'Something in that request was not valid. Check the highlighted fields.',
  401: 'Your session has expired. Please sign in again.',
  403: 'Your account is not allowed to do that.',
  404: 'We could not find that. It may have been removed.',
  409: 'That has already been done. Refresh to see the current state.',
  422: 'Something in that request was not valid. Check the highlighted fields.',
  429: 'Too many attempts. Wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  503: 'The service is briefly unavailable. Please try again in a moment.',
};

/**
 * Never returns an empty string. A blank error banner is worse than a generic one,
 * because the user cannot tell whether anything happened at all.
 */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || BY_STATUS[error.status] || 'Something went wrong. Please try again.';
  }
  if (error instanceof Error) {
    if (error.message.includes('Network request failed')) {
      return 'No connection. Check your internet and try again.';
    }
    if (error.message.includes('Invalid login credentials')) {
      return 'That email and password do not match an account.';
    }
    if (error.message.includes('User already registered')) {
      return 'An account already exists with that email. Try signing in.';
    }
    return error.message || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
