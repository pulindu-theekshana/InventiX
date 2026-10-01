/**
 * Till stack
 *
 * Purpose : The counter screens, at /pos. A plain folder, not a (group): a group adds no path segment, so app/(pos)/index.tsx claimed "/" and opened the till instead of the login screen.
 * Spec    : Section 6.6
 * Look here when : The till shows the shop owner's chrome, or back from a till screen leaves the till.
 */

import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { text } from '../../src/theme/typography';

export const unstable_settings = { initialRouteName: 'index' };

export default function PosLayout() {
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
      <Stack.Screen name="shift" options={{ title: 'Start a shift' }} />
      <Stack.Screen name="settings" options={{ title: 'Till settings' }} />
      <Stack.Screen name="returns" options={{ title: 'Return goods' }} />
      <Stack.Screen name="close" options={{ title: 'Day close' }} />
    </Stack>
  );
}
