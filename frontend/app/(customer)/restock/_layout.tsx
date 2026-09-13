/**
 * Restock stack
 *
 * Purpose : A real stack for the restock flow, so choosing a supplier can be backed out of and land on the request again.
 * Spec    : Section 6.5 and 9.3
 * Look here when : Back from Choose a supplier goes somewhere unexpected.
 *
 * NOTE: these two screens used to be tab routes with `href: null`. A tab navigator has no
 * stack to pop, so back always went to the tab's first screen -- the stock list -- and the
 * half-written request was left behind.
 */

import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { text } from '../../../src/theme/typography';

export default function RestockLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.brandInk,
        headerTitleStyle: { ...text.h2, color: colors.brandInk },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Restock request' }} />
      <Stack.Screen name="supplier" options={{ title: 'Choose a supplier' }} />
    </Stack>
  );
}
