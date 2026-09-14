/**
 * Supplier tabs
 * 
 * Purpose : The three supplier feeds from spec 4.2. The Stocks tab is the listings folder, because what a supplier manages is supplier_listings, not stock; the label stays Stocks for the user.
 * Spec    : Section 4.2 and 10
 * Look here when : A supplier sees a customer tab.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTabScreenOptions } from '../../src/hooks/useTabScreenOptions';

export default function SupplierLayout() {
  const screenOptions = useTabScreenOptions();

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="listings/index"
        options={{
          title: 'Stocks',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="delivery/index"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color as string} />,
        }}
      />

      <Tabs.Screen name="listings/[id]" options={{ href: null, title: 'Listing' }} />
      <Tabs.Screen name="listings/add" options={{ href: null, title: 'Add product' }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null, title: 'Order' }} />
    </Tabs>
  );
}
