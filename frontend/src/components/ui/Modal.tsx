/**
 * Modal
 * 
 * Purpose : Shared modal used by the restock popup and confirmations.
 * Spec    : -
 * Look here when : A dialog behaves oddly.
 */

import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { elevation, radius, spacing } from '../../theme/spacing';
import { text } from '../../theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** A sheet fills most of the screen and scrolls; a dialog hugs its content. */
  variant?: 'sheet' | 'dialog';
  footer?: React.ReactNode;
}

export function Modal({ visible, onClose, title, children, variant = 'sheet', footer }: Props) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.centre} pointerEvents="box-none">
        <View
          style={[
            styles.panel,
            variant === 'sheet' ? styles.sheet : styles.dialog,
            elevation(3),
          ]}
        >
          {title ? (
            <View style={styles.header}>
              <Text style={[text.h2, { color: colors.brandInk, flex: 1 }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}

          {variant === 'sheet' ? (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,14,4,0.45)' },
  centre: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  panel: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  sheet: { maxHeight: '86%' },
  dialog: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
