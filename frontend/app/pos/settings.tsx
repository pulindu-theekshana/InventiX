/**
 * Till settings
 *
 * Purpose : The owner sets their PIN, the limits above which they want to be asked, and who works the counter.
 * Spec    : Section 6.6
 * Look here when : A limit does not take effect, or a cashier cannot be added or removed.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { OwnerPin } from '../../src/components/OwnerPin';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { useAuth } from '../../src/hooks/useAuth';
import { useSubmit } from '../../src/hooks/useSubmit';
import { hashPin, isValidPin } from '../../src/pos/pin';
import * as settings from '../../src/pos/settings';
import type { Cashier, PosSettings } from '../../src/types/api';

export default function TillSettings() {
  const { profile } = useAuth();
  const submit = useSubmit();

  const [current, setCurrent] = useState<PosSettings>(settings.DEFAULTS);
  /** Locked until the owner proves it, whenever a PIN has already been set. */
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState(false);

  const [ownerPin, setOwnerPin] = useState('');
  const [discount, setDiscount] = useState('');
  const [refund, setRefund] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      settings.load().then((s) => {
        setCurrent(s);
        setDiscount(String(s.discount_limit));
        setRefund(String(s.return_limit));
        // Nothing to protect yet: a shop with no PIN set opens straight into settings.
        setUnlocked(!s.owner_pin_hash);
        setAsking(Boolean(s.owner_pin_hash));
      });
    }, []),
  );

  async function persist(next: PosSettings) {
    setError(null);
    setSaved(false);
    const ok = await submit.run(async () => {
      const stored = await settings.save(next);
      setCurrent(stored);
    });
    if (ok) setSaved(true);
  }

  async function saveBasics() {
    if (!profile) return;
    if (ownerPin && !isValidPin(ownerPin)) {
      setError('A PIN is four to six digits.');
      return;
    }
    await persist({
      ...current,
      owner_pin_hash: ownerPin
        ? await hashPin(ownerPin, profile.id)
        : current.owner_pin_hash,
      discount_limit: Number(discount) || 0,
      return_limit: Number(refund) || 0,
    });
    setOwnerPin('');
  }

  async function addCashier() {
    if (!profile) return;
    if (!newName.trim()) return;
    if (!isValidPin(newPin)) {
      setError('A PIN is four to six digits.');
      return;
    }
    if (current.cashiers.some((c) => c.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError('Someone with that name is already on the list.');
      return;
    }
    const cashier: Cashier = {
      name: newName.trim(),
      pin_hash: await hashPin(newPin, profile.id),
    };
    await persist({ ...current, cashiers: [...current.cashiers, cashier] });
    setNewName('');
    setNewPin('');
  }

  async function removeCashier(name: string) {
    await persist({ ...current, cashiers: current.cashiers.filter((c) => c.name !== name) });
  }

  if (!unlocked) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={34} color={colors.textSubtle} />
        <Text style={[text.label, styles.muted]}>These settings are the owner&apos;s.</Text>
        <Button label="Enter owner PIN" variant="accent" onPress={() => setAsking(true)} />
        <Button label="Back to the till" variant="outline" onPress={() => router.replace('/pos')} />

        <OwnerPin
          visible={asking}
          shopId={profile?.id ?? ''}
          reason="Till settings change who may sell and what needs your approval."
          onCancel={() => setAsking(false)}
          onApproved={() => {
            setAsking(false);
            setUnlocked(true);
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ErrorBanner message={error} />
      <ErrorBanner message={submit.error} />
      {saved ? <Text style={[text.label, { color: colors.success }]}>Saved.</Text> : null}

      <View style={styles.card}>
        <Text style={text.title}>Your PIN</Text>
        <Text style={[text.caption, styles.muted]}>
          {current.owner_pin_hash
            ? 'A PIN is set. Type a new one to change it.'
            : 'No PIN yet. Until you set one, the till does not lock.'}
        </Text>
        <Input
          value={ownerPin}
          onChangeText={setOwnerPin}
          placeholder="4 to 6 digits"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
      </View>

      <View style={styles.card}>
        <Text style={text.title}>Ask me when it is bigger than</Text>
        <Text style={[text.caption, styles.muted]}>
          Below these a cashier works without interruption. Set either to 0 to be asked every time.
        </Text>
        <Input
          label="Discount on one bill"
          value={discount}
          onChangeText={setDiscount}
          keyboardType="decimal-pad"
          hint={`Now: ${currency(current.discount_limit)}`}
        />
        <Input
          label="Refund on one return"
          value={refund}
          onChangeText={setRefund}
          keyboardType="decimal-pad"
          hint={`Now: ${currency(current.return_limit)}`}
        />
        <Button
          label="Save"
          variant="accent"
          onPress={saveBasics}
          loading={submit.busy}
          fullWidth
        />
      </View>

      <View style={styles.card}>
        <Text style={text.title}>Who works the counter</Text>
        <Text style={[text.caption, styles.muted]}>
          Each person gets a PIN and starts their own shift, so every bill shows who rang it.
        </Text>

        {current.cashiers.map((c) => (
          <View key={c.name} style={styles.person}>
            <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
            <Text style={[text.body, styles.flex]}>{c.name}</Text>
            <Pressable onPress={() => removeCashier(c.name)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))}

        <View style={styles.row}>
          <Input
            value={newName}
            onChangeText={setNewName}
            placeholder="Name"
            containerStyle={styles.flex}
          />
          <Input
            value={newPin}
            onChangeText={setNewPin}
            placeholder="PIN"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            containerStyle={styles.flex}
          />
        </View>
        <Button
          label="Add"
          variant="outline"
          icon="add"
          onPress={addCashier}
          disabled={!newName.trim() || !newPin}
          fullWidth
        />
      </View>

      <Button
        label="Back to the till"
        variant="outline"
        icon="arrow-back"
        onPress={() => router.replace('/pos')}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  muted: { color: colors.textMuted },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
