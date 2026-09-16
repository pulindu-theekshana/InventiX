/**
 * Register
 * 
 * Purpose : Email and password for a new account, showing which role was chosen and letting it be changed before anything is committed. The role only becomes real when the profile row is written.
 * Spec    : Section 4.1
 * Look here when : Registration fails.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmailInput } from '../../src/components/ui/EmailInput';
import { PasswordInput } from '../../src/components/ui/PasswordInput';
import { MIN_PASSWORD } from '../../src/lib/validate';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { elevation, radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { toMessage } from '../../src/lib/errors';
import { signUp } from '../../src/stores/authStore';
import { useAuth } from '../../src/hooks/useAuth';

export default function Register() {
  const { pendingRole, demo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Reached directly without picking a role: send them back rather than guessing one. */
  if (!pendingRole) return <Redirect href="/(auth)/choose-role" />;

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = email.trim().length > 0 && password.length >= MIN_PASSWORD && confirm === password;

  async function handleRegister() {
    setBusy(true);
    setError(null);
    try {
      if (!demo) await signUp(email.trim(), password);
      router.push('/(auth)/profile-setup');
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
          {/* The role is shown and changeable here, because here it is not yet committed. */}
          <Pressable
            style={styles.chip}
            onPress={() => router.replace('/(auth)/choose-role')}
            accessibilityRole="button"
            accessibilityLabel={'Registering as ' + pendingRole + '. Tap to change.'}
          >
            <Ionicons
              name={pendingRole === 'customer' ? 'storefront-outline' : 'business-outline'}
              size={16}
              color={colors.accent}
            />
            <Text style={[text.label, styles.chipText]}>
              Registering as {pendingRole === 'customer' ? 'Customer' : 'Supplier'}
            </Text>
            <Text style={[text.label, { color: colors.accent }]}>Change</Text>
          </Pressable>

          <Text style={[text.h2, styles.heading]}>Create your account</Text>
          <ErrorBanner message={error} />

          <EmailInput value={email} onChangeText={setEmail} required />
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            required
          />
          <PasswordInput
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            extraErrors={mismatch ? ['These two do not match.'] : undefined}
            required
          />

          <Button
            label="Continue"
            variant="accent"
            size="lg"
            loading={busy}
            disabled={!canSubmit}
            onPress={handleRegister}
            fullWidth
          />
          <Text style={[text.caption, styles.note]}>
            Next you will enter your business details.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: colors.text },
  heading: { color: colors.text },
  note: { color: colors.textSubtle, textAlign: 'center' },
});
