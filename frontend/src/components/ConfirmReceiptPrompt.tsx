/**
 * Confirm receipt prompt
 *
 * Purpose : Asks whether the goods actually arrived before completing an order. Confirming receipt is the only action that tops up stock, and it cannot be undone, so it is the one place a mis-tap is expensive.
 * Spec    : Section 11.2
 * Look here when : Stock rose for an order that never arrived, or the dialog does not appear.
 */

import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { quantity } from '../lib/format';

interface Props {
  visible: boolean;
  supplierName: string;
  /** Shown so the shop owner can check the number against what is in front of them. */
  units: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmReceiptPrompt({
  visible,
  supplierName,
  units,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      variant="dialog"
      title="Did the goods actually arrive?"
      footer={
        <View style={styles.footer}>
          <Button
            label="Yes, I have them"
            variant="send"
            icon="checkmark-circle-outline"
            loading={busy}
            onPress={onConfirm}
            fullWidth
          />
          <Button label="Not yet" variant="ghost" size="sm" onPress={onCancel} fullWidth />
        </View>
      }
    >
      <Text style={[text.body, styles.lead]}>
        Only confirm once the delivery is in front of you. {supplierName} has said it is on its
        way, but your stock should rise on what arrived, not on what was promised.
      </Text>

      <View style={styles.effect}>
        <Ionicons name="cube-outline" size={18} color={colors.accent} />
        <Text style={[text.label, styles.flex]}>
          {quantity(units)} units will be added to your stock.
        </Text>
      </View>

      {/* Spec 11.2: completing an order is terminal, and saying so here is cheaper than
          explaining afterwards why the numbers cannot be put back. */}
      <Text style={[text.caption, styles.warning]}>
        This completes the order and cannot be undone.
      </Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted },
  effect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginTop: spacing.md,
  },
  flex: { flex: 1 },
  warning: { color: colors.textSubtle, marginTop: spacing.sm },
  footer: { gap: spacing.sm },
});
