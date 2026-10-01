/**
 * Start a shift
 *
 * Purpose : Who is at the till. The cashier taps their name and types their PIN, and every bill from then on carries that name.
 * Spec    : Section 6.6
 * Look here when : The till will not start, or a cashier's PIN is refused.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { useAuth } from '../../src/hooks/useAuth';
import { pinMatches } from '../../src/pos/pin';
import * as settings from '../../src/pos/settings';
import * as shift from '../../src/pos/shift';
import type { Cashier } from '../../src/types/api';

export default function Shift() {
  const { profile } = useAuth();
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [chosen, setChosen] = useState<Cashier | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      settings.load().then((s) => setCashiers(s.cashiers));
    }, []),
  );

  async function begin() {
    if (!chosen || !profile) return;
    if (!(await pinMatches(pin, chosen.pin_hash, profile.id))) {
      setError(`That is not ${chosen.name}'s PIN.`);
      return;
    }
    await shift.start(chosen.name);
    router.replace('/pos');
  }

  /**
   * A shop that has added no cashiers is a one-person shop: the owner sells, and asking them to
   * invent a cashier for themselves would be a lock against nobody.
   */
  if (cashiers.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={34} color={colors.textSubtle} />
        <Text style={text.h2}>No cashiers added yet</Text>
        <Text style={[text.label, styles.muted]}>
          Add the people who work the counter, so each bill shows who rang it.
        </Text>
        <Button
          label="Till settings"
          variant="outline"
          icon="settings-outline"
          onPress={() => router.push('/pos/settings')}
        />
        <Button
          label="Sell as the owner"
          variant="accent"
          onPress={async () => {
            await shift.start(profile?.contact_person || 'Owner');
            router.replace('/pos');
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={text.h2}>Who is at the till?</Text>
      <ErrorBanner message={error} />

      <View style={styles.people}>
        {cashiers.map((c) => (
          <Pressable
            key={c.name}
            onPress={() => {
              setChosen(c);
              setPin('');
              setError(null);
            }}
            style={[styles.person, chosen?.name === c.name && styles.personOn]}
          >
            <Ionicons
              name="person-circle-outline"
              size={22}
              color={chosen?.name === c.name ? colors.brandInk : colors.textMuted}
            />
            <Text style={text.bodyStrong}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {chosen ? (
        <View style={styles.pinBox}>
          <Input
            label={`${chosen.name}'s PIN`}
            value={pin}
            onChangeText={(v) => {
              setPin(v);
              setError(null);
            }}
            onSubmitEditing={begin}
            placeholder="····"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />
          <Button
            label="Start selling"
            variant="accent"
            size="lg"
            onPress={begin}
            disabled={pin.length < 4}
            fullWidth
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  muted: { color: colors.textMuted, textAlign: 'center' },
  people: { gap: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  personOn: { backgroundColor: colors.primaryTint },
  pinBox: { gap: spacing.md },
});
