/**
 * Festival stock
 *
 * Purpose : Every upcoming festival and the shop's products it affects, with a suggested order quantity each. Opened from the one-line festival card on Stocks.
 * Spec    : Section 6.2
 * Look here when : A festival product is missing, or tapping one does not open a restock request.
 */

import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SeasonalCard } from '../../../src/components/SeasonalCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { useSeasonalWarnings, useStocks } from '../../../src/hooks/useStocks';
import { useOpenRestock } from '../../../src/hooks/useOpenRestock';

export default function SeasonalStock() {
  const seasonal = useSeasonalWarnings();
  const stocks = useStocks();
  const restock = useOpenRestock();

  const festivals = seasonal.data ?? [];
  const items = stocks.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={seasonal.refreshing}
          onRefresh={() => {
            seasonal.refresh();
            stocks.refresh();
          }}
        />
      }
    >
      <ErrorBanner message={seasonal.error} />
      <ErrorBanner message={restock.error} />

      {!seasonal.loading && festivals.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="No festivals coming up"
          message="When a festival is close, the products worth stocking up on will appear here."
        />
      ) : (
        festivals.map((w) => (
          <SeasonalCard
            key={w.id}
            warning={w}
            onProduct={(stockItemId, qty) => {
              const item = items.find((i) => i.id === stockItemId);
              if (item) restock.open([item], qty);
            }}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, backgroundColor: colors.background, flexGrow: 1 },
});
