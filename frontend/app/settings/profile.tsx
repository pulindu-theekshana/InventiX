/**
 * My profile
 * 
 * Purpose : The signed-in account as it is actually stored — who the business is, who runs it, how to reach them. Read only: spec 4.1 covers profile creation, and there is no update endpoint yet.
 * Spec    : Section 4.1 and 5.1
 * Look here when : A field is blank here but has a value in the database.
 */

import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { initials } from '../../src/lib/format';
import { useProfile } from '../../src/hooks/useProfile';

export default function MyProfile() {
  const { data: profile, loading, error } = useProfile();

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.scroll}>
        <ErrorBanner message={error} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.scroll}>
        <ErrorBanner message="You are not signed in." />
      </View>
    );
  }

  const isSupplier = profile.role === 'supplier';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Identity, in the order the rest of the app uses it: company, then the person, then the login. */}
      <Card style={styles.head}>
        <View style={styles.avatar}>
          <Text style={[text.display, { color: colors.onAccent }]}>
            {initials(profile.business_name)}
          </Text>
        </View>
        <Text style={[text.h1, styles.centreText]}>{profile.business_name}</Text>
        <Text style={[text.label, styles.muted]}>{profile.contact_person}</Text>
        <Text style={[text.label, styles.email]}>{profile.email}</Text>
        <View style={styles.badges}>
          <Badge label={isSupplier ? 'Supplier account' : 'Customer account'} tone="neutral" />
          <Badge
            label={profile.is_active ? 'Active' : 'Inactive'}
            tone={profile.is_active ? 'success' : 'neutral'}
          />
        </View>
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Contact</Text>
        <Line icon="person-outline" label="Owner" value={profile.contact_person} />
        <Line icon="call-outline" label="Phone" value={profile.phone} />
        <Line icon="logo-whatsapp" label="WhatsApp" value={profile.whatsapp_number} />
        <Line icon="mail-outline" label="Email" value={profile.email} />
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Business</Text>
        <Line icon="storefront-outline" label="Name" value={profile.business_name} />
        <Line icon="location-outline" label="Address" value={profile.address} />
        <Line icon="map-outline" label="City" value={profile.city} />
      </Card>

      {/* delivery_areas is null on every customer row by table constraint, so for a customer
          this card could only ever be empty. */}
      {isSupplier ? (
        <Card style={styles.gap}>
          <Text style={text.title}>Delivery areas</Text>
          {profile.delivery_areas && profile.delivery_areas.length > 0 ? (
            <View style={styles.areas}>
              {profile.delivery_areas.map((area) => (
                <Badge key={area} label={area} tone="info" />
              ))}
            </View>
          ) : (
            <Text style={[text.caption, styles.muted]}>No delivery areas set.</Text>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Line({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null;
}) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textSubtle} />
      <Text style={[text.caption, styles.lineLabel]}>{label}</Text>
      <Text style={[text.label, styles.lineValue]} numberOfLines={2}>
        {value ?? 'Not given'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.xs },
  /** The same initials circle as the menu and the supplier profile, at profile size. */
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreText: { textAlign: 'center' },
  muted: { color: colors.textMuted },
  email: { color: colors.info },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  gap: { gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineLabel: { color: colors.textSubtle, width: 76 },
  lineValue: { flex: 1 },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
