/**
 * Customer tabs
 * 
 * Purpose : The four customer feeds in the order spec 4.2 lists them. Routes that are not tabs are declared with href null so they push inside their tab instead of appearing in the bar.
 * Spec    : Section 4.2
 * Look here when : A tab is missing or in the wrong order.
 */

import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TAB_ICON_SIZE, useTabScreenOptions } from '../../src/hooks/useTabScreenOptions';
import { colors } from '../../src/theme/colors';

/** The restock flow: no tab bar to wander off into mid-order. Its stack draws the header. */
const FOCUSED = {
  href: null,
  tabBarStyle: { display: 'none' as const },
};

export default function CustomerLayout() {
  const screenOptions = useTabScreenOptions();

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="stocks/index"
        options={{
          title: 'Stocks',
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <Ionicons name="analytics-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="delivery/index"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="suppliers/index"
        options={{
          title: 'Suppliers',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />

      {/* Reachable, but not tabs. */}
      <Tabs.Screen name="stocks/[id]" options={{ href: null, title: 'Product' }} />
      <Tabs.Screen name="stocks/add" options={{ href: null, title: 'Add product' }} />
      <Tabs.Screen
        name="stocks/seasonal"
        options={{
          href: null,
          title: 'Festival stock',
          // A tab route has no stack to pop, so back names its destination instead of guessing.
          headerLeft: () => (
            <Pressable
              onPress={() => router.navigate('/(customer)/stocks')}
              accessibilityLabel="Back to Stocks"
              hitSlop={12}
              style={{ paddingHorizontal: 16 }}
            >
              <Ionicons name="chevron-back" size={26} color={colors.brandInk} />
            </Pressable>
          ),
        }}
      />
      {/* Its own stack, so back inside the flow behaves. See restock/_layout.tsx. */}
      <Tabs.Screen name="restock" options={{ ...FOCUSED, headerShown: false }} />
      <Tabs.Screen name="stocks/upload/index" options={{ href: null, title: 'Upload sales report' }} />
      <Tabs.Screen name="stocks/upload/mapping" options={{ href: null, title: 'Match the columns' }} />
      <Tabs.Screen name="stocks/upload/unmatched" options={{ href: null, title: 'Unmatched products' }} />
      <Tabs.Screen name="reports/[type]" options={{ href: null, title: 'Report' }} />
      <Tabs.Screen name="delivery/[id]" options={{ href: null, title: 'Order' }} />
      <Tabs.Screen name="delivery/history" options={{ href: null, title: 'Order history' }} />
      <Tabs.Screen name="suppliers/[id]" options={{ href: null, title: 'Supplier' }} />
    </Tabs>
  );
}
