export type PayPalMode = 'sandbox' | 'live';

const PAYPAL_BASE_URLS: Record<PayPalMode, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

function getPayPalBaseUrl(mode: PayPalMode): string {
  return mode === 'live' ? PAYPAL_BASE_URLS.live : PAYPAL_BASE_URLS.sandbox;
}

export function centsToPayPalAmountString(cents: number): string {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}

export function payPalAmountStringToCents(valueStr: string | undefined): number | null {
  if (!valueStr) return null;
  const parsed = Number(valueStr);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function estimatePayPalFeeCents(totalCents: number): number {
  if (totalCents <= 0) return 0;
  // Standard NZ domestic PayPal rate (~3.4% + $0.45 NZD)
  return Math.round(totalCents * 0.034 + 45);
}

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
}

export async function getPayPalAccessToken(creds: PayPalCredentials): Promise<string> {
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error('PayPal Client ID and Client Secret are required.');
  }
  const baseUrl = getPayPalBaseUrl(creds.mode);
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `PayPal authentication failed (${response.status}).`
    );
  }

  return data.access_token;
}

export async function testPayPalConnection(creds: PayPalCredentials): Promise<{
  ok: boolean;
  mode: PayPalMode;
}> {
  await getPayPalAccessToken(creds);
  return { ok: true, mode: creds.mode };
}

export async function createPayPalOrder(params: {
  creds: PayPalCredentials;
  totalCents: number;
  orderId: string;
  orderNumber: string;
  description: string;
  brandName?: string;
}): Promise<{ id: string; status: string }> {
  const accessToken = await getPayPalAccessToken(params.creds);
  const baseUrl = getPayPalBaseUrl(params.creds.mode);
  const valueStr = centsToPayPalAmountString(params.totalCents);

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': `create-${params.orderId}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.orderNumber,
          custom_id: params.orderId,
          invoice_id: params.orderNumber,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: 'NZD',
            value: valueStr,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: (params.brandName || 'Pounamu Atelier').slice(0, 127),
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
          },
        },
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    message?: string;
    details?: { description?: string; issue?: string }[];
  };

  if (!response.ok || !data.id) {
    const detailMsg = data.details?.[0]?.description || data.details?.[0]?.issue;
    throw new Error(detailMsg || data.message || `PayPal create order failed (${response.status}).`);
  }

  return {
    id: data.id,
    status: data.status || 'CREATED',
  };
}

export interface PayPalCaptureResult {
  paypalOrderId: string;
  orderStatus: string;
  captureId: string;
  captureStatus: string;
  capturedCents: number | null;
  currencyCode: string;
  feeCents: number | null;
  netCents: number | null;
  customId?: string;
}

export async function capturePayPalOrder(params: {
  creds: PayPalCredentials;
  paypalOrderId: string;
}): Promise<PayPalCaptureResult> {
  const accessToken = await getPayPalAccessToken(params.creds);
  const baseUrl = getPayPalBaseUrl(params.creds.mode);
  const safeId = encodeURIComponent(params.paypalOrderId.trim());

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${safeId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': `capture-${params.paypalOrderId.trim()}`,
    },
    body: '{}',
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    message?: string;
    details?: { description?: string; issue?: string }[];
    purchase_units?: Array<{
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          custom_id?: string;
          amount?: { currency_code?: string; value?: string };
          seller_receivable_breakdown?: {
            paypal_fee?: { currency_code?: string; value?: string };
            net_amount?: { currency_code?: string; value?: string };
          };
        }>;
      };
    }>;
  };

  if (!response.ok) {
    const detailMsg = data.details?.[0]?.description || data.details?.[0]?.issue;
    throw new Error(detailMsg || data.message || `PayPal capture failed (${response.status}).`);
  }

  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const breakdown = capture?.seller_receivable_breakdown;

  return {
    paypalOrderId: data.id || params.paypalOrderId,
    orderStatus: data.status || '',
    captureId: capture?.id || '',
    captureStatus: capture?.status || data.status || '',
    capturedCents: payPalAmountStringToCents(capture?.amount?.value),
    currencyCode: (capture?.amount?.currency_code || 'NZD').toUpperCase(),
    feeCents:
      breakdown?.paypal_fee?.currency_code?.toUpperCase() === 'NZD'
        ? payPalAmountStringToCents(breakdown?.paypal_fee?.value)
        : null,
    netCents:
      breakdown?.net_amount?.currency_code?.toUpperCase() === 'NZD'
        ? payPalAmountStringToCents(breakdown?.net_amount?.value)
        : null,
    customId: capture?.custom_id || unit?.custom_id,
  };
}

