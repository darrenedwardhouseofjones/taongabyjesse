import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import {
  getCouriers,
  getOrderEmailLog,
  getSiteSettings,
  getUserByEmail,
  getUserById,
  upsertOrderEmailLog,
} from './db.ts';
import type {
  Courier,
  GiftCard,
  Order,
  OrderEmailLog,
  OrderEmailTemplate,
  SiteSettings,
  UserProfile,
} from '../src/types/index.ts';

function formatMoneyNZD(cents: number): string {
  return `$${(cents / 100).toFixed(2)} NZD`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveBaseUrl(settings: SiteSettings): string {
  return (
    settings.canonicalUrl?.trim() ||
    process.env.APP_URL?.trim() ||
    'https://pounamuatelier.co.nz'
  ).replace(/\/+$/, '');
}

function buildCourierTrackingUrl(order: Order, couriers: Courier[]): string | null {
  if (!order.trackingNumber) return null;
  const matched = couriers.find(
    (c) => c.name.toLowerCase() === order.courierName.toLowerCase()
  );
  if (matched?.trackingUrlTemplate) {
    return matched.trackingUrlTemplate.replace(
      '{TRACKING}',
      encodeURIComponent(order.trackingNumber)
    );
  }
  if (order.courierName.toLowerCase().includes('aramex')) {
    return `https://www.aramex.co.nz/tools/track?tracking_number=${encodeURIComponent(
      order.trackingNumber
    )}`;
  }
  return `https://www.nzpost.co.nz/tools/tracking?track=${encodeURIComponent(
    order.trackingNumber
  )}`;
}

async function dispatchTransactionalEmail(params: {
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  settings: SiteSettings;
}): Promise<{
  provider: OrderEmailLog['provider'];
  status: OrderEmailLog['status'];
  providerMessageId?: string;
  errorMessage?: string;
}> {
  const { recipientEmail, subject, textBody, htmlBody, settings } = params;
  const fromAddress =
    process.env.EMAIL_FROM?.trim() ||
    `${settings.siteName} <${settings.contactEmail || 'orders@pounamuatelier.co.nz'}>`;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();

  if (resendApiKey && !resendApiKey.includes('your_resend_api_key')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipientEmail],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) {
        return {
          provider: 'resend',
          status: 'FAILED',
          errorMessage: json.message || `Resend returned HTTP ${res.status}`,
        };
      }
      return {
        provider: 'resend',
        status: 'SENT',
        providerMessageId: json.id,
      };
    } catch (err) {
      return {
        provider: 'resend',
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Resend request failed',
      };
    }
  }

  if (smtpHost) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return {
        provider: 'smtp',
        status: 'SENT',
        providerMessageId: info.messageId,
      };
    } catch (err) {
      return {
        provider: 'smtp',
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'SMTP delivery failed',
      };
    }
  }

  return {
    provider: 'outbox',
    status: 'LOGGED_NO_PROVIDER',
    errorMessage:
      'Email saved in SQLite order_emails outbox. Set RESEND_API_KEY or SMTP_HOST to send live external mail.',
  };
}

export function resolveRegisteredProfileRecipient(
  order: Order,
  authenticatedUserId?: string
): { recipientEmail: string; registeredUser: UserProfile | null } {
  const candidateUserId = authenticatedUserId || order.userId;
  if (candidateUserId) {
    const byId = getUserById(candidateUserId);
    if (byId?.email) {
      return { recipientEmail: byId.email, registeredUser: byId };
    }
  }

  if (order.customerEmail?.trim()) {
    const byEmail = getUserByEmail(order.customerEmail.trim());
    if (byEmail?.email) {
      const { passwordHash: _ignored, ...profile } = byEmail;
      return { recipientEmail: profile.email, registeredUser: profile };
    }
  }

  return {
    recipientEmail: order.customerEmail.trim(),
    registeredUser: null,
  };
}

