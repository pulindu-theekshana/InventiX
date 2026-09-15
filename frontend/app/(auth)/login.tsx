/**
 * Login
 * 
 * Purpose : Email and password against Supabase auth. No role anywhere on this screen: the role belongs to the account, and asking here would be a question the account already answers.
 * Spec    : Section 4.1
 * Look here when : Login fails or the screen does not match the design.
 */

import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { elevation, radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { toMessage } from '../../src/lib/errors';
import { signIn, signInDemo } from '../../src/stores/authStore';
import { useAuth } from '../../src/hooks/useAuth';

export default function Login() {
  const { demo } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Login draws its own brand instead of a header, so nothing above it reserves the
          status bar or the home indicator. It has to inset itself. */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: spacing.lg + insets.top, paddingBottom: spacing.lg + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={[text.h1, styles.brandName]}>InventiX</Text>
          <Text style={[text.body, styles.brandTag]}>Inventory that warns you first</Text>
        </View>

        <View style={[styles.sheet, elevation(2)]}>
          <Text style={[text.h2, styles.heading]}>Sign in</Text>
          <ErrorBanner message={error} />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            icon="mail-outline"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            icon="lock-closed-outline"
          />

          <Pressable style={styles.forgot} onPress={() => {}}>
            <Text style={[text.label, { color: colors.accent }]}>Forgot password?</Text>
          </Pressable>

          <Button
            label="Login"
            variant="accent"
            size="lg"
            loading={busy}
            disabled={!email.trim() || !password}
            onPress={handleLogin}
            fullWidth
          />

          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={[text.caption, styles.dividerText]}>Or continue with</Text>
            <View style={styles.rule} />
          </View>

          <Button label="Sign in with Google" variant="outline" icon="logo-google" onPress={() => {}} fullWidth />

          {/* Only reachable before Supabase is configured. Lets the UI be walked end to end. */}
          {demo ? (
            <View style={styles.demo}>
              <View style={styles.demoNote}>
                <Ionicons name="information-circle" size={16} color={colors.info} />
                <Text style={[text.caption, { color: colors.textMuted, flex: 1 }]}>
                  Supabase is not connected yet. Explore the app with sample data.
                </Text>
              </View>
              <View style={styles.demoRow}>
                <Button
                  label="As a customer"
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    signInDemo('customer');
                    router.replace('/(customer)/stocks');
                  }}
                  style={styles.flex}
                />
                <Button
                  label="As a supplier"
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    signInDemo('supplier');
                    router.replace('/(supplier)/listings');
                  }}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.signup}>
            <Text style={[text.label, styles.muted]}>Do not have an account?</Text>
            <Link href="/(auth)/choose-role" asChild>
              <Pressable hitSlop={8}>
                <Text style={[text.bodyStrong, { color: colors.accent }]}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: { width: 84, height: 84, borderRadius: radius.xl },
  brandName: { color: colors.brandInk },
  brandTag: { color: colors.brandInk, opacity: 0.75 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: { color: colors.text, marginBottom: spacing.xs },
  forgot: { alignSelf: 'flex-end' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textSubtle },
  demo: { gap: spacing.sm, marginTop: spacing.sm },
  demoNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  demoRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  signup: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  muted: { color: colors.textMuted },
});
