/**
 * Till settings
 *
 * Purpose : The owner's side of the till: their PIN, the amounts they want to be asked about, and who works the counter.
 * Spec    : Section 6.6
 * Look here when : A limit does not take effect, a cashier cannot be added or removed, or the screen asks for a PIN at the wrong moment.
 */

import { useCallback, useEffect, useState } from 'react';
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
import * as shift from '../../src/pos/shift';
import type { Cashier, PosSettings } from '../../src/types/api';

export default function TillSettings() {
  const { profile } = useAuth();
  const submit = useSubmit();

  const [current, setCurrent] = useState<PosSettings>(settings.DEFAULTS);
  const [ready, setReady] = useState(false);
  /** Null until the real settings arrive: deciding before that asked for a PIN that was not set. */
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);

  /** Each section shows what is saved until the owner chooses to change it. */
  const [editingPin, setEditingPin] = useState(false);
  const [editingLimits, setEditingLimits] = useState(false);

  const [ownerPin, setOwnerPin] = useState('');
  const [discount, setDiscount] = useState('');
  const [refund, setRefund] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const adopt = useCallback((next: PosSettings) => {
    setCurrent(next);
    setDiscount(String(next.discount_limit));
    setRefund(String(next.return_limit));
    setReady(true);
    // With no PIN there is nothing to unlock, which is also the shop's way of turning the
    // guards off entirely.
    setUnlocked((was) => was ?? !next.owner_pin_hash);
  }, []);

  useFocusEffect(
    useCallback(() => {
      settings.load().then(adopt);
    }, [adopt]),
  );

  useEffect(() => settings.subscribe(() => adopt(settings.current())), [adopt]);

  async function persist(next: PosSettings, message: string) {
    setError(null);
    setSaved(null);
    const ok = await submit.run(async () => {
      adopt(await settings.save(next));
    });
    if (ok) setSaved(message);
  }

  async function saveOwnerPin() {
    if (!profile) return;
    if (!isValidPin(ownerPin)) {
      setError('A PIN is four to six digits.');
      return;
    }
    await persist(
      { ...current, owner_pin_hash: await hashPin(ownerPin, profile.id) },
      'Owner PIN saved.',
    );
    setOwnerPin('');
    setEditingPin(false);
  }

  async function removeOwnerPin() {
    await persist({ ...current, owner_pin_hash: null }, 'Owner PIN removed. Nothing locks now.');
    setOwnerPin('');
    setEditingPin(false);
  }

  async function saveLimits() {
    await persist(
      { ...current, discount_limit: Number(discount) || 0, return_limit: Number(refund) || 0 },
      'Limits saved.',
    );
    setEditingLimits(false);
  }

  async function addCashier() {
    if (!profile || !newName.trim()) return;
    if (!isValidPin(newPin)) {
      setError('A PIN is four to six digits.');
      return;
    }
    if (current.cashiers.some((c) => c.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError('Someone with that name is already on the list.');
      return;
    }
    const cashier: Cashier = { name: newName.trim(), pin_hash: await hashPin(newPin, profile.id) };
    await persist({ ...current, cashiers: [...current.cashiers, cashier] }, `${cashier.name} added.`);
    setNewName('');
    setNewPin('');
  }

  async function removeCashier(name: string) {
    await persist(
      { ...current, cashiers: current.cashiers.filter((c) => c.name !== name) },
      `${name} removed.`,
    );
  }

  /** Back goes to the counter if someone is on shift, and to the shift screen if nobody is. */
  function back() {
    router.replace(shift.current() ? '/pos' : '/pos/shift');
  }

  if (!ready || unlocked === null) {
    return <View style={styles.center} />;
  }

  if (!unlocked) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={34} color={colors.textSubtle} />
        <Text style={[text.label, styles.muted]}>These settings are the owner&apos;s.</Text>
        <Button label="Enter owner PIN" variant="accent" onPress={() => setAsking(true)} />
        <Button label="Back" variant="outline" onPress={back} />

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
      {saved ? <Text style={[text.label, { color: colors.success }]}>{saved}</Text> : null}

      {/* ---------------------------------------------------------------- owner PIN */}
      <View style={styles.card}>
        <Text style={text.title}>Owner PIN — yours</Text>
        <Text style={[text.caption, styles.muted]}>
          Asked for a discount or refund above your limits, for leaving the till, and for this
          screen. Your staff do not know it.
        </Text>

        {current.owner_pin_hash && !editingPin ? (
          <>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[text.body, styles.flex]}>A PIN is set</Text>
            </View>
            <View style={styles.row}>
              <Button
                label="Remove PIN"
                variant="outline"
                onPress={removeOwnerPin}
                style={styles.flex}
              />
              <Button
                label="Change PIN"
                variant="accent"
                onPress={() => setEditingPin(true)}
                style={styles.flex}
              />
            </View>
          </>
        ) : (
          <>
            {!current.owner_pin_hash ? (
              <Text style={[text.caption, { color: colors.warning }]}>
                Not set, so nothing locks. Set one to turn the guards on.
              </Text>
            ) : null}
            <Input
              value={ownerPin}
              onChangeText={setOwnerPin}
              placeholder="4 to 6 digits"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <View style={styles.row}>
              {editingPin ? (
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => {
                    setEditingPin(false);
                    setOwnerPin('');
                  }}
                  style={styles.flex}
                />
              ) : null}
              <Button
                label={current.owner_pin_hash ? 'Save new PIN' : 'Set PIN'}
                variant="accent"
                onPress={saveOwnerPin}
                loading={submit.busy}
                disabled={!ownerPin}
                style={styles.flex}
              />
            </View>
          </>
        )}
      </View>

      {/* ---------------------------------------------------------------- limits */}
      <View style={styles.card}>
        <Text style={text.title}>Ask me when it is bigger than</Text>
        <Text style={[text.caption, styles.muted]}>
          These apply to the whole shop, not to one person. Below them any cashier works without
          interruption; above them the till asks for your PIN. Set either to 0 to be asked every
          time.
        </Text>

        {editingLimits ? (
          <>
            <Input
              label="Discount on one bill"
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
            />
            <Input
              label="Refund on one return"
              value={refund}
              onChangeText={setRefund}
              keyboardType="decimal-pad"
            />
            <View style={styles.row}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => {
                  setDiscount(String(current.discount_limit));
                  setRefund(String(current.return_limit));
                  setEditingLimits(false);
                }}
                style={styles.flex}
              />
              <Button
                label="Save limits"
                variant="accent"
                onPress={saveLimits}
                loading={submit.busy}
                style={styles.flex}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={[text.body, styles.flex]}>Discount on one bill</Text>
              <Text style={text.bodyStrong}>{currency(current.discount_limit)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[text.body, styles.flex]}>Refund on one return</Text>
              <Text style={text.bodyStrong}>{currency(current.return_limit)}</Text>
            </View>
            <Button
              label="Change limits"
              variant="outline"
              onPress={() => setEditingLimits(true)}
              fullWidth
            />
          </>
        )}
      </View>

      {/* ---------------------------------------------------------------- cashiers */}
      <View style={styles.card}>
        <Text style={text.title}>Cashiers — your staff</Text>
        <Text style={[text.caption, styles.muted]}>
          Each person gets their own PIN and starts their own shift, so every bill shows who rang
          it. Add someone when they join, remove them when they leave — you can do this any time.
        </Text>

        {current.cashiers.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>Nobody added yet.</Text>
        ) : (
          current.cashiers.map((c) => (
            <View key={c.name} style={styles.statusRow}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
              <Text style={[text.body, styles.flex]}>{c.name}</Text>
              <Pressable onPress={() => removeCashier(c.name)} hitSlop={8} style={styles.remove}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[text.caption, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={[text.label, styles.addHeading]}>Add a cashier</Text>
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
            placeholder="Their PIN"
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
          loading={submit.busy}
          disabled={!newName.trim() || !newPin}
          fullWidth
        />
      </View>

      <Button
        label={shift.current() ? 'Back to the till' : 'Back to shifts'}
        variant="outline"
        icon="arrow-back"
        onPress={back}
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  remove: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addHeading: { marginTop: spacing.sm },
});