export function buildOrderConfirmationEmailContent(params: {
  order: Order;
  recipientEmail: string;
  registeredUser: UserProfile | null;
  settings: SiteSettings;
}): { subject: string; textBody: string; htmlBody: string } {
  const { order, recipientEmail, registeredUser, settings } = params;
  const recipientFirstName =
    registeredUser?.firstName || order.customerName.split(' ')[0] || order.customerName;
  const baseUrl = resolveBaseUrl(settings);
  const orderLookupUrl = `${baseUrl}/?tab=orders&q=${encodeURIComponent(order.orderNumber)}`;

  const subject = `${settings.siteName} — Order Confirmation & Provenance Tax Invoice (${order.orderNumber})`;

  const isCashOnPickup = order.paymentMethod === 'CASH_ON_PICKUP';
  const isGiftCardOnly = order.paymentMethod === 'GIFT_CARD';
  const totalLabel = isCashOnPickup
    ? order.paymentStatus === 'PAID' || order.totalCents === 0
      ? 'Total Paid'
      : 'Total Due on Pickup (NZD)'
    : 'Total Paid';

  const paymentModeText = isGiftCardOnly
    ? `Digital Gift Card (${order.giftCardCode || '100% Covered'} — Paid)`
    : isCashOnPickup
    ? order.totalCents === 0 && (order.giftCardAppliedCents || 0) > 0
      ? `Gift Card + Studio Pickup (${order.giftCardCode} — Paid)`
      : 'Cash on Pickup (Pay in NZD on collection)'
    : (order.giftCardAppliedCents || 0) > 0
    ? `Stripe Card + Gift Card (${order.giftCardCode})`
    : 'Stripe Card Checkout (Paid)';

  const textLines = [
    `Tēnā koe ${recipientFirstName},`,
    '',
    isCashOnPickup && order.totalCents > 0
      ? `Ngā mihi nui for your order with ${settings.siteName}. Your taonga is reserved for in-studio Cash on Pickup in Napier. Please bring ${formatMoneyNZD(
          order.totalCents
        )} (NZD) when collecting your piece.`
      : isGiftCardOnly
      ? `Ngā mihi nui for your order with ${settings.siteName}. Your digital gift card (${order.giftCardCode}) has been applied in full and your carved taonga is being prepared at our Napier workshop.`
      : `Ngā mihi nui for your order with ${settings.siteName}. Your payment has been confirmed and your carved taonga is being prepared at our Napier workshop.`,
    '',
    `Order Number: ${order.orderNumber}`,
    `Registered Profile Email: ${recipientEmail}`,
    `Order Date: ${new Date(order.createdAt).toLocaleDateString('en-NZ')}`,
    `Payment Mode: ${paymentModeText}`,
    `GST Registration: ${settings.gstNumber}`,
    '',
    'Carved Taonga & Provenance:',
    ...order.items.map(
      (item) =>
        `  - ${item.title} × ${item.quantity} | ${formatMoneyNZD(
          item.priceCents * item.quantity
        )} | Ngāi Tahu Code: ${item.authenticityCode} (${item.originRiver})`
    ),
    '',
    ...(order.courierName === 'Studio Pickup'
      ? [
          `Studio Pickup Location: ${settings.workshopAddress}`,
          ...(order.pickupNotes ? [`Pickup Notes: ${order.pickupNotes}`] : []),
          ...(settings.cashOnPickupInstructions ? [`Instructions: ${settings.cashOnPickupInstructions}`] : []),
        ]
      : [
          `Delivery Address:`,
          `  ${order.shippingAddress.line1}`,
          ...(order.shippingAddress.line2 ? [`  ${order.shippingAddress.line2}`] : []),
          `  ${order.shippingAddress.city}, ${order.shippingAddress.region} ${order.shippingAddress.postcode}`,
          `  ${order.shippingAddress.country}`,
          `Courier: ${order.courierName} (${order.courierServiceName})`,
        ]),
    ...(order.orderNotes ? ['', `Order Notes: ${order.orderNotes}`] : []),
    '',
    `Subtotal: ${formatMoneyNZD(order.subtotalCents)}`,
    ...(order.discountCents > 0 ? [`Discount: -${formatMoneyNZD(order.discountCents)}`] : []),
    `Shipping: ${order.courierName === 'Studio Pickup' ? 'FREE (Studio Pickup)' : order.shippingCents === 0 ? 'FREE' : formatMoneyNZD(order.shippingCents)}`,
    ...((order.giftCardAppliedCents || 0) > 0
      ? [`Gift Card (${order.giftCardCode}): -${formatMoneyNZD(order.giftCardAppliedCents || 0)}`]
      : []),
    `Includes 15% NZ GST: ${formatMoneyNZD(order.gstCents)}`,
    `${totalLabel}: ${formatMoneyNZD(order.totalCents)}`,
    '',
    `View your order anytime: ${orderLookupUrl}`,
    '',
    `${settings.siteName} · ${settings.workshopAddress}`,
    `Contact: ${settings.contactEmail} · ${settings.contactPhone}`,
  ];

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #E8E2D6;">
          <div style="font-weight:700;color:#18231C;font-size:14px;">${escapeHtml(item.title)} ${
            item.quantity > 1 ? `× ${item.quantity}` : ''
          }</div>
          <div style="color:#2D5A46;font-family:monospace;font-size:12px;margin-top:3px;">
            Ngāi Tahu Code: ${escapeHtml(item.authenticityCode)} · ${escapeHtml(item.originRiver)}
          </div>
          <div style="color:#526058;font-size:12px;margin-top:2px;">
            SKU: ${escapeHtml(item.sku)} · ${escapeHtml(String(item.material))}
          </div>
        </td>
        <td style="padding:12px;border-bottom:1px solid #E8E2D6;text-align:right;font-weight:700;color:#1B382B;font-family:monospace;white-space:nowrap;">
          ${escapeHtml(formatMoneyNZD(item.priceCents * item.quantity))}
        </td>
      </tr>`
    )
    .join('');

  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18231C;">
    <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E2D6;border-radius:16px;overflow:hidden;">
      <div style="background:#1B382B;color:#FFFFFF;padding:24px 28px;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7FA892;font-weight:700;">
          Order Confirmation &amp; Tax Invoice
        </div>
        <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:700;">${escapeHtml(settings.siteName)}</h1>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 12px 0;font-size:15px;">
          Tēnā koe <strong>${escapeHtml(recipientFirstName)}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#526058;">
          ${
            isCashOnPickup && order.totalCents > 0
              ? `Ngā mihi nui for your reservation. Jesse is preparing and blessing your carved greenstone taonga for <strong>Cash on Pickup</strong> in Napier. Please bring <strong>${escapeHtml(
                  formatMoneyNZD(order.totalCents)
                )}</strong> on collection. Confirmation sent to <strong>${escapeHtml(recipientEmail)}</strong>.`
              : isGiftCardOnly
              ? `Ngā mihi nui for your order. Your Digital Gift Card (<strong>${escapeHtml(
                  order.giftCardCode || ''
                )}</strong>) has settled this order in full and Jesse is preparing your carved greenstone taonga in Napier. Confirmation sent to <strong>${escapeHtml(
                  recipientEmail
                )}</strong>.`
              : `Ngā mihi nui for your order. Your payment has been confirmed and Jesse is preparing your carved greenstone taonga in Napier. This confirmation was sent to your registered profile email (<strong>${escapeHtml(
                  recipientEmail
                )}</strong>).`
          }
        </p>

        <div style="background:#FAF9F6;border:1px solid #E8E2D6;border-radius:12px;padding:16px;margin-bottom:20px;font-size:13px;">
          <div><strong>Order Number:</strong> <span style="font-family:monospace;color:#1B382B;">${escapeHtml(
            order.orderNumber
          )}</span></div>
          <div style="margin-top:4px;"><strong>Date:</strong> ${escapeHtml(
            new Date(order.createdAt).toLocaleDateString('en-NZ')
          )}</div>
          <div style="margin-top:4px;"><strong>Payment Mode:</strong> ${escapeHtml(paymentModeText)}</div>
          <div style="margin-top:4px;"><strong>NZ GST Registration:</strong> ${escapeHtml(
            settings.gstNumber
          )}</div>
          <div style="margin-top:4px;"><strong>${
            order.courierName === 'Studio Pickup' ? 'Fulfillment' : 'Courier Method'
          }:</strong> ${escapeHtml(
            order.courierName
          )} (${escapeHtml(order.courierServiceName)})</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #1B382B;font-size:12px;text-transform:uppercase;color:#526058;">Carved Piece &amp; Provenance</th>
              <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #1B382B;font-size:12px;text-transform:uppercase;color:#526058;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align:right;font-size:13px;line-height:1.7;margin-bottom:22px;">
          <div>Subtotal: <strong>${escapeHtml(formatMoneyNZD(order.subtotalCents))}</strong></div>
          ${
            order.discountCents > 0
              ? `<div style="color:#2D5A46;">Discount: -${escapeHtml(
                  formatMoneyNZD(order.discountCents)
                )}</div>`
              : ''
          }
          <div>Shipping: <strong>${
            order.courierName === 'Studio Pickup'
              ? 'FREE (Studio Pickup)'
              : order.shippingCents === 0
              ? 'FREE'
              : escapeHtml(formatMoneyNZD(order.shippingCents))
          }</strong></div>
          ${
            (order.giftCardAppliedCents || 0) > 0
              ? `<div style="color:#2D5A46;">Gift Card (${escapeHtml(
                  order.giftCardCode || ''
                )}): -${escapeHtml(formatMoneyNZD(order.giftCardAppliedCents || 0))}</div>`
              : ''
          }
          <div style="color:#526058;">Includes 15% NZ GST: ${escapeHtml(
            formatMoneyNZD(order.gstCents)
          )}</div>
          <div style="font-size:16px;color:#1B382B;margin-top:6px;">${escapeHtml(
            totalLabel
          )}: <strong>${escapeHtml(formatMoneyNZD(order.totalCents))}</strong></div>
        </div>

        <div style="background:#FAF9F6;border:1px solid #E8E2D6;border-radius:12px;padding:14px;font-size:12px;color:#526058;margin-bottom:22px;">
          ${
            order.courierName === 'Studio Pickup'
              ? `<strong style="color:#18231C;">Napier Studio Pickup Location:</strong><br/>
                 ${escapeHtml(settings.workshopAddress)}<br/>
                 ${order.pickupNotes ? `Pickup note: ${escapeHtml(order.pickupNotes)}<br/>` : ''}
                 ${settings.cashOnPickupInstructions ? escapeHtml(settings.cashOnPickupInstructions) : ''}`
              : `<strong style="color:#18231C;">Delivery Address:</strong><br/>
                 ${escapeHtml(order.customerName)}<br/>
                 ${escapeHtml(order.shippingAddress.line1)}<br/>
                 ${order.shippingAddress.line2 ? `${escapeHtml(order.shippingAddress.line2)}<br/>` : ''}
                  ${escapeHtml(order.shippingAddress.city)}, ${escapeHtml(
                    order.shippingAddress.region
                  )} ${escapeHtml(order.shippingAddress.postcode)}<br/>
                  ${escapeHtml(order.shippingAddress.country)}`
          }
          ${
            order.orderNotes
              ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #E8E2D6;color:#18231C;"><strong>Order Notes:</strong> ${escapeHtml(
                  order.orderNotes
                )}</div>`
              : ''
          }
        </div>

        <div style="text-align:center;">
          <a href="${escapeHtml(
            orderLookupUrl
          )}" style="display:inline-block;padding:12px 24px;background:#1B382B;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;">
            View Order History &amp; Tracking
          </a>
        </div>
      </div>

      <div style="padding:16px 28px;background:#FAF9F6;border-top:1px solid #E8E2D6;font-size:11px;color:#526058;text-align:center;">
        ${escapeHtml(settings.siteName)} · ${escapeHtml(settings.workshopAddress)} · ${escapeHtml(
    settings.contactEmail
  )}
      </div>
    </div>
  </body>
