/**
 * Customer tabs
 * 
 * Purpose : The four customer feeds in the order spec 4.2 lists them. Routes that are not tabs are declared with href null so they push inside their tab instead of appearing in the bar.
 * Spec    : Section 4.2
 * Look here when : A tab is missing or in the wrong order.
 */

import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { useNotifications } from '../../src/hooks/useNotifications';

function HeaderButtons() {
  const { unread } = useNotifications();
  return (
    <View style={styles.headerRight}>
      <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityLabel="Notifications">
        <Ionicons name="notifications-outline" size={22} color={colors.brandInk} />
        {unread > 0 ? <View style={styles.dot} /> : null}
      </Pressable>
      <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityLabel="Menu">
        <Ionicons name="menu" size={24} color={colors.brandInk} />
      </Pressable>
    </View>
  );
}

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.brandInk,
        headerTitleStyle: { ...text.h2, color: colors.brandInk },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerRight: () => <HeaderButtons />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: text.caption,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="stocks/index"
        options={{
          title: 'Stocks',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="delivery/index"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="suppliers/index"
        options={{
          title: 'Suppliers',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color as string} />,
        }}
      />

      {/* Reachable, but not tabs. */}
      <Tabs.Screen name="stocks/[id]" options={{ href: null, title: 'Product' }} />
      <Tabs.Screen name="stocks/add" options={{ href: null, title: 'Add product' }} />
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

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingRight: spacing.lg },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
});
