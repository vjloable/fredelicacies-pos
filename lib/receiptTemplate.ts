// lib/receiptTemplate.ts
// Utility for formatting order receipts for ESC/POS printers

export interface ReceiptOrderItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface ReceiptOrderData {
  orderId: string;
  date: Date;
  items: ReceiptOrderItem[];
  subtotal: number;
  discount?: number;
  total: number;
  payment: number;
  change: number;
  cashier?: string;
  storeName?: string;
}

// Helper to pad/align text for ESC/POS
function padRight(str: string, len: number) {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}
function padLeft(str: string, len: number) {
  return str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str;
}

export function formatReceiptESC(order: ReceiptOrderData): Uint8Array {
  const encoder = new TextEncoder();
  const esc = (arr: number[]) => new Uint8Array(arr);
  const lines: (string|Uint8Array)[] = [];

  // Header
  lines.push(esc([0x1B, 0x40])); // Initialize
  lines.push(esc([0x1B, 0x61, 0x01])); // Center
  lines.push(esc([0x1D, 0x21, 0x11])); // Double height/width
  lines.push(encoder.encode((order.storeName || 'FOODMOOD POS') + '\n'));
  lines.push(esc([0x1D, 0x21, 0x00])); // Normal
  lines.push(encoder.encode('\n'));
  lines.push(esc([0x1B, 0x61, 0x00])); // Left
  lines.push(encoder.encode(`Order #: ${order.orderId}\n`));
  lines.push(encoder.encode(`Date: ${order.date.toLocaleString()}\n`));
  lines.push(encoder.encode('\n'));

  // Items
  lines.push(encoder.encode('QTY  ITEM                AMOUNT\n'));
  lines.push(encoder.encode('-------------------------------\n'));
  for (const item of order.items) {
    const qty = padLeft(item.qty.toString(), 2);
    const name = padRight(item.name, 18);
    const amount = padLeft(item.total.toFixed(2), 8);
    lines.push(encoder.encode(`${qty}  ${name}${amount}\n`));
  }
  lines.push(encoder.encode('-------------------------------\n'));

  // Totals
  lines.push(encoder.encode(padLeft('Subtotal:', 22) + padLeft(order.subtotal.toFixed(2), 10) + '\n'));
  if (order.discount && order.discount > 0) {
    lines.push(encoder.encode(padLeft('Discount:', 22) + padLeft('-' + order.discount.toFixed(2), 10) + '\n'));
  }
  lines.push(encoder.encode(padLeft('TOTAL:', 22) + padLeft(order.total.toFixed(2), 10) + '\n'));
  lines.push(encoder.encode(padLeft('Payment:', 22) + padLeft(order.payment.toFixed(2), 10) + '\n'));
  lines.push(encoder.encode(padLeft('Change:', 22) + padLeft(order.change.toFixed(2), 10) + '\n'));
  lines.push(encoder.encode('\n'));

  // Footer
  if (order.cashier) {
    lines.push(encoder.encode(`Cashier: ${order.cashier}\n`));
  }
  lines.push(encoder.encode('\n'));
  lines.push(esc([0x1B, 0x61, 0x01])); // Center
  lines.push(encoder.encode('Thank you!\n'));
  lines.push(encoder.encode('\n\n\n'));
  lines.push(esc([0x1D, 0x56, 0x00])); // Cut

  // Concatenate all Uint8Arrays
  let totalLen = 0;
  for (const l of lines) totalLen += l instanceof Uint8Array ? l.length : 0;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const l of lines) {
    if (l instanceof Uint8Array) {
      result.set(l, offset);
      offset += l.length;
    }
  }
  return result;
}
