/**
 * Suppliers stack
 *
 * Purpose : The Suppliers feed and a supplier profile. A stack, so the back arrow goes exactly one screen back instead of jumping to the tab's first screen.
 * Spec    : Section 4.2
 * Look here when : Back from a screen in this feed lands somewhere unexpected.
 */

import { Stack } from 'expo-router';
import { feedStackScreenOptions } from '../../../src/hooks/useTabScreenOptions';

/** A deep link or notification straight to a detail screen still has the list underneath to go back to. */
export const unstable_settings = { initialRouteName: 'index' };

export default function SuppliersLayout() {
  return (
    <Stack screenOptions={feedStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Suppliers' }} />
      <Stack.Screen name="[id]" options={{ title: 'Supplier' }} />
    </Stack>
  );
}
