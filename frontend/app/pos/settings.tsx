/**
 * Till settings
 *
 * Purpose : The owner's side of the till: their PIN, the amounts they want to be asked about, and the staff logins for the people who work the counter.
 * Spec    : Section 6.6
 * Look here when : A limit does not take effect, or a cashier cannot be added, removed or signed in.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { useAuth } from '../../src/hooks/useAuth';
import { useSubmit } from '../../src/hooks/useSubmit';
import { createCashier, listCashiers, removeCashier } from '../../src/api/pos';
import { hashPin, isValidPin } from '../../src/pos/pin';
import * as settings from '../../src/pos/settings';
import type { CashierAccount, PosSettings } from '../../src/types/api';

export default function TillSettings() {
  const { profile, shopId } = useAuth();
  const submit = useSubmit();

  const [current, setCurrent] = useState<PosSettings>(settings.DEFAULTS);
  const [ready, setReady] = useState(false);

  /** Each section shows what is saved until the owner chooses to change it. */
  const [editingPin, setEditingPin] = useState(false);
  const [editingLimits, setEditingLimits] = useState(false);

  const [ownerPin, setOwnerPin] = useState('');
  const [discount, setDiscount] = useState('');
  const [refund, setRefund] = useState('');

  const [staff, setStaff] = useState<CashierAccount[]>([]);
  /**
   * Separate from `error`, because "we could not read the list" and "the list is empty" look
   * identical once the list is empty -- and the screen said "nobody added yet" to a shop whose
   * request had simply failed while the backend was restarting.
   */
  const [staffFailed, setStaffFailed] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  /** The login just made. It stays on screen until dismissed: nothing stores it for the owner. */
  const [madeOne, setMadeOne] = useState<CashierAccount | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const adopt = useCallback((next: PosSettings) => {
    setCurrent(next);
    setDiscount(String(next.discount_limit));
    setRefund(String(next.return_limit));
    setReady(true);
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      setStaff(await listCashiers());
      setStaffFailed(false);
    } catch {
      setStaffFailed(true);
    }
  }, []);

  /**
   * No PIN gate on this screen any more. It is the owner's own account that opens it: a cashier
   * has their own login, no link to here, and a backend that answers them 403. The PIN that
   * used to stand in for that is now only for approving a discount above the shop's limit.
   */
  useFocusEffect(
    useCallback(() => {
      settings.load().then(adopt);
      void loadStaff();
    }, [adopt, loadStaff]),
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
    if (!shopId) return;
    if (!isValidPin(ownerPin)) {
      setError('A PIN is four to six digits.');
      return;
    }
    await persist(
      { ...current, owner_pin_hash: await hashPin(ownerPin, shopId) },
      'Owner PIN saved.',
    );
    setOwnerPin('');
    setEditingPin(false);
  }

  async function removeOwnerPin() {
    await persist(
      { ...current, owner_pin_hash: null },
      'Owner PIN removed. Large discounts now go through without asking.',
    );
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
    setError(null);
    setSaved(null);
    setMadeOne(null);
    const name = newName.trim();
    if (name.length < 2) {
      setError('Type the name of the person who will use this login.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A password needs at least six characters.');
      return;
    }
    await submit.run(async () => {
      const made = await createCashier(name, newPassword);
      setMadeOne(made);
      setNewName('');
      setNewPassword('');
      await loadStaff();
    });
  }

  async function dropCashier(cashier: CashierAccount) {
    setError(null);
    const ok = await submit.run(async () => {
      await removeCashier(cashier.id);
      await loadStaff();
    });
    if (ok) setSaved(`${cashier.name} can no longer sign in.`);
  }

  if (!ready) return <View style={styles.center} />;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ErrorBanner message={error} />
      <ErrorBanner message={submit.error} />
      {saved ? <Text style={[text.label, { color: colors.success }]}>{saved}</Text> : null}

      {/* ---------------------------------------------------------------- cashiers */}
      <View style={styles.card}>
        <Text style={text.title}>Cashiers — your staff</Text>
        <Text style={[text.caption, styles.muted]}>
          Each person gets their own login. They see the till and nothing else: not your orders,
          not your reports, not these settings. Every bill carries their name because they
          signed in, not because a name was tapped on a list.
        </Text>

        {madeOne ? (
          <View style={styles.made}>
            <Text style={text.bodyStrong}>{madeOne.name} can sign in now</Text>
            <Text style={[text.caption, styles.muted]}>
              Write this down and give it to them with the password you just typed. This screen
              cannot show the password again.
            </Text>
            <Text style={[text.bodyStrong, styles.login]} selectable>
              {madeOne.login_email}
            </Text>
            <Button label="Done" variant="outline" onPress={() => setMadeOne(null)} />
          </View>
        ) : null}

        {staffFailed ? (
          <View style={styles.statusRow}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <Text style={[text.caption, styles.flex]}>
              Could not reach the backend, so this list may be out of date.
            </Text>
            <Pressable onPress={loadStaff} hitSlop={8}>
              <Text style={[text.caption, { color: colors.accent }]}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!staffFailed && staff.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>
            Nobody added yet, so you are the one selling.
          </Text>
        ) : (
          staff.map((c) => (
            <View key={c.id} style={styles.statusRow}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
              <View style={styles.flex}>
                <Text style={text.body}>{c.name}</Text>
                <Text style={[text.caption, styles.muted]} selectable>
                  {c.login_email}
                </Text>
              </View>
              <Pressable onPress={() => dropCashier(c)} hitSlop={8} style={styles.remove}>
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
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Password for them"
            secureTextEntry
            containerStyle={styles.flex}
          />
        </View>
        <Button
          label="Create login"
          variant="outline"
          icon="add"
          onPress={addCashier}
          loading={submit.busy}
          disabled={!newName.trim() || newPassword.length < 6}
          fullWidth
        />
      </View>

      {/* ---------------------------------------------------------------- limits */}
      <View style={styles.card}>
        <Text style={text.title}>Ask me when it is bigger than</Text>
        <Text style={[text.caption, styles.muted]}>
          These apply to the whole shop, not to one person. Below them a cashier works without
          interruption; above them the till asks for your PIN. Set either to 0 to be asked every
          time. Selling under your own login, you are never asked.
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

      {/* ---------------------------------------------------------------- owner PIN */}
      <View style={styles.card}>
        <Text style={text.title}>Owner PIN — yours</Text>
        <Text style={[text.caption, styles.muted]}>
          Typed by you at the counter when a cashier needs a discount or a refund above your
          limits. Without one, those go through unasked.
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
                Not set, so a cashier is never stopped by a limit.
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

      <Button
        label="Back to the till"
        variant="outline"
        icon="arrow-back"
        onPress={() => router.replace('/pos')}
        fullWidth
      />
      <Text style={[text.caption, styles.muted]}>
        Signed in as {profile?.contact_person ?? 'the owner'}.
      </Text>
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
  made: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  login: { color: colors.brandInk },
});
