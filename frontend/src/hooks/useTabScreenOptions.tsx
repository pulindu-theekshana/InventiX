/**
 * Tab screen options
 * 
 * Purpose : The header and tab bar styling shared by the customer and supplier bars, including the bottom safe area. The two groups differ only in which tabs they list, so the chrome lives here and neither layout restates it.
 * Spec    : Section 4.2
 * Look here when : The tab bar sits under the system navigation bar, or the two bars look different from each other.
 */

import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabHeaderButtons } from '../components/TabHeaderButtons';
import { colors } from '../theme/colors';
import { fontSize, text } from '../theme/typography';

type TabScreenOptions = NonNullable<ComponentProps<typeof Tabs>['screenOptions']>;

/** Height of the bar itself, before anything the operating system reserves below it. */
// Sized so the selected pill wraps its content evenly: 5 padding + 28 icon box + 18 label + 5
// padding = 56, plus the bar's own top and bottom padding. Shorter and the pill clips the label.
const BAR_HEIGHT = 70;
const BAR_PADDING_BOTTOM = 8;
/** The bar's own geometry, unchanged: the larger icon and label still fit inside it. */
const BAR_PADDING_TOP = 6;

/** A step up from the navigator's 24pt default. Sized to the room BAR_HEIGHT leaves. */
export const TAB_ICON_SIZE = 26;

const PILL_RADIUS = 20;

export function useTabScreenOptions(): TabScreenOptions {
  const insets = useSafeAreaInsets();

  return {
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.brandInk,
    headerTitleStyle: { ...text.h2, color: colors.brandInk },
    headerTitleAlign: 'center',
    headerShadowVisible: false,
    headerRight: () => <TabHeaderButtons />,
    tabBarActiveTintColor: colors.brandInk,
    tabBarInactiveTintColor: colors.textSubtle,
    /** The selected tab sits in a soft yellow pill, so where you are reads at a glance. */
    tabBarActiveBackgroundColor: colors.primaryTint,
    tabBarItemStyle: { borderRadius: PILL_RADIUS, overflow: 'hidden', marginHorizontal: 6 },
    /** One step up the type scale from caption, so the labels match the larger icons. Bold when selected. */
    tabBarLabel: ({ focused, color, children }) => (
      <Text style={[text.caption, styles.label, { color, fontWeight: focused ? '700' : '500' }]}>{children}</Text>
    ),
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
      paddingTop: BAR_PADDING_TOP,
    },
    sceneStyle: { backgroundColor: colors.background },
  };
}

const styles = StyleSheet.create({
  // 18, not 16: at 13pt bold the descender of y and p falls outside a 16pt line and is clipped.
  label: { fontSize: fontSize.sm, lineHeight: 18 },
});
