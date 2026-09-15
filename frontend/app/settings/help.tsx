/**
 * Help and support
 *
 * Purpose : Explains the app in the words the screens actually use, for whichever role is signed in. Numbers quoted here are the shipped app_config defaults, so they match what the app really does.
 * Spec    : -
 * Look here when : A guideline contradicts the app, which means the behaviour changed and this file did not.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { useAuth } from '../../src/hooks/useAuth';

interface Topic {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string[];
}

/** Spec 8 and 9. Written against the tab names a shop owner actually sees. */
const CUSTOMER: Topic[] = [
  {
    icon: 'layers-outline',
    title: 'Stocks — what you sell',
    body: [
      'Every product your shop holds lives here, with how many you have left. Set a minimum for each one, and the product is marked Low the moment it drops below it.',
      'Low stock is what drives everything else: it is where a restock order starts, and it is what the Reports tab counts.',
    ],
  },
  {
    icon: 'cloud-upload-outline',
    title: 'Uploading a sales report',
    body: [
      'Rather than counting down by hand, export a sales report from your POS as CSV or Excel and upload it. Stock comes down by what you sold.',
      'The first upload asks you to match the columns, and to match any product name your POS spells differently from the catalog. Both are remembered, so later uploads are one tap.',
      'If a week goes by with no upload, the app reminds you — stock that is never adjusted slowly stops meaning anything.',
    ],
  },
  {
    icon: 'people-outline',
    title: 'Finding a supplier',
    body: [
      'Search the Suppliers tab by name, or search for a product and see everyone who sells it, best match first.',
      'Each supplier carries a score out of 100. Anyone with fewer than three completed orders is marked New supplier, and their score is provisional rather than earned.',
    ],
  },
  {
    icon: 'star-outline',
    title: 'What the score means',
    body: [
      'Quality is 40 percent of it, delivery speed 30, how much they can supply 20, and price 10.',
      'Delivery speed is measured from orders that actually completed, not from what the supplier claims. A supplier cannot improve it by promising.',
      'Quality comes only from shop owners rating them, which is why the app asks you after a delivery.',
    ],
  },
  {
    icon: 'paper-plane-outline',
    title: 'Placing an order',
    body: [
      'Start from a product that is low, choose a supplier and a quantity, and the app writes the restock message for you. Read it before it goes — you can change it.',
      'It reaches the supplier in the app if they use InventiX, or by WhatsApp or email if they do not. Either way the order appears in your Delivery tab.',
    ],
  },
  {
    icon: 'cube-outline',
    title: 'Tracking and confirming',
    body: [
      'The Delivery tab follows an order through six stages, from requested to completed.',
      'Confirm receipt only once the goods are actually in front of you. It is the only action that adds stock back, it completes the order, and it cannot be undone.',
      'If you never confirm, the order closes by itself three days after the supplier marks it delivered — and you get a warning notification the day before that happens.',
    ],
  },
  {
    icon: 'chatbox-ellipses-outline',
    title: 'Rating a supplier',
    body: [
      'Straight after confirming receipt the app asks how the delivery was. It is skippable, and it is asked at most twice for any one order.',
      'It is worth the ten seconds: your rating is the largest single part of that supplier ranking, and it is the only part no machine can work out on its own.',
    ],
  },
  {
    icon: 'analytics-outline',
    title: 'Reports',
    body: [
      'Five summaries of what your shop is doing. They fill in as sales history builds up, so a new account sees the headings before it sees the figures.',
    ],
  },
];

