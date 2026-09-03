/**
 * Auth layout
 * 
 * Purpose : Headers and back behaviour for the signed-out screens.
 * Spec    : Section 4.1
 * Look here when : Auth screens have wrong headers or back behaviour.
 */

import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { text } from '../../src/theme/typography';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.brandInk,
        headerTitleStyle: { ...text.h2, color: colors.brandInk },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.primary },
      }}
    >
      {/* Login is the entry point, so it carries the brand rather than a header bar. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="choose-role" options={{ title: 'Create account' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="profile-setup" options={{ title: 'Your details' }} />
    </Stack>
  );
}
