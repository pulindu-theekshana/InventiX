/**
 * Supplier tabs
 * 
 * Purpose : The three supplier feeds from spec 4.2. The Stocks tab is the listings folder, because what a supplier manages is supplier_listings, not stock; the label stays Stocks for the user.
 * Spec    : Section 4.2 and 10
 * Look here when : A supplier sees a customer tab.
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

export default function SupplierLayout() {
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
