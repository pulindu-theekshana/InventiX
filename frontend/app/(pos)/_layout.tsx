/**
 * Till stack
 *
 * Purpose : The counter screens. Its own group, because a cashier sees only the till: no tabs, no notifications, no menu.
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
    </Stack>
  );
}