</html>`;

  return {
    subject,
    textBody: textLines.join('\n'),
    htmlBody,
  };
}

export async function sendOrderConfirmationEmail(params: {
  order: Order;
  authenticatedUserId?: string;
  forceResend?: boolean;
}): Promise<{ emailLog: OrderEmailLog; alreadySent: boolean }> {
  const { order, authenticatedUserId, forceResend = false } = params;

  if (!forceResend) {
    const existing = getOrderEmailLog(order.id, 'order_confirmation');
    if (existing && (existing.status === 'SENT' || existing.status === 'LOGGED_NO_PROVIDER')) {
      const { textBody: _t, htmlBody: _h, ...emailLog } = existing;
      return { emailLog, alreadySent: true };
    }
  }

  const settings = getSiteSettings();
  const { recipientEmail, registeredUser } = resolveRegisteredProfileRecipient(
    order,
    authenticatedUserId
  );

  if (!recipientEmail) {
    throw new Error('No registered profile or customer email found for this order.');
  }

  const { subject, textBody, htmlBody } = buildOrderConfirmationEmailContent({
    order,
    recipientEmail,
    registeredUser,
    settings,
  });

  const delivery = await dispatchTransactionalEmail({
    recipientEmail,
    subject,
    textBody,
    htmlBody,
    settings,
  });

  const emailLog = upsertOrderEmailLog({
    id: `eml-${crypto.randomUUID().slice(0, 12)}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    template: 'order_confirmation',
    recipientEmail,
    registeredUserId: registeredUser?.id,
    subject,
    textBody,
    htmlBody,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId,
    status: delivery.status,
    errorMessage: delivery.errorMessage,
    sentAt: new Date().toISOString(),
  });

  return { emailLog, alreadySent: false };
}

