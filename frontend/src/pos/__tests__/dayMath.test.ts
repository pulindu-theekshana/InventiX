/**
 * Day close arithmetic tests
 *
 * Purpose : The drawer figure a cashier counts against, and the rules that decide what goes into it.
 * Spec    : Section 6.6
 * Look here when : After touching src/pos/dayMath.ts.
 */

import { byNewest, emptySummary, isQueued, localDay, mergeDay, queuedAsSale } from '../dayMath';
import type { QueuedSale } from '../queue';
import type { DaySummary, Sale } from '../../types/api';

function queued(overrides: Partial<QueuedSale['sale']> = {}): QueuedSale {
  return {
    sale: {
      client_sale_id: 'c1',
      receipt_no: 'T1-000001',
      device_id: 'T1',
      sold_at: '2026-10-03T09:00:00.000Z',
      payment_method: 'cash',
      discount: 0,
      cashier_label: 'Nimal',
      lines: [{ catalog_product_id: 'p1', stock_item_id: 's1', quantity: 2, unit_price: 250 }],
      ...overrides,
    },
    status: 'waiting',
    attempts: 0,
    lastError: null,
    queuedAt: '2026-10-03T09:00:00.000Z',
  };
}

function server(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    ...emptySummary('2026-10-03'),
    bills: 2,
    sales_total: 1000,
    cash_expected: 1000,
    by_cashier: [{ cashier: 'Nimal', bills: 2, sales_total: 1000 }],
    ...overrides,
  };
}

describe('a queued bill becomes a bill the screen understands', () => {
  it('prices itself from its own lines', () => {
    expect(queuedAsSale(queued()).total).toBe(500);
  });

  it('takes the discount off', () => {
    expect(queuedAsSale(queued({ discount: 100 })).total).toBe(400);
  });

  it('never goes below zero, however large the discount', () => {
    expect(queuedAsSale(queued({ discount: 9999 })).total).toBe(0);
  });

  it('is marked as queued, so it cannot be opened for a return', () => {
    const bill = queuedAsSale(queued());
    expect(isQueued(bill)).toBe(true);
    // The backend has never seen it; a return priced against it would have nothing to read.
    expect(bill.id).toContain(queued().sale.client_sale_id);
  });

  it('keeps a price the cashier typed, so the owner still sees it', () => {
    const row = queued({
      lines: [
        { catalog_product_id: 'p1', stock_item_id: null, quantity: 1, unit_price: 90, price_from_till: true },
      ],
    });
    expect(queuedAsSale(row).lines[0].price_from_till).toBe(true);
  });
});

describe('the drawer figure', () => {
  it('counts what the backend has plus what is still here', () => {
    const merged = mergeDay(server(), [queuedAsSale(queued())]);
    expect(merged.bills).toBe(3);
    expect(merged.sales_total).toBe(1500);
    expect(merged.cash_expected).toBe(1500);
  });

  it('keeps a card sale out of the cash drawer', () => {
    const merged = mergeDay(server(), [queuedAsSale(queued({ payment_method: 'card' }))]);
    expect(merged.cash_expected).toBe(1000);
    expect(merged.card_total).toBe(500);
    // Still a sale, and still counted in the day's takings.
    expect(merged.sales_total).toBe(1500);
  });

  it('works with nothing from the backend at all', () => {
    const merged = mergeDay(null, [queuedAsSale(queued())], '2026-10-03');
    expect(merged.date).toBe('2026-10-03');
    expect(merged.bills).toBe(1);
    expect(merged.cash_expected).toBe(500);
  });

  it('does not change the summary it was given', () => {
    const original = server();
    mergeDay(original, [queuedAsSale(queued())]);
    // A refresh that mutated its own input would double count on the second run.
    expect(original.bills).toBe(2);
    expect(original.by_cashier[0].sales_total).toBe(1000);
  });

  it('adds a queued bill to the person who rang it', () => {
    const merged = mergeDay(server(), [queuedAsSale(queued())]);
    expect(merged.by_cashier).toEqual([{ cashier: 'Nimal', bills: 3, sales_total: 1500 }]);
  });

  it('gives a new cashier their own line, busiest first', () => {
    const merged = mergeDay(server(), [
      queuedAsSale(queued({ cashier_label: 'Kamal', client_sale_id: 'c2' })),
    ]);
    expect(merged.by_cashier.map((c) => c.cashier)).toEqual(['Nimal', 'Kamal']);
  });

  it('keeps cents exact across many bills', () => {
    const bills = [0.1, 0.2].map((price, i) =>
      queuedAsSale(
        queued({
          client_sale_id: `c${i}`,
          lines: [{ catalog_product_id: 'p1', stock_item_id: null, quantity: 1, unit_price: price }],
        }),
      ),
    );
    expect(mergeDay(null, bills).sales_total).toBe(0.3);
  });
});

describe('the day a bill belongs to', () => {
  it('is the device\'s day, not UTC\'s', () => {
    // Half past midnight in Colombo is still the previous day in UTC. A till reading UTC would
    // drop this bill out of the shift that is still open.
    const justAfterMidnight = new Date('2026-10-03T00:30:00+05:30');
    expect(localDay(justAfterMidnight)).toBe('2026-10-03');
  });

  it('pads single digits, because a string comparison is what reads it', () => {
    expect(localDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('the bill list', () => {
  it('is newest first, with queued bills in their place by time', () => {
    const sent = { ...queuedAsSale(queued()), id: 'real-1', sold_at: '2026-10-03T10:00:00.000Z' } as Sale;
    const waiting = queuedAsSale(queued({ sold_at: '2026-10-03T11:00:00.000Z' }));
    expect(byNewest([sent, waiting]).map((b) => b.id)).toEqual([waiting.id, 'real-1']);
  });
});
