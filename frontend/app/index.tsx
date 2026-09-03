/**
 * Entry redirect
 * 
 * Purpose : Sends the user to the right place on launch. Signed out goes to login; signed in goes to the group matching their role. No screen of its own.
 * Spec    : Section 4.2
 * Look here when : The app opens on a blank or wrong screen.
 */

import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';

export default function Index() {
  const { status, role } = useAuth();

  if (status !== 'signedIn') return <Redirect href="/(auth)/login" />;
  /**
   * Spec 4.2: the role comes from the profile row, never from anything the user picked at
   * launch. A signed-in user is never asked to choose again.
   */
  return <Redirect href={role === 'supplier' ? '/(supplier)/listings' : '/(customer)/stocks'} />;
}
