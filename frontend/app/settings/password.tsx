/**
 * Change password
 *
 * Purpose : Lets the signed-in user set a new password, after proving they know the current one. Same screen for both roles, because a password is not role-specific.
 * Spec    : Section 4.1 and 3.1
 * Look here when : A password change is refused, or the new password does not take effect.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { PasswordInput } from '../../src/components/ui/PasswordInput';
import { MIN_PASSWORD } from '../../src/lib/validate';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { useSubmit } from '../../src/hooks/useSubmit';
import { changePassword } from '../../src/stores/authStore';

/** Matches the minimum the Register screen enforces, so the two never disagree. */
const MIN = MIN_PASSWORD;

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();

  const mismatch = confirm.length > 0 && confirm !== next;
  const unchanged = next.length > 0 && next === current;
  const canSave =
    current.length > 0 && next.length >= MIN && confirm === next && !unchanged;

  async function save() {
    if (!(await run(() => changePassword(current, next)))) return;
    /* Cleared rather than left on screen: the fields hold the real password in plain text. */
    setCurrent('');
    setNext('');
    setConfirm('');
    setDone(true);
  }

  if (done) {
    return (
      <View style={styles.centre}>
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={34} color={colors.onAccent} />
        </View>
        <Text style={[text.h2, styles.centreText]}>Password changed</Text>
        <Text style={[text.label, styles.muted, styles.centreText]}>
          Use the new one next time you sign in. You are still signed in on this phone.
        </Text>
        <Button label="Back to menu" variant="outline" onPress={() => router.back()} fullWidth />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.gap}>
          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            icon="lock-closed-outline"
            hint="Asked for so nobody who picks up your phone can change it."
          />
        </Card>

        <Card style={styles.gap}>
          <PasswordInput
            label="New password"
            value={next}
            onChangeText={setNext}
            icon="key-outline"
            hint={`At least ${MIN} characters.`}
            required
          />
          <PasswordInput
            label="Type it again"
            value={confirm}
            onChangeText={setConfirm}
            icon="key-outline"
            extraErrors={mismatch ? ['The two do not match.'] : undefined}
            required
          />
          {unchanged ? (
            <Text style={[text.caption, styles.warn]}>
              That is the password you already have. Choose a different one.
            </Text>
          ) : null}
        </Card>

        <ErrorBanner message={error} />
        <Button
          label="Change password"
          variant="accent"
          size="lg"
          loading={busy}
          disabled={!canSave}
          onPress={save}
          fullWidth
        />
        <Text style={[text.caption, styles.muted]}>
          Your password never reaches the InventiX server. It goes straight to Supabase, the same
          way signing in does.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  muted: { color: colors.textMuted },
  warn: { color: colors.warning },
  centre: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  centreText: { textAlign: 'center' },
  tick: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
