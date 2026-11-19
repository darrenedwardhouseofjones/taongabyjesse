import { jsPDF } from 'jspdf';
import { Order, SiteSettings } from '../types';
import { formatNZD } from './pricing';

/**
 * Normalizes macrons and extended typography to ASCII-safe characters
 * compatible with standard PDF Type1 fonts (Helvetica).
 */
function toPdfSafeText(input: string): string {
  return input
    .replace(/[āĀ]/g, (m) => (m === 'Ā' ? 'A' : 'a'))
    .replace(/[ēĒ]/g, (m) => (m === 'Ē' ? 'E' : 'e'))
    .replace(/[īĪ]/g, (m) => (m === 'Ī' ? 'I' : 'i'))
    .replace(/[ōŌ]/g, (m) => (m === 'Ō' ? 'O' : 'o'))
    .replace(/[ūŪ]/g, (m) => (m === 'Ū' ? 'U' : 'u'))
    .replace(/[–—]/g, '-')
    .replace(/·/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function generateOrderReceiptPdf(order: Order, settings: SiteSettings): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Header Banner (Deep Pounamu Green)
  doc.setFillColor(27, 56, 43);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(toPdfSafeText(settings.siteName.toUpperCase()), margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(198, 222, 208);
  doc.text('OFFICIAL TAX RECEIPT & POUNAMU PROVENANCE RECORD', margin, 23);
  doc.text(
    toPdfSafeText(`${settings.workshopAddress} | ${settings.contactEmail}`),
    margin,
    29
  );

  // Order badge on top right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Order ${order.orderNumber}`, pageWidth - margin, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(198, 222, 208);
  doc.text(`NZ GST Reg: ${settings.gstNumber}`, pageWidth - margin, 23, { align: 'right' });
  doc.text(`Status: ${order.status}`, pageWidth - margin, 29, { align: 'right' });

  y = 50;

  const isCashOnPickup = order.paymentMethod === 'CASH_ON_PICKUP';
  const isGiftCardOnly = order.paymentMethod === 'GIFT_CARD';
  const isCashCollected = order.paymentStatus === 'PAID' || order.status === 'DELIVERED';
  const hasCourierDelivery = order.courierName !== 'Studio Pickup';

  // Order & Customer Information Two-Column Block
  doc.setTextColor(24, 35, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(!hasCourierDelivery ? 'CUSTOMER & PICKUP LOCATION' : 'BILLED & SHIPPED TO', margin, y);
  doc.text('RECEIPT DETAILS', pageWidth / 2 + 6, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 72, 65);

  const wrappedOrderNotes = order.orderNotes
    ? (doc.splitTextToSize(
        toPdfSafeText(`Order Notes: ${order.orderNotes}`),
        contentWidth / 2 - 4
      ) as string[])
    : [];

  const addressLines = [
    ...(!hasCourierDelivery
      ? [
          order.customerName,
          order.customerEmail,
          order.customerPhone,
          `Pickup Location: ${settings.workshopAddress}`,
          ...(order.pickupNotes ? [`Notes: ${order.pickupNotes}`] : []),
        ]
      : [
          order.customerName,
          order.customerEmail,
          order.customerPhone,
          order.shippingAddress.line1,
          ...(order.shippingAddress.line2 ? [order.shippingAddress.line2] : []),
          `${order.shippingAddress.city}, ${order.shippingAddress.region} ${order.shippingAddress.postcode}`,
          order.shippingAddress.country,
        ]),
    ...wrappedOrderNotes,
  ];

  addressLines.forEach((line, index) => {
    doc.text(toPdfSafeText(line), margin, y + index * 5);
  });

  const orderDateStr = new Date(order.createdAt).toLocaleDateString('en-NZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const paymentModeLabel = isGiftCardOnly
    ? `Digital Gift Card (${order.giftCardCode || '100% Covered'})`
    : isCashOnPickup
    ? `Cash on Pickup (${isCashCollected ? 'Paid' : 'Due on Pickup'})`
    : order.giftCardAppliedCents
    ? `Stripe Card + Gift Card (${order.giftCardCode})`
    : 'Stripe Card / Wallet';

  const metaLines = [
    `Receipt Date: ${orderDateStr}`,
    `Payment Mode: ${paymentModeLabel}`,
    ...(order.stripePaymentIntentId ? [`Payment Ref: ${order.stripePaymentIntentId}`] : []),
    `Fulfilment: ${
      !hasCourierDelivery ? 'Napier Studio Collection' : `${order.courierName} (${order.courierServiceName})`
    }`,
    ...(hasCourierDelivery ? [`Package Size: ${order.packageSizeCode}`] : []),
    ...(order.trackingNumber ? [`Tracking #: ${order.trackingNumber}`] : []),
  ];

  metaLines.forEach((line, index) => {
    doc.text(toPdfSafeText(line), pageWidth / 2 + 6, y + index * 5);
  });

  y += Math.max(addressLines.length, metaLines.length) * 5 + 10;

  // Line Items Table Header
  doc.setFillColor(247, 245, 240);
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setDrawColor(232, 226, 214);
  doc.line(margin, y, pageWidth - margin, y);
  doc.line(margin, y + 9, pageWidth - margin, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(24, 35, 28);
  doc.text('TAONGA PIECE & PROVENANCE', margin + 3, y + 6);
  doc.text('AUTH CODE', margin + 104, y + 6);
  doc.text('QTY', margin + 138, y + 6, { align: 'right' });
  doc.text('AMOUNT (NZD)', pageWidth - margin - 3, y + 6, { align: 'right' });

  y += 14;

  // Line Items
  order.items.forEach((item) => {
    if (y > 245) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(24, 35, 28);
    doc.text(toPdfSafeText(item.title), margin + 3, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 96, 88);
    doc.text(
      toPdfSafeText(`${item.material} Pounamu | SKU: ${item.sku} | Origin: ${item.originRiver}`),
      margin + 3,
      y + 4.5
    );
    doc.text('Hand-carved by Jesse (Napier, NZ)', margin + 3, y + 9);

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 90, 70);
    doc.text(toPdfSafeText(item.authenticityCode), margin + 104, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(24, 35, 28);
    doc.text(String(item.quantity), margin + 138, y + 1, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(formatNZD(item.priceCents * item.quantity), pageWidth - margin - 3, y + 1, {
      align: 'right',
    });

    y += 14;
    doc.setDrawColor(232, 226, 214);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 2;
  });

  y += 4;

  // Totals Summary Box (Right Aligned)
  const totalsX = pageWidth - margin - 82;
  const totalsWidth = 82;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(82, 96, 88);

  doc.text('Subtotal (GST incl.):', totalsX, y);
  doc.setTextColor(24, 35, 28);
  doc.text(formatNZD(order.subtotalCents), pageWidth - margin - 3, y, { align: 'right' });
  y += 6;

  if (order.discountCents > 0) {
    doc.setTextColor(45, 90, 70);
    doc.text(
      `Discount${order.discountCode ? ` (${order.discountCode})` : ''}:`,
      totalsX,
      y
    );
    doc.text(`-${formatNZD(order.discountCents)}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 6;
  }

  doc.setTextColor(82, 96, 88);
  doc.text(!hasCourierDelivery ? 'Studio Collection:' : 'Tracked Courier Shipping:', totalsX, y);
  doc.setTextColor(24, 35, 28);
  doc.text(
    !hasCourierDelivery
      ? 'FREE (Studio Pickup)'
      : order.shippingCents === 0
      ? 'FREE'
      : formatNZD(order.shippingCents),
    pageWidth - margin - 3,
    y,
    { align: 'right' }
  );
  y += 6;

  if ((order.giftCardAppliedCents || 0) > 0) {
    doc.setTextColor(45, 90, 70);
    doc.text(
      `Gift Card (${order.giftCardCode || 'Applied'}):`,
      totalsX,
      y
    );
    doc.text(`-${formatNZD(order.giftCardAppliedCents || 0)}`, pageWidth - margin - 3, y, {
      align: 'right',
    });
    y += 6;
  }

  doc.setTextColor(82, 96, 88);
  doc.text('Includes 15% NZ GST:', totalsX, y);
  doc.text(formatNZD(order.gstCents), pageWidth - margin - 3, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(27, 56, 43);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, totalsX + totalsWidth, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(27, 56, 43);
  doc.text(
    isCashOnPickup && !isCashCollected ? 'TOTAL DUE ON PICKUP (NZD):' : 'TOTAL PAID (NZD):',
    totalsX,
    y
  );
  doc.text(formatNZD(order.totalCents), pageWidth - margin - 3, y, { align: 'right' });

  // Authenticity & Legal Footer
  const footerY = 262;
  doc.setFillColor(247, 245, 240);
  doc.rect(margin, footerY, contentWidth, 22, 'F');
  doc.setDrawColor(232, 226, 214);
  doc.setLineWidth(0.2);
  doc.rect(margin, footerY, contentWidth, 22, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 56, 43);
  doc.text('AUTHENTICITY & PROVENANCE GUARANTEE', margin + 4, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 96, 88);
  const policyWrapped = doc.splitTextToSize(
    toPdfSafeText(settings.authenticityPolicyText),
    contentWidth - 8
  );
  doc.text(policyWrapped, margin + 4, footerY + 11);

  doc.save(`Receipt-${order.orderNumber}.pdf`);
}
