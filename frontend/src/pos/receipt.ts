/**
 * Printed receipt
 *
 * Purpose : Turns a finished bill into something a printer can produce. No printer driver and no dependency: a thermal roll printer plugged into a laptop is an ordinary printer to the browser.
 * Spec    : Section 6.6
 * Look here when : A receipt prints with the wrong width, or nothing happens when Print is pressed.
 */

import { Platform } from 'react-native';

export interface ReceiptLine {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface ReceiptBill {
  receipt_no: string;
  sold_at: string;
  shop: string;
  cashier: string | null;
  lines: ReceiptLine[];
  discount: number;
  total: number;
  /** Cash sales only. Left out of a card bill, where there is no change to show. */
  tendered?: number | null;
  change?: number | null;
  kind?: 'sale' | 'return';
}

/**
 * Printing is the browser's. On a phone there is no `window.print`, and expo-print would be a
 * dependency carried for a screen the shop does not print from -- the till is the laptop.
 */
export function canPrint(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function';
}

/** A customer's name on a bill is theirs; a product name with a `<` in it is not a tag. */
function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function money(value: number): string {
  return value.toFixed(2);
}

/**
 * 72mm of printable width on an 80mm roll, which is what the cheap counter printers in Sri Lanka
 * take. A4 is the fallback when the shop prints to an ordinary office printer; the same markup
 * works on both because nothing is positioned, only stacked.
 */
function html(bill: ReceiptBill): string {
  const when = new Date(bill.sold_at);
  const rows = bill.lines
    .map(
      (l) => `<tr>
        <td class="n">${escape(l.name)}<br><span class="s">${l.quantity} × ${money(l.unit_price)}</span></td>
        <td class="a">${money(l.quantity * l.unit_price)}</td>
      </tr>`,
    )
    .join('');

  const cash =
    bill.tendered != null
      ? `<tr><td>Cash</td><td class="a">${money(bill.tendered)}</td></tr>
         <tr><td>Change</td><td class="a">${money(bill.change ?? 0)}</td></tr>`
      : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(bill.receipt_no)}</title>
<style>
  @page { size: 72mm auto; margin: 3mm; }
  body { font-family: ui-monospace, "Courier New", monospace; font-size: 12px; color: #000;
         width: 72mm; margin: 0 auto; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; }
  .s { font-size: 10px; color: #444; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.a { text-align: right; white-space: nowrap; padding-left: 6px; }
  .total td { font-size: 14px; font-weight: bold; padding-top: 4px; }
  .foot { margin-top: 8px; font-size: 10px; }
</style></head>
<body>
  <h1>${escape(bill.shop)}</h1>
  <div class="c s">${bill.kind === 'return' ? 'RETURN' : 'Receipt'} ${escape(bill.receipt_no)}</div>
  <div class="c s">${when.toLocaleDateString()} ${when.toLocaleTimeString()}</div>
  ${bill.cashier ? `<div class="c s">Served by ${escape(bill.cashier)}</div>` : ''}
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    ${bill.discount > 0 ? `<tr><td>Discount</td><td class="a">-${money(bill.discount)}</td></tr>` : ''}
    <tr class="total"><td>${bill.kind === 'return' ? 'Refunded' : 'Total'}</td><td class="a">${money(bill.total)}</td></tr>
    ${cash}
  </table>
  <div class="c foot">Thank you — please keep this slip for returns</div>
</body></html>`;
}

/**
 * Prints without leaving the till.
 *
 * A hidden iframe rather than a new window: a popup blocker can stop `window.open`, and the till
 * must not lose focus mid-rush. The frame is removed once the print dialog has been handled, and
 * the whole thing works with no connection because nothing is fetched.
 */
export function printReceipt(bill: ReceiptBill): void {
  if (!canPrint()) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html(bill));
  doc.close();

  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Long enough for the browser to have taken the document. Removing it immediately printed a
    // blank page in Chrome, because the dialog reads the frame after the call returns.
    setTimeout(() => frame.remove(), 1000);
  };

  if (frame.contentWindow?.document.readyState === 'complete') go();
  else frame.onload = go;
}