export function statusToEmailTemplate(status: Order['status']): OrderEmailTemplate {
  switch (status) {
    case 'PROCESSING':
      return 'order_status_processing';
    case 'FULFILLING':
      return 'order_status_fulfilling';
    case 'SHIPPED':
      return 'order_status_shipped';
    case 'DELIVERED':
      return 'order_status_delivered';
    case 'REFUNDED':
      return 'order_status_refunded';
    case 'PENDING':
      return 'order_status_pending';
    case 'PAID':
    default:
      return 'order_status_paid';
  }
}

export function buildOrderStatusEmailContent(params: {
  order: Order;
  previousStatus: Order['status'];
  nextStatus: Order['status'];
  recipientEmail: string;
  registeredUser: UserProfile | null;
  settings: SiteSettings;
  couriers: Courier[];
}): { subject: string; textBody: string; htmlBody: string } {
  const { order, previousStatus, nextStatus, recipientEmail, registeredUser, settings, couriers } =
    params;
  const recipientFirstName =
    registeredUser?.firstName || order.customerName.split(' ')[0] || order.customerName;
  const baseUrl = resolveBaseUrl(settings);
  const orderLookupUrl = `${baseUrl}/?tab=orders&q=${encodeURIComponent(order.orderNumber)}`;
  const trackingUrl = buildCourierTrackingUrl(order, couriers);

  let badgeLabel = 'Order Status Update';
  let headline = `Order ${order.orderNumber} is now ${nextStatus}`;
  let subject = `${settings.siteName} — Order ${order.orderNumber} Update: ${nextStatus}`;
  let summaryParagraph = `The status of your order ${order.orderNumber} has been updated from ${previousStatus} to ${nextStatus}.`;

  const isCashPickup = order.paymentMethod === 'CASH_ON_PICKUP';

  if (nextStatus === 'PROCESSING' || nextStatus === 'FULFILLING') {
    badgeLabel = 'Workshop Preparation';
    headline = `Your Taonga Is Now Being Prepared (${order.orderNumber})`;
    subject = `${settings.siteName} — Your Order ${order.orderNumber} Is Now Processing`;
    summaryParagraph = isCashPickup
      ? `Jesse is preparing, inspecting, and blessing your carved pounamu piece(s) at our Napier studio (${settings.workshopAddress}) for Cash on Pickup collection (${formatMoneyNZD(order.totalCents)} due on pickup).`
      : `Jesse is preparing, inspecting, and blessing your carved pounamu piece(s) at our Napier studio ahead of dispatch via ${order.courierName} (${order.courierServiceName}).`;
  } else if (nextStatus === 'SHIPPED') {
    badgeLabel = isCashPickup ? 'Ready for Studio Pickup' : 'Parcel Dispatched';
    headline = isCashPickup
      ? `Your Taonga Is Ready for Pickup (${order.orderNumber})`
      : `Your Order ${order.orderNumber} Has Shipped!`;
    subject = isCashPickup
      ? `${settings.siteName} — Ready for Studio Pickup (${order.orderNumber})`
      : `${settings.siteName} — Your Taonga Has Shipped! (${order.orderNumber})`;
    summaryParagraph = isCashPickup
      ? `Your carved piece(s) are ready for collection at ${settings.workshopAddress}. Total due on pickup: ${formatMoneyNZD(order.totalCents)}.`
      : order.trackingNumber
      ? `Your order has left our Napier workshop via ${order.courierName} (${order.courierServiceName}). Your courier tracking number is ${order.trackingNumber}.`
      : `Your order has been marked shipped via ${order.courierName} (${order.courierServiceName}). Check your Order History for live tracking details.`;
  } else if (nextStatus === 'DELIVERED') {
    badgeLabel = isCashPickup ? 'Collected & Settled' : 'Delivered Safely';
    headline = isCashPickup
      ? `Your Taonga Has Been Collected (${order.orderNumber})`
      : `Your Taonga Has Been Delivered (${order.orderNumber})`;
    subject = `${settings.siteName} — Order ${order.orderNumber} ${
      isCashPickup ? 'Collected' : 'Delivered'
    }`;
    summaryParagraph = isCashPickup
      ? `Thank you for collecting your order at our Napier studio and settling ${formatMoneyNZD(order.totalCents)}. We hope this carved piece carries enduring mana for you and your whānau.`
      : `Your order has been marked as delivered. We hope this carved piece carries enduring mana for you and your whānau. Remember to keep water-wiping natural cords dry when needed and revisit your Ngāi Tahu provenance receipt anytime in Order History.`;
  } else if (nextStatus === 'REFUNDED') {
    badgeLabel = 'Refund Processed';
    const refundAmt = order.refundedAmountCents || order.totalCents;
    headline = `Refund Processed for Order ${order.orderNumber}`;
    subject = `${settings.siteName} — Refund Update for Order ${order.orderNumber}`;
    summaryParagraph = `A refund of ${formatMoneyNZD(
      refundAmt
    )} has been recorded on your order. Depending on your card issuer, funds generally settle within 5–10 business days.`;
  }

  const textLines = [
    `Tēnā koe ${recipientFirstName},`,
    '',
    summaryParagraph,
    '',
    `Order Number: ${order.orderNumber}`,
    `Current Status: ${nextStatus}`,
    `Payment Mode: ${isCashPickup ? 'Cash on Pickup' : 'Stripe Card'}`,
    `Recipient Profile Email: ${recipientEmail}`,
    `Fulfilment: ${
      isCashPickup ? `Studio Pickup (${settings.workshopAddress})` : `${order.courierName} (${order.courierServiceName})`
    }`,
    ...(order.trackingNumber ? [`Tracking Number: ${order.trackingNumber}`] : []),
    ...(trackingUrl ? [`Live Courier Tracking: ${trackingUrl}`] : []),
    '',
    'Carved Pieces:',
    ...order.items.map(
      (item) =>
        `  - ${item.title} × ${item.quantity} (Ngāi Tahu Code: ${item.authenticityCode})`
    ),
    '',
    `View Order History & Receipt: ${orderLookupUrl}`,
    '',
    `${settings.siteName} · ${settings.workshopAddress}`,
    `Questions? Reply or contact ${settings.contactEmail}`,
  ];

  const itemsHtml = order.items
    .map(
      (item) => `
      <li style="margin-bottom:6px;color:#18231C;">
        <strong>${escapeHtml(item.title)}</strong>${item.quantity > 1 ? ` × ${item.quantity}` : ''} —
        <span style="font-family:monospace;color:#2D5A46;">${escapeHtml(
          item.authenticityCode
        )}</span>
      </li>`
    )
    .join('');

  const ctaUrl = nextStatus === 'SHIPPED' && trackingUrl ? trackingUrl : orderLookupUrl;
  const ctaLabel =
    nextStatus === 'SHIPPED' && trackingUrl
      ? `Track Parcel on ${order.courierName}`
      : 'View Order History & Receipt';

  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18231C;">
    <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E2D6;border-radius:16px;overflow:hidden;">
      <div style="background:#1B382B;color:#FFFFFF;padding:24px 28px;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7FA892;font-weight:700;">
          ${escapeHtml(badgeLabel)}
        </div>
        <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:700;">${escapeHtml(headline)}</h1>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 12px 0;font-size:15px;">
          Tēnā koe <strong>${escapeHtml(recipientFirstName)}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#526058;">
          ${escapeHtml(summaryParagraph)}
        </p>

        <div style="background:#FAF9F6;border:1px solid #E8E2D6;border-radius:12px;padding:16px;margin-bottom:20px;font-size:13px;">
          <div><strong>Order Number:</strong> <span style="font-family:monospace;color:#1B382B;">${escapeHtml(
            order.orderNumber
          )}</span></div>
          <div style="margin-top:4px;"><strong>New Status:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#1B382B;color:#FFFFFF;font-size:11px;font-weight:700;">${escapeHtml(
            nextStatus
          )}</span></div>
          <div style="margin-top:4px;"><strong>Payment Mode:</strong> ${escapeHtml(
            isCashPickup ? 'Cash on Pickup' : 'Stripe Card'
          )}</div>
          <div style="margin-top:4px;"><strong>${
            isCashPickup ? 'Pickup Location:' : 'Courier:'
          }</strong> ${escapeHtml(
            isCashPickup
              ? settings.workshopAddress
              : `${order.courierName} (${order.courierServiceName})`
          )}</div>
          ${
            !isCashPickup && order.trackingNumber
              ? `<div style="margin-top:6px;"><strong>Tracking Number:</strong> <span style="font-family:monospace;color:#1B382B;font-weight:700;">${escapeHtml(
                  order.trackingNumber
                )}</span></div>`
              : ''
          }
        </div>

        <div style="margin-bottom:22px;font-size:13px;">
          <div style="font-weight:700;color:#18231C;margin-bottom:8px;">Included Taonga:</div>
          <ul style="margin:0;padding-left:18px;">
            ${itemsHtml}
          </ul>
        </div>

        <div style="text-align:center;">
          <a href="${escapeHtml(
            ctaUrl
          )}" style="display:inline-block;padding:12px 24px;background:#1B382B;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      </div>

      <div style="padding:16px 28px;background:#FAF9F6;border-top:1px solid #E8E2D6;font-size:11px;color:#526058;text-align:center;">
        ${escapeHtml(settings.siteName)} · ${escapeHtml(settings.workshopAddress)} · ${escapeHtml(
    settings.contactEmail
  )}
      </div>
    </div>
  </body>
