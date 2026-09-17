/**
 * Customer tabs
 * 
 * Purpose : The four customer feeds in the order spec 4.2 lists them. Each feed folder is its own stack (its _layout.tsx), so screens opened from a feed get a back arrow that goes one screen back.
 * Spec    : Section 4.2
 * Look here when : A tab is missing or in the wrong order.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TAB_ICON_SIZE, useTabScreenOptions } from '../../src/hooks/useTabScreenOptions';

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
        name="stocks"
        options={{
          title: 'Stocks',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="analytics-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: 'Delivery',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="suppliers"
        options={{
          title: 'Suppliers',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={TAB_ICON_SIZE} color={color as string} />,
        }}
      />

      {/* The restock flow: its own stack too, with the tab bar hidden mid-order. See restock/_layout.tsx. */}
      <Tabs.Screen name="restock" options={{ ...FOCUSED, headerShown: false }} />
    </Tabs>
  );
}
