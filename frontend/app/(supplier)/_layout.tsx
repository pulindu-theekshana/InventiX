/**
 * Supplier tabs
 * 
 * Purpose : The three supplier feeds from spec 4.2. Listings and Orders are their own stacks (see their _layout.tsx), so screens opened from them go one screen back. The Stocks tab is the listings folder, because what a supplier manages is supplier_listings, not stock; the label stays Stocks for the user.
 * Spec    : Section 4.2 and 10
 * Look here when : A supplier sees a customer tab.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TAB_ICON_SIZE, useTabScreenOptions } from '../../src/hooks/useTabScreenOptions';

export default function SupplierLayout() {
  const screenOptions = useTabScreenOptions();

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Stocks',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="delivery/index"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