</html>`;

  return {
    subject,
    textBody: textLines.join('\n'),
    htmlBody,
  };
}

export async function sendOrderStatusNotificationEmail(params: {
  order: Order;
  previousStatus: Order['status'];
  nextStatus: Order['status'];
}): Promise<{ emailLog: OrderEmailLog }> {
  const { order, previousStatus, nextStatus } = params;
  const settings = getSiteSettings();
  const couriers = getCouriers();
  const { recipientEmail, registeredUser } = resolveRegisteredProfileRecipient(order, order.userId);

  if (!recipientEmail) {
    throw new Error(`No email address available for order ${order.orderNumber}.`);
  }

  const template = statusToEmailTemplate(nextStatus);
  const { subject, textBody, htmlBody } = buildOrderStatusEmailContent({
    order,
    previousStatus,
    nextStatus,
    recipientEmail,
    registeredUser,
    settings,
    couriers,
  });

  const delivery = await dispatchTransactionalEmail({
    recipientEmail,
    subject,
    textBody,
    htmlBody,
    settings,
  });

  const emailLog = upsertOrderEmailLog({
    id: `eml-${crypto.randomUUID().slice(0, 12)}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    template,
    recipientEmail,
    registeredUserId: registeredUser?.id,
    subject,
    textBody,
    htmlBody,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId,
    status: delivery.status,
    errorMessage: delivery.errorMessage,
    sentAt: new Date().toISOString(),
  });

  return { emailLog };
}