/** Spec 10 and 11. Written against the tab names a supplier actually sees. */
const SUPPLIER: Topic[] = [
  {
    icon: 'layers-outline',
    title: 'Stocks — what you offer',
    body: [
      'Each listing is one product you sell, with its price, how many you hold, the smallest order you accept and how long you usually take to deliver.',
      'This is what shop owners search. If a listing is wrong here, it is wrong for every customer looking for it.',
    ],
  },
  {
    icon: 'add-circle-outline',
    title: 'Adding a product',
    body: [
      'Tap the + button on Stocks. Pick the product from the shared catalog rather than typing a name — that is what makes a shop owner searching for rice find yours.',
      'Category belongs to the product, so you filter by it rather than set it. Price, quantity and delivery time are yours.',
      'The smallest order you accept starts at 1, and you can change it on the listing afterwards.',
    ],
  },
  {
    icon: 'eye-off-outline',
    title: 'Stopping a listing',
    body: [
      'Stop selling hides a listing from customer search without deleting it, so every order that already referred to it keeps working. That is why there is no delete.',
      'Start selling again whenever you like, at whatever price is set at the time.',
    ],
  },
  {
    icon: 'cart-outline',
    title: 'Orders — Pending, Active, History',
    body: [
      'Pending is what needs an answer from you. Active is everything you have accepted and not yet finished. History keeps the rest, and nothing ever disappears.',
      'An order left unanswered for a day sends you a reminder. A shop owner waiting on an answer cannot order elsewhere without giving up on you first.',
    ],
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Confirming and rejecting',
    body: [
      'Confirming reserves the quantity off your listing straight away, so you are not shown as still holding what you have committed.',
      'If your quantity has fallen below what was ordered since it came in, confirm is refused and names the product. Rejecting is then the only honest answer.',
      'A rejection needs a reason of at least five characters, and the shop owner reads it. Their products go back to Low stock so they can order elsewhere, so a vague reason just costs them time.',
    ],
  },
  {
    icon: 'swap-horizontal-outline',
    title: 'The delivery queue',
    body: [
      'Confirmed, processing, put to delivery, on the way. One stage at a time — the app will not let you skip one, and there is no way back once a stage is set.',
      'The queue only holds what is in flight. Finished, rejected and cancelled orders live in the Orders tab instead.',
    ],
  },
  {
    icon: 'hand-left-outline',
    title: 'Marked delivered is not completed',
    body: [
      'Marking an order delivered tells the shop owner to confirm receipt. It does not complete the order, because their stock should rise on a fact rather than on a claim.',
      'If they never confirm, the order closes by itself after three days — but a delivery nobody verified does not count towards your measured speed.',
    ],
  },
  {
    icon: 'trophy-outline',
    title: 'How your ranking is built',
    body: [
      'Quality is 40 percent, delivery speed 30, the quantity you can supply 20, and price 10.',
      'Quality comes from shop owners rating your deliveries. Speed is measured from orders that completed, so it rewards what you did rather than what you promised.',
      'Until three orders have completed you are shown as a new supplier and the score is provisional.',
    ],
  },
];

/** Both roles look at the same six stages from opposite ends, so this is shared. */
const PIPELINE: { stage: string; who: string }[] = [
  { stage: 'Requested', who: 'the shop sends the order' },
  { stage: 'Confirmed', who: 'the supplier accepts it' },
  { stage: 'Processing', who: 'the supplier is preparing it' },
  { stage: 'Put to delivery', who: 'packed and handed over' },
  { stage: 'On the way', who: 'out for delivery' },
  { stage: 'Completed', who: 'the shop confirms it arrived' },
];

export default function Help() {
  const { isSupplier } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const topics = isSupplier ? SUPPLIER : CUSTOMER;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.gap}>
        <Text style={text.title}>
          {isSupplier ? 'Selling through InventiX' : 'Running your shop with InventiX'}
        </Text>
        <Text style={[text.label, styles.muted]}>
          {isSupplier
            ? 'Shop owners find you by what you sell and how well you have delivered before. Everything below is about keeping both of those accurate.'
            : 'InventiX keeps track of what you are running low on and who can restock it, so you order before you run out rather than after.'}
        </Text>
      </Card>

      {topics.map((t) => (
        <Section
          key={t.title}
          topic={t}
          open={open === t.title}
          onToggle={() => setOpen(open === t.title ? null : t.title)}
        />
      ))}

      <Card style={styles.gap}>
        <Text style={text.title}>How an order moves</Text>
        <Text style={[text.caption, styles.muted]}>
          Six stages, the same six for everyone. The supplier drives it as far as on the way, and
          only the shop can complete it.
        </Text>
        {PIPELINE.map((p, i) => (
          <View key={p.stage} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={[text.caption, { color: colors.onAccent }]}>{i + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>{p.stage}</Text>
              <Text style={[text.caption, styles.muted]}>{p.who}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Still stuck?</Text>
        <Text style={[text.label, styles.muted]}>
          Tell whoever set up your InventiX account what you were doing and what you expected to
          happen instead. Your business name is on My profile, and that is what identifies your
          account.
        </Text>
        <Text style={[text.caption, styles.subtle]}>
          If something on this page disagrees with what the app does, trust the app and say so —
          it means the app changed and this page did not.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Section({
  topic,
  open,
  onToggle,
}: {
  topic: Topic;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card padded={false}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.head}
      >
        <Ionicons name={topic.icon} size={20} color={colors.accent} />
        <Text style={[text.bodyStrong, styles.flex]}>{topic.title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSubtle}
        />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {topic.body.map((p) => (
            <Text key={p} style={[text.label, styles.paragraph]}>
              {p}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  muted: { color: colors.textMuted },
  subtle: { color: colors.textSubtle },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  paragraph: { color: colors.textMuted },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
