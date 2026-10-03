/**
 * Owner PIN prompt
 *
 * Purpose : Asks for the owner's PIN before something the shop wants the owner to see: a large discount, a large refund, or leaving the till.
 * Spec    : Section 6.6
 * Look here when : The till asks for a PIN at the wrong moment, or a correct PIN is refused.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { pinMatches } from '../pos/pin';
import { current as currentSettings } from '../pos/settings';

interface Props {
  visible: boolean;
  shopId: string;
  /** Said plainly, so the owner knows what they are approving before they type. */
  reason: string;
  onCancel: () => void;
  onApproved: () => void;
}

export function OwnerPin({ visible, shopId, reason, onCancel, onApproved }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const ok = await pinMatches(pin, currentSettings().owner_pin_hash, shopId);
    if (!ok) {
      setError('That is not the owner PIN.');
      return;
    }
    setPin('');
    setError(null);
    onApproved();
  }

  function close() {
    setPin('');
    setError(null);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close}>
        {/* Stops a tap inside the card closing it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={text.h2}>Owner PIN</Text>
          <Text style={[text.label, styles.muted]}>{reason}</Text>

          <Input
            value={pin}
            onChangeText={(v) => {
              setPin(v);
              setError(null);
            }}
            onSubmitEditing={check}
            placeholder="····"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            error={error}
          />

          <View style={styles.row}>
            <Button label="Cancel" variant="outline" onPress={close} style={styles.flex} />
            <Button
              label="Approve"
              variant="accent"
              onPress={check}
              disabled={pin.length < 4}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
