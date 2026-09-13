/**
 * Root layout
 * 
 * Purpose : Restores the session once at launch, holds the splash until the role is known, and routes into the customer or supplier group. Nothing below this point needs to check the role again.
 * Spec    : Section 4.2
 * Look here when : A user lands in the wrong app after login.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../src/hooks/useAuth';
import { initialise } from '../src/stores/authStore';
import { colors } from '../src/theme/colors';
import { text } from '../src/theme/typography';

/**
 * Restoring the session and reading the role is asynchronous. Holding the splash across it is
 * what stops a signed-in user seeing the login screen flash past, which is the single thing
 * that makes an app feel broken on launch.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden — not an error worth surfacing */
});

export default function RootLayout() {
  const { status } = useAuth();

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  /** The native splash is still up, so rendering nothing here is correct, not a blank screen. */
  if (status === 'loading') return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.brandInk,
          headerTitleStyle: { ...text.h2, color: colors.brandInk },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="(supplier)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Menu' }} />
        <Stack.Screen name="settings/profile" options={{ title: 'My profile' }} />
        <Stack.Screen name="settings/help" options={{ title: 'Help and support' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