export async function getPayPalOrderDetails(params: {
  creds: PayPalCredentials;
  paypalOrderId: string;
}): Promise<PayPalCaptureResult | null> {
  const accessToken = await getPayPalAccessToken(params.creds);
  const baseUrl = getPayPalBaseUrl(params.creds.mode);
  const safeId = encodeURIComponent(params.paypalOrderId.trim());

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${safeId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          custom_id?: string;
          amount?: { currency_code?: string; value?: string };
          seller_receivable_breakdown?: {
            paypal_fee?: { currency_code?: string; value?: string };
            net_amount?: { currency_code?: string; value?: string };
          };
        }>;
      };
    }>;
  } | null;

  if (!data) return null;
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const breakdown = capture?.seller_receivable_breakdown;

  return {
    paypalOrderId: data.id || params.paypalOrderId,
    orderStatus: data.status || '',
    captureId: capture?.id || '',
    captureStatus: capture?.status || '',
    capturedCents: payPalAmountStringToCents(capture?.amount?.value),
    currencyCode: (capture?.amount?.currency_code || 'NZD').toUpperCase(),
    feeCents:
      breakdown?.paypal_fee?.currency_code?.toUpperCase() === 'NZD'
        ? payPalAmountStringToCents(breakdown?.paypal_fee?.value)
        : null,
    netCents:
      breakdown?.net_amount?.currency_code?.toUpperCase() === 'NZD'
        ? payPalAmountStringToCents(breakdown?.net_amount?.value)
        : null,
    customId: capture?.custom_id || unit?.custom_id,
  };
}

export async function refundPayPalCapture(params: {
  creds: PayPalCredentials;
  captureId: string;
  amountCents: number;
  orderNumber: string;
  note?: string;
}): Promise<{ id: string; status: string }> {
  const accessToken = await getPayPalAccessToken(params.creds);
  const baseUrl = getPayPalBaseUrl(params.creds.mode);
  const safeCaptureId = encodeURIComponent(params.captureId.trim());

  const response = await fetch(`${baseUrl}/v2/payments/captures/${safeCaptureId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: {
        currency_code: 'NZD',
        value: centsToPayPalAmountString(params.amountCents),
      },
      invoice_id: params.orderNumber,
      note_to_payer: (params.note || `Refund for Pounamu Atelier order ${params.orderNumber}`).slice(0, 255),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    message?: string;
    details?: { description?: string; issue?: string }[];
  };

  if (!response.ok || !data.id) {
    const detailMsg = data.details?.[0]?.description || data.details?.[0]?.issue;
    throw new Error(detailMsg || data.message || `PayPal refund failed (${response.status}).`);
  }

  return {
    id: data.id,
    status: data.status || 'COMPLETED',
  };
}

export async function verifyPayPalWebhookSignature(params: {
  creds: PayPalCredentials;
  webhookId: string;
  headers: Record<string, string | string[] | undefined>;
  webhookEvent: unknown;
}): Promise<boolean> {
  const accessToken = await getPayPalAccessToken(params.creds);
  const baseUrl = getPayPalBaseUrl(params.creds.mode);

  const readHeader = (name: string): string => {
    const val = params.headers[name] ?? params.headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || '';
    return typeof val === 'string' ? val : '';
  };

  const transmissionId = readHeader('paypal-transmission-id');
  const transmissionTime = readHeader('paypal-transmission-time');
  const transmissionSig = readHeader('paypal-transmission-sig');
  const certUrl = readHeader('paypal-cert-url');
  const authAlgo = readHeader('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    }),
  });

  if (!response.ok) return false;
  const data = (await response.json().catch(() => null)) as {
    verification_status?: string;
  } | null;
  return data?.verification_status === 'SUCCESS';
}
