/**
 * Rating prompt
 * 
 * Purpose : One to five stars and an optional comment, shown after confirming receipt. Skippable but shown twice.
 * Spec    : Section 12.3
 * Look here when : Ratings are never collected, which breaks 40 percent of the ranking.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, text } from '../theme/typography';

interface Props {
  visible: boolean;
  supplierName: string;
  /** How many times this prompt has already been dismissed for this order. Spec 12.3. */
  timesDismissed: number;
  onSubmit: (score: number, comment: string) => void;
  onDismiss: () => void;
}

export function RatingPrompt({
  visible,
  supplierName,
  timesDismissed,
  onSubmit,
  onDismiss,
}: Props) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  /**
   * Spec 12.3 and open question Q6: skippable, but shown twice, because the quality
   * component is 40 percent of the ranking and it is the only part a human must supply.
   */
  const lastChance = timesDismissed >= 1;

  return (
    <Modal
      visible={visible}
      onClose={onDismiss}
      variant="dialog"
      title={'How was ' + supplierName + '?'}
      footer={
        <View style={styles.footer}>
          <Button
            label="Submit rating"
            variant="accent"
            disabled={score === 0}
            onPress={() => onSubmit(score, comment.trim())}
            fullWidth
          />
          <Button
            label={lastChance ? 'No thanks' : 'Maybe later'}
            variant="ghost"
            size="sm"
            onPress={onDismiss}
            fullWidth
          />
        </View>
      }
    >
      <Text style={[text.body, styles.lead]}>
        Ratings are how other shop owners find reliable suppliers, and how this supplier earns
        their ranking.
      </Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setScore(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={n + ' star' + (n === 1 ? '' : 's')}
          >
            <Ionicons
              name={n <= score ? 'star' : 'star-outline'}
              size={38}
              color={n <= score ? colors.warning : colors.border}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="Anything worth saying? (optional)"
        placeholderTextColor={colors.textSubtle}
        value={comment}
        onChangeText={setComment}
        multiline
        style={styles.comment}
      />

      {lastChance ? (
        <Text style={[text.caption, styles.lastChance]}>
          This is the last time we will ask about this order.
        </Text>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  comment: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
  },
  lastChance: { color: colors.textSubtle, textAlign: 'center' },
  footer: { gap: spacing.sm },
});
