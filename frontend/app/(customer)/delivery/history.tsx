/**
 * Order history
 * 
 * Purpose : Completed, rejected and cancelled orders. Spec 8.1 keeps these out of the two live sections so recent failures stay findable without cluttering active work.
 * Spec    : Section 8.1
 * Look here when : A rejected order clutters or vanishes.
 */

import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { OrderCard } from '../../../src/components/OrderCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { spacing } from '../../../src/theme/spacing';
import { useCustomerOrders } from '../../../src/hooks/useOrders';

const CLOSED = ['purchased', 'rejected', 'cancelled'];

export default function History() {
  const orders = useCustomerOrders();
  const closed = (orders.data ?? []).filter((o) => CLOSED.includes(o.status));

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} />}
    >
      <ErrorBanner message={orders.error} />
      {closed.length === 0 ? (
        <EmptyState
          icon="archive-outline"
          title="No past orders yet"
          message="Completed, rejected and cancelled orders are kept here."
        />
      ) : (
        closed.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            showProgress={false}
            onPress={() => router.push(`/(customer)/delivery/${o.id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg },
});
