/**
 * Sign-out confirmation
 *
 * Purpose : Warns the cashier before they sign out of a till that cannot sign them back in — no connection, or bills still waiting to go.
 * Spec    : Section 6.6
 * Look here when : Someone is locked out of a till after a shift, or signs out with unsent bills.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

interface Props {
  visible: boolean;
  /** How many bills are still on the device. They survive the sign-out; the cashier should know. */
  waiting: number;
  offline: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Signing out needs the server to sign anyone back in, so doing it on a dead line leaves the
 * counter with a login screen it cannot answer. The till is the one place where staying signed in
 * is the safer choice, which is the opposite of the usual advice and worth saying on screen.
 */
export function ConfirmSignOut({ visible, waiting, offline, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.head}>
            <Ionicons
              name={offline ? 'cloud-offline-outline' : 'log-out-outline'}
              size={22}
              color={offline ? colors.warning : colors.textMuted}
            />
            <Text style={text.h2}>Sign out?</Text>
          </View>

          {offline ? (
            <Text style={[text.label, styles.muted]}>
              There is no connection, so nobody can sign in again until it is back — including you.
              On a shop with a patchy line, leaving the till signed in is the safer choice.
            </Text>
          ) : (
            <Text style={[text.label, styles.muted]}>
              The next person signs in with their own login, and their name goes on their bills.
            </Text>
          )}

          {waiting > 0 ? (
            <Text style={[text.label, styles.muted]}>
              {waiting} bill(s) are still on this till. They are kept and sent when the connection
              is back — signing out does not lose them.
            </Text>
          ) : null}

          <View style={styles.row}>
            <Button label="Stay signed in" variant="accent" onPress={onCancel} style={styles.flex} />
            <Button label="Sign out anyway" variant="outline" onPress={onConfirm} style={styles.flex} />
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
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
