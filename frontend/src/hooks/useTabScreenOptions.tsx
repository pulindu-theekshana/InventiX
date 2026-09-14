/**
 * Tab screen options
 * 
 * Purpose : The header and tab bar styling shared by the customer and supplier bars, including the bottom safe area. The two groups differ only in which tabs they list, so the chrome lives here and neither layout restates it.
 * Spec    : Section 4.2
 * Look here when : The tab bar sits under the system navigation bar, or the two bars look different from each other.
 */

import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabHeaderButtons } from '../components/TabHeaderButtons';
import { colors } from '../theme/colors';
import { text } from '../theme/typography';

type TabScreenOptions = NonNullable<ComponentProps<typeof Tabs>['screenOptions']>;

/** Height of the bar itself, before anything the operating system reserves below it. */
const BAR_HEIGHT = 62;
const BAR_PADDING_BOTTOM = 8;

export function useTabScreenOptions(): TabScreenOptions {
  const insets = useSafeAreaInsets();

  return {
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.brandInk,
    headerTitleStyle: { ...text.h2, color: colors.brandInk },
    headerTitleAlign: 'center',
    headerShadowVisible: false,
    headerRight: () => <TabHeaderButtons />,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarLabelStyle: text.caption,
    /**
     * The bar has to clear whatever the operating system owns along the bottom edge: Android's
     * navigation bar, which draws over the app because app.json turns edge to edge on, or the
     * iPhone home indicator. That reservation is a different height on every device, so it is
     * read at runtime instead of guessed. On a device that reserves nothing the inset is 0 and
     * the bar measures exactly BAR_HEIGHT, as it did before.
     */
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      height: BAR_HEIGHT + insets.bottom,
      paddingBottom: BAR_PADDING_BOTTOM + insets.bottom,
      paddingTop: 6,
    },
    sceneStyle: { backgroundColor: colors.background },
  };
}