export async function sendGiftCardDeliveryEmail(giftCard: GiftCard): Promise<{
  emailLog: OrderEmailLog;
}> {
  const settings = getSiteSettings();
  const baseUrl = resolveBaseUrl(settings);
  const redeemUrl = `${baseUrl}/?tab=gift-cards`;
  const recipientEmail = giftCard.recipientEmail.trim();
  const recipientFirstName = giftCard.recipientName.split(' ')[0] || giftCard.recipientName;
  const valueFormatted = formatMoneyNZD(giftCard.initialAmountCents);
  const subject = `${settings.siteName} — Digital Gift Card (${valueFormatted}) from ${giftCard.purchaserName}`;

  const textLines = [
    `Tēnā koe ${recipientFirstName},`,
    '',
    `${giftCard.purchaserName} has sent you a ${settings.siteName} Digital Gift Card worth ${valueFormatted}!`,
    ...(giftCard.message ? ['', `Personal Message: "${giftCard.message}"`] : []),
    '',
    `Gift Card Code: ${giftCard.code}`,
    `Original Value: ${valueFormatted}`,
    `Remaining Balance: ${formatMoneyNZD(giftCard.remainingBalanceCents)}`,
    ...(giftCard.expiresAt
      ? [`Valid Until: ${new Date(giftCard.expiresAt).toLocaleDateString('en-NZ')}`]
      : ['Valid For: Lifetime (no expiry)']),
    '',
    `Enter code ${giftCard.code} in your cart or checkout at ${baseUrl} to redeem toward any carved New Zealand pounamu taonga.`,
    `View balance anytime: ${redeemUrl}`,
    '',
    `${settings.siteName} · ${settings.workshopAddress}`,
  ];

  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18231C;">
    <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E2D6;border-radius:16px;overflow:hidden;">
      <div style="background:#1B382B;color:#FFFFFF;padding:24px 28px;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C29B38;font-weight:700;">
          Digital Gift Card · He Koha Taonga
        </div>
        <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:700;">${escapeHtml(settings.siteName)}</h1>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 12px 0;font-size:15px;">
          Tēnā koe <strong>${escapeHtml(recipientFirstName)}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#526058;">
          <strong>${escapeHtml(giftCard.purchaserName)}</strong> has gifted you a digital studio voucher valued at <strong>${escapeHtml(valueFormatted)}</strong> to select your own hand-carved New Zealand greenstone taonga.
        </p>

        ${
          giftCard.message
            ? `<div style="background:#FAF9F6;border-left:3px solid #C29B38;padding:12px 16px;margin-bottom:20px;font-style:italic;color:#18231C;font-size:13px;">
                 “${escapeHtml(giftCard.message)}”
               </div>`
            : ''
        }

        <div style="background:#12241B;color:#FAF9F6;border-radius:14px;padding:22px;text-align:center;margin-bottom:22px;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7FA892;">Redeemable Gift Card Code</div>
          <div style="font-family:monospace;font-size:24px;font-weight:700;letter-spacing:2px;color:#FFFFFF;margin:10px 0;">
            ${escapeHtml(giftCard.code)}
          </div>
          <div style="font-size:14px;color:#C29B38;font-weight:700;">Balance: ${escapeHtml(
            formatMoneyNZD(giftCard.remainingBalanceCents)
          )}</div>
        </div>

        <div style="text-align:center;">
          <a href="${escapeHtml(
            baseUrl
          )}" style="display:inline-block;padding:12px 24px;background:#1B382B;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;">
            Explore Greenstone Collection
          </a>
        </div>
      </div>

      <div style="padding:16px 28px;background:#FAF9F6;border-top:1px solid #E8E2D6;font-size:11px;color:#526058;text-align:center;">
        ${escapeHtml(settings.siteName)} · ${escapeHtml(settings.workshopAddress)} · ${escapeHtml(
    settings.contactEmail
  )}
      </div>
    </div>
  </body>
</html>`;

  const delivery = await dispatchTransactionalEmail({
    recipientEmail,
    subject,
    textBody: textLines.join('\n'),
    htmlBody,
    settings,
  });

  const registeredUser = getUserByEmail(recipientEmail);
  const emailLog = upsertOrderEmailLog({
    id: `eml-${crypto.randomUUID().slice(0, 12)}`,
    orderId: giftCard.id,
    orderNumber: giftCard.orderNumber || giftCard.code,
    template: 'gift_card_issued',
    recipientEmail,
    registeredUserId: registeredUser?.id,
    subject,
    textBody: textLines.join('\n'),
    htmlBody,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId,
    status: delivery.status,
    errorMessage: delivery.errorMessage,
    sentAt: new Date().toISOString(),
  });

  return { emailLog };
}
