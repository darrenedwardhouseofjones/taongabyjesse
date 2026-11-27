import type { Order } from '../types';

export function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  // Guard spreadsheets against formula injection on non-numeric strings
  if (str.length > 0 && !/^-?\d+(\.\d+)?$/.test(str) && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildOrdersCsv(orders: Order[]): string {
  const headers = [
    'Order ID',
    'Order Number',
    'Date',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Status',
    'Payment Method',
    'Payment Status',
    'Currency',
    'Subtotal (NZD)',
    'Discount Code',
    'Discount (NZD)',
    'Gift Card Code',
    'Gift Card Applied (NZD)',
    'Shipping (NZD)',
    'GST Included (NZD)',
    'Total (NZD)',
    'Gateway Fee (NZD)',
    'Net Received (NZD)',
    'Refunded (NZD)',
    'Item Count',
    'Item SKUs',
    'Item Titles',
    'Provenance Codes',
    'Courier',
    'Courier Service',
    'Tracking Number',
    'Order Notes',
  ];

  const rows = orders.map((o) => {
    const itemCount = o.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const itemSkus = o.items
      .map((item) => `${item.sku || item.productId} x${item.quantity}`)
      .join('; ');
    const itemTitles = o.items
      .map((item) => `${item.title} (${item.quantity})`)
      .join('; ');
    const provenanceCodes = o.items
      .map((item) => item.authenticityCode)
      .filter(Boolean)
      .join('; ');

    return [
      o.id,
      o.orderNumber,
      o.createdAt,
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      o.status,
      o.paymentMethod || 'STRIPE',
      o.paymentStatus || 'PAID',
      'NZD',
      (o.subtotalCents / 100).toFixed(2),
      o.discountCode || '',
      ((o.discountCents || 0) / 100).toFixed(2),
      o.giftCardCode || '',
      ((o.giftCardAppliedCents || 0) / 100).toFixed(2),
      (o.shippingCents / 100).toFixed(2),
      (o.gstCents / 100).toFixed(2),
      (o.totalCents / 100).toFixed(2),
      ((o.stripeFeeCents || 0) / 100).toFixed(2),
      (o.netCents / 100).toFixed(2),
      ((o.refundedAmountCents || 0) / 100).toFixed(2),
      itemCount,
      itemSkus,
      itemTitles,
      provenanceCodes,
      o.courierName,
      o.courierServiceName,
      o.trackingNumber || '',
      o.orderNotes || '',
    ].map(escapeCsvCell);
  });

  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function buildOrdersJson(orders: Order[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      currency: 'NZD',
      recordCount: orders.length,
      orders,
    },
    null,
    2
  );
}

function triggerFileDownload(content: string, mimeType: string, filename: string): string {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function downloadOrdersCsv(orders: Order[], filenamePrefix = 'Pounamu_Atelier_Orders'): string {
  const csv = buildOrdersCsv(orders);
  const dateStamp = new Date().toISOString().split('T')[0];
  return triggerFileDownload(
    '\uFEFF' + csv,
    'text/csv;charset=utf-8;',
    `${filenamePrefix}_${dateStamp}.csv`
  );
}

export function downloadOrdersJson(orders: Order[], filenamePrefix = 'Pounamu_Atelier_Orders'): string {
  const json = buildOrdersJson(orders);
  const dateStamp = new Date().toISOString().split('T')[0];
  return triggerFileDownload(
    json,
    'application/json;charset=utf-8;',
    `${filenamePrefix}_${dateStamp}.json`
  );
}
