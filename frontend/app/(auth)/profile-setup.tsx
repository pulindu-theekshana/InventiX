/**
 * Profile setup
 * 
 * Purpose : The business details that go into the profiles row. The role travels with this request and is written by the backend, never by the app.
 * Spec    : Section 4.1
 * Look here when : Profile fields are missing after registration.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { elevation, radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { toMessage } from '../../src/lib/errors';
import { createProfile } from '../../src/api/auth';
import { completeProfile, signInDemo } from '../../src/stores/authStore';
import { useAuth } from '../../src/hooks/useAuth';

export default function ProfileSetup() {
  const { pendingRole, demo } = useAuth();
  const [form, setForm] = useState({
    business_name: '',
    contact_person: '',
    phone: '',
    whatsapp_number: '',
    address: '',
    city: '',
    delivery_areas: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingRole) return <Redirect href="/(auth)/choose-role" />;

  const isSupplier = pendingRole === 'supplier';
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit =
    form.business_name.trim().length > 0 &&
    form.contact_person.trim().length > 0 &&
    form.phone.trim().length > 0;

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        signInDemo(pendingRole!);
      } else {
        const profile = await createProfile({
          role: pendingRole!,
          business_name: form.business_name.trim(),
          contact_person: form.contact_person.trim(),
          phone: form.phone.trim(),
          whatsapp_number: form.whatsapp_number.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          delivery_areas: isSupplier
            ? form.delivery_areas.split(',').map((a) => a.trim()).filter(Boolean)
            : undefined,
        });
        completeProfile(profile);
      }
      /**
       * Spec 4.1 step 7: a supplier goes straight to adding listings, because they cannot
       * sell anything until they have one. A customer goes to their empty Stocks feed,
       * which explains itself through the empty state.
       */
      router.replace(isSupplier ? '/(supplier)/listings/add' : '/(customer)/stocks');
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.sheet, elevation(2)]}>
          <Text style={[text.h2, styles.heading]}>
            {isSupplier ? 'About your company' : 'About your shop'}
          </Text>
          <ErrorBanner message={error} />

          <Input
            label={isSupplier ? 'Company name' : 'Shop name'}
            value={form.business_name}
            onChangeText={set('business_name')}
            placeholder={isSupplier ? 'Lanka Traders (pvt) Ltd' : 'Wasantha Kade'}
            icon="business-outline"
          />
          <Input
            label="Contact person"
            value={form.contact_person}
            onChangeText={set('contact_person')}
            placeholder="Who runs the account"
            icon="person-outline"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChangeText={set('phone')}
            placeholder="077 123 4567"
            keyboardType="phone-pad"
            icon="call-outline"
          />
          <Input
            label="WhatsApp number"
            value={form.whatsapp_number}
            onChangeText={set('whatsapp_number')}
            placeholder="Used when an order is sent by WhatsApp"
            keyboardType="phone-pad"
            icon="logo-whatsapp"
          />
          <Input
            label="Address"
            value={form.address}
            onChangeText={set('address')}
            placeholder="No 44, Horowpathana Road"
            icon="location-outline"
          />
          <Input
            label="City"
            value={form.city}
            onChangeText={set('city')}
            placeholder="Galle"
            icon="map-outline"
          />
          {isSupplier ? (
            <Input
              label="Delivery areas"
              value={form.delivery_areas}
              onChangeText={set('delivery_areas')}
              placeholder="Colombo, Gampaha, Kalutara"
              hint="Separate each area with a comma."
              icon="navigate-outline"
            />
          ) : null}

          <Button
            label={isSupplier ? 'Save and add listings' : 'Finish'}
            variant="accent"
            size="lg"
            loading={busy}
            disabled={!canSubmit}
            onPress={handleSave}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  heading: { color: colors.text },
});
