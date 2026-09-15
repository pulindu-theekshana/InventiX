/**
 * Tab header buttons
 * 
 * Purpose : The notifications bell and menu button carried by every tab header. One copy, because the customer and supplier bars are meant to stay identical and two copies drift.
 * Spec    : Section 4.2
 * Look here when : The bell or menu is missing, or the unread dot is wrong.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useNotifications } from '../hooks/useNotifications';

export function TabHeaderButtons() {
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
