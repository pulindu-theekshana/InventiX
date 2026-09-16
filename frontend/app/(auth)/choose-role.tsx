/**
 * Choose role
 * 
 * Purpose : The one place a role is picked, and only during sign-up. Spec 4.2 fixes the role at registration, so a returning user is never asked again: launch reads it from the profile.
 * Spec    : Section 4.1
 * Look here when : A user ends up with the wrong role.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { elevation, radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { setPendingRole } from '../../src/stores/authStore';
import type { Role } from '../../src/types/database';

const ROLES: {
  role: Role;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  points: string[];
}[] = [
  {
    role: 'customer',
    title: 'Customer',
    blurb: 'I run a grocery shop and buy stock.',
    icon: 'storefront-outline',
    points: ['Track what is in stock', 'Get warned before it runs out', 'Order from ranked suppliers'],
  },
  {
    role: 'supplier',
    title: 'Supplier',
    blurb: 'I am a wholesaler or distributor and sell stock.',
    icon: 'business-outline',
    points: ['List what you sell', 'Accept or reject orders', 'Move deliveries through their stages'],
  },
];

export default function ChooseRole() {
  // Set by Google sign-in: the auth user already exists, so skip email/password registration.
  const { google } = useLocalSearchParams<{ google?: string }>();

  function pick(role: Role) {
    setPendingRole(role);
    router.push(google ? '/(auth)/profile-setup' : '/(auth)/register');
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[text.h1, styles.heading]}>How will you use InventiX?</Text>
      <Text style={[text.body, styles.lead]}>
        This is fixed once your account is created, so choose the one that matches your business.
      </Text>

      {ROLES.map((r) => (
        <Pressable
          key={r.role}
          onPress={() => pick(r.role)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, elevation(2), pressed && { opacity: 0.92 }]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconRing}>
              <Ionicons name={r.icon} size={24} color={colors.accent} />
            </View>
            <View style={styles.cardText}>
              <Text style={text.h2}>{r.title}</Text>
              <Text style={[text.label, styles.muted]}>{r.blurb}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </View>
          <View style={styles.points}>
            {r.points.map((p) => (
              <View key={p} style={styles.point}>
                <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                <Text style={[text.caption, styles.muted]}>{p}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.primary, flexGrow: 1 },
  heading: { color: colors.brandInk },
  lead: { color: colors.brandInk, opacity: 0.8, marginTop: -spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  points: { gap: spacing.xs, paddingLeft: spacing.xs },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
