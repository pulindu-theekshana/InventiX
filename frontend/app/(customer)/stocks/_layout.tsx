/**
 * Stocks stack
 *
 * Purpose : The Stocks feed and everything opened from it: a product, adding one, festival stock and the three sales upload steps. A stack, so the back arrow goes exactly one screen back instead of jumping to the tab's first screen.
 * Spec    : Section 4.2
 * Look here when : Back from a screen in this feed lands somewhere unexpected.
 */

import { Stack } from 'expo-router';
import { feedStackScreenOptions } from '../../../src/hooks/useTabScreenOptions';

/** A deep link or notification straight to a detail screen still has the list underneath to go back to. */
export const unstable_settings = { initialRouteName: 'index' };

export default function StocksLayout() {
  return (
    <Stack screenOptions={feedStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Stocks' }} />
      <Stack.Screen name="[id]" options={{ title: 'Product' }} />
      <Stack.Screen name="add" options={{ title: 'Add product' }} />
      <Stack.Screen name="seasonal" options={{ title: 'Festival stock' }} />
      <Stack.Screen name="upload/index" options={{ title: 'Upload sales report' }} />
      <Stack.Screen name="upload/mapping" options={{ title: 'Match the columns' }} />
      <Stack.Screen name="upload/unmatched" options={{ title: 'Unmatched products' }} />
    </Stack>
  );
}
