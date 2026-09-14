/**
 * Menu
 * 
 * Purpose : Profile summary and the account actions. Language is deliberately absent: it is deferred until the first complete build works, and adding a switcher implies translating every string.
 * Spec    : -
 * Look here when : A menu item is missing.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { initials } from '../../src/lib/format';
import { useAuth } from '../../src/hooks/useAuth';
import { signOut } from '../../src/stores/authStore';

const ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string }[] = [
  { icon: 'person-outline', label: 'My profile', route: '/settings/profile' },
  { icon: 'lock-closed-outline', label: 'Change password', route: '/settings/password' },
  { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
  { icon: 'help-buoy-outline', label: 'Help and support', route: '/settings/help' },
];

export default function Settings() {
  const { profile, demo } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={[text.h2, { color: colors.onAccent }]}>
            {initials(profile?.business_name ?? '?')}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={text.h2}>{profile?.business_name ?? 'Not signed in'}</Text>
          <Text style={[text.label, styles.muted]}>{profile?.contact_person}</Text>
          <Text style={[text.caption, styles.email]}>{profile?.email}</Text>
        </View>
      </Card>

      <View style={styles.badges}>
        {profile ? (
          <Badge
            label={profile.role === 'customer' ? 'Customer account' : 'Supplier account'}
            tone="neutral"
          />
        ) : null}
        {demo ? <Badge label="Sample data" tone="info" /> : null}
      </View>

      <Card padded={false} style={styles.list}>
        {ITEMS.map((item, i) => (
          <View key={item.label}>
            <Card
              level={0}
              onPress={() => item.route && router.push(item.route as never)}
              style={styles.item}
            >
              <Ionicons name={item.icon} size={20} color={colors.textMuted} />
              <Text style={[text.body, styles.flex]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Card>
            {i < ITEMS.length - 1 ? <View style={styles.rule} /> : null}
          </View>
        ))}
      </Card>

      <Button
        label="Log out"
        variant="outline"
        icon="log-out-outline"
        loading={busy}
        onPress={handleSignOut}
        fullWidth
        style={styles.logout}
      />

      <Text style={[text.caption, styles.version]}>InventiX 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  email: { color: colors.info },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm },
  list: { overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rule: { height: 1, backgroundColor: colors.border, marginLeft: spacing.xxl },
  logout: { borderColor: colors.danger },
  version: { color: colors.textSubtle, textAlign: 'center' },
});
