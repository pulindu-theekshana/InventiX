/**
 * Till stack
 *
 * Purpose : The counter screens, at /pos. A plain folder, not a (group): a group adds no path segment, so app/(pos)/index.tsx claimed "/" and opened the till instead of the login screen.
 * Spec    : Section 6.6
 * Look here when : The till shows the shop owner's chrome, or back from a till screen leaves the till.
 */

import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { colors } from '../../src/theme/colors';
import { text } from '../../src/theme/typography';

export const unstable_settings = { initialRouteName: 'index' };

export default function PosLayout() {
  const { status, role } = useAuth();

  /**
   * The till showed its screens to a signed-out browser: nothing loaded, so it looked like a
   * shop with no cashiers and no products. A supplier has no counter, so they are sent home too.
   */
  if (status === 'loading') return null;
  if (status !== 'signedIn') return <Redirect href="/(auth)/login" />;
  if (role === 'supplier') return <Redirect href="/(supplier)/listings" />;
  // A cashier account belongs here and nowhere else, so there is nothing more to check: the
  // owner may stand at the counter too.

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.brandInk,
        headerTitleStyle: { ...text.h2, color: colors.brandInk },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Till' }} />
      <Stack.Screen name="settings" options={{ title: 'Till settings' }} />
      <Stack.Screen name="returns" options={{ title: 'Return goods' }} />
      <Stack.Screen name="close" options={{ title: 'Day close' }} />
    </Stack>
  );
}
