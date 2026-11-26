import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import {
  activateGiftCardAtomic,
  addGalleryItem,
  addProduct,
  addWishlistItem,
  attachPayPalOrder,
  attachPayPalOrderToGiftCard,
  attachStripePaymentIntent,
  attachStripePaymentIntentToGiftCard,
  bulkRaiseCourierRates,
  cancelPendingOrder,
  createAgentCartSession,
  createCashOnPickupOrderAtomic,
  createCommission,
  createEmailUser,
  createGiftCardPaidOrderAtomic,
  createGiftCardRecord,
  createOrder,
  createPendingOrderAtomic,
  createSession,
  deleteDiscount,
  deleteGalleryItem,
  deleteGiftCard,
  deletePageSeoMetadata,
  deleteProduct,
  deleteSession,
  ensureCertificatesForOrder,
  findCommissionByRefAndEmail,
  findOrderByOrderNumber,
  findOrderByQuery,
  findUserForLogin,
  getAdminPaymentSettingsView,
  getAgentCartSession,
  getAllCommissions,
  getAllGiftCards,
  getAllOrderEmailLogs,
  getAllOrders,
  getAllPageSeoMetadata,
  getAllProducts,
  getCommissionById,
  getCommissionsForUser,
  getCourierRates,
  getCouriers,
  getCustomPricing,
  getDiscounts,
  getGalleryItems,
  getGiftCardById,
  getGiftCardByPayPalOrderId,
  getGiftCardByPaymentIntentId,
  getGiftCardRedemptions,
  getGiftCardsForUser,
  getOrderById,
  getOrderByPayPalCaptureId,
  getOrderByPayPalOrderId,
  getOrderByPaymentIntentId,
  getOrderEmailLog,
  getOrderEmailLogsForOrder,
  getOrdersForUser,
  getResolvedPayPalCredentials,
  getResolvedStripeCredentials,
  getSiteSettings,
  getUserByEmail,
  getUserBySessionToken,
  getUserWithPasswordById,
  getWishlistForUser,
  markOrderPaidAtomic,
  normalizeSeoPageKey,
  recordOrderRefund,
  recordStripeEvent,
  releaseOrderReservations,
  removeWishlistItem,
  savePaymentSecrets,
  toggleWishlistItem,
  updateCommission,
  updateCourier,
  updateCourierRate,
  updateCustomPricing,
  updateGiftCardAdmin,
  updateOrder,
  updateProduct,
  updateSiteSettings,
  updateUserName,
  updateUserPassword,
  upsertDiscount,
  upsertGoogleUser,
  upsertPageSeoMetadata,
  validateGiftCardForCheckout,
  verifyCertificateOrProvenance,
  verifyPassword,
  type WishlistPayloadInput,
} from './server/db.ts';
import {
  capturePayPalOrder,
  createPayPalOrder,
  estimatePayPalFeeCents,
  getPayPalOrderDetails,
  payPalAmountStringToCents,
  refundPayPalCapture,
  testPayPalConnection,
  verifyPayPalWebhookSignature,
} from './server/paypal.ts';
import {
  sendGiftCardDeliveryEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusNotificationEmail,
} from './server/email.ts';
import {
  getSitemapStatus,
  startSitemapScheduler,
  writePublicSitemap,
} from './server/sitemap.ts';
import {
  calculateCustomPieceCents,
  determinePackageSize,
  PACKAGE_SIZES,
  priceCart,
} from './src/utils/pricing.ts';
import {
  buildStoreStructuredData,
  serializeJsonLdSafe,
  toAbsoluteSeoUrl,
} from './src/utils/seo.ts';
import type {
  CartItem,
  Courier,
  CustomCommission,
  CustomPricingConfig,
  DiscountRule,
  GalleryItem,
  Order,
  OrderEmailLog,
  PageSeoMetadata,
  Product,
  SiteSettings,
  UserProfile,
} from './src/types/index.ts';
import { validateBody, validateQuery } from './server/middleware/validate.ts';
import {
  adminGiftCardCreateSchema,
  adminGiftCardPatchSchema,
  agentCartCreateSchema,
  agentCatalogQuerySchema,
  bulkRaiseRatesSchema,
  cashOnPickupCheckoutSchema,
  commissionAcceptSchema,
  commissionAdminUpdateSchema,
  commissionCreateSchema,
  commissionLookupRouteQuerySchema,
  commissionMessageSchema,
  commissionStatusUpdateSchema,
  confirmStripeStatusSchema,
  courierRatePatchSchema,
  courierUpdateSchema,
  createPaymentIntentSchema,
  customPricingConfigSchema,
  discountRuleSchema,
  galleryItemSchema,
  giftCardCheckoutCompleteSchema,
  giftCardConfirmPayPalSchema,
  giftCardConfirmStripeSchema,
  giftCardPurchaseSchema,
  giftCardValidateRouteQuerySchema,
  googleAuthPayloadSchema,
  loginServerPayloadSchema,
  orderLookupRouteQuerySchema,
  orderPatchAdminSchema,
  orderRefundSchema,
  orderTrackingUpdateSchema,
  pageSeoAuditEntrySchema,
  passwordUpdatePayloadSchema,
  paymentSettingsSchema,
  paypalCancelOrderSchema,
  paypalCaptureOrderSchema,
  productPayloadSchema,
  profileUpdateSchema,
  provenanceLookupRouteQuerySchema,
  registerPayloadSchema,
  siteSettingsUpdateSchema,
  wishlistPayloadSchema,
} from './src/validation/schemas.ts';

function resolveServerPort(): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  const envPort = process.env.PORT;
  const nginxPort = process.env.NGINX_PORT;
  if (envPort && envPort !== nginxPort) {
    const parsed = Number(envPort);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return Number(process.env.DEFAULT_APP_PORT || 3000);
}

const PORT = resolveServerPort();
const SESSION_COOKIE_NAME = 'pa_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function getRequestToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function getAuthenticatedUser(req: express.Request): UserProfile | null {
  const token = getRequestToken(req);
  return getUserBySessionToken(token);
}

function setSessionCookie(res: express.Response, req: express.Request, token: string) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    ...(isSecure ? { partitioned: true } : {}),
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: '/',
  } as express.CookieOptions);
}

function clearSessionCookie(res: express.Response, req: express.Request) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    ...(isSecure ? { partitioned: true } : {}),
    path: '/',
  } as express.CookieOptions);
}

function getVisibleProductsForUser(user: UserProfile | null): Product[] {
  const all = getAllProducts();
  if (user?.role === 'ADMIN') return all;
  return all
    .filter((p) => p.published)
    .map((p) => ({ ...p, costPriceCents: 0 }));
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const visible = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${visible}@${domain}`;
}

function redactOrderForGuest(order: Order): Order {
  return {
    ...order,
    customerEmail: maskEmail(order.customerEmail),
    customerPhone: '',
    shippingAddress: {
      ...order.shippingAddress,
      line1: '',
      line2: '',
      postcode: '',
    },
    stripePaymentIntentId: '',
    stripeFeeCents: 0,
    netCents: 0,
    pickupNotes: undefined,
    orderNotes: undefined,
  };
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const rateLimitSweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitBuckets.entries()) {
    if (entry.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
rateLimitSweepTimer.unref();

function getClientIp(req: express.Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(opts: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${opts.keyPrefix}:${getClientIp(req)}`;
    const entry = rateLimitBuckets.get(key);
    if (!entry || entry.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    if (entry.count >= opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    entry.count += 1;
    return next();
  };
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveRequestOrigin(req: express.Request): string {
  const configured = process.env.SITE_URL?.trim() || process.env.APP_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0].trim()
      : '';
  const proto = forwardedProto || req.protocol || 'http';
  const forwardedHost =
    typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0].trim()
      : '';
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function toPublicAgentProduct(product: Product, origin: string) {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const isAvailable = product.isMadeToOrder || product.quantity > 0;
  const images = (product.images || [])
    .filter((img) => Boolean(img) && !/^data:/i.test(img))
    .map((img) => toAbsoluteSeoUrl(img, cleanOrigin));

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    title: product.title,
    material: product.material,
    designType: product.designType,
    originRiver: product.originRiver,
    authenticityCode: product.authenticityCode,
    carverName: product.carverName,
    dimensions: product.dimensions,
    cordDetails: product.cordDetails,
    weightGrams: product.weightGrams,
    defaultPackageSize: product.defaultPackageSize,
    isUniquePiece: product.isUniquePiece,
    isMadeToOrder: product.isMadeToOrder,
    isExportRestricted: product.isExportRestricted,
    inStock: Boolean(product.published && isAvailable),
    availableQuantity: product.isMadeToOrder ? null : Math.max(0, product.quantity),
    priceCents: product.priceCents,
    priceNzd: Number((product.priceCents / 100).toFixed(2)),
    compareAtPriceCents: product.compareAtPriceCents ?? null,
    currency: 'NZD',
    gstIncluded: true,
    description: product.description,
    spiritualMeaning: product.spiritualMeaning,
    images,
    productUrl: `${cleanOrigin}/?tab=store&product=${encodeURIComponent(product.id)}`,
    addToCartUrl: `${cleanOrigin}/?add=${encodeURIComponent(product.id)}&qty=1&cart=1`,
    directCheckoutUrl: `${cleanOrigin}/?add=${encodeURIComponent(product.id)}&qty=1&checkout=1`,
  };
}

function injectSeoMetaIntoHtml(html: string, settings: SiteSettings, req: express.Request): string {
  const origin = resolveRequestOrigin(req);
  const reqPageKey = normalizeSeoPageKey(req.originalUrl || '/');
  const pageOverride = getAllPageSeoMetadata().find((item) => item.pageKey === reqPageKey);
  const canonical = settings.canonicalUrl?.trim()
    ? `${settings.canonicalUrl.trim().replace(/\/$/, '')}${reqPageKey === '/' ? '/' : reqPageKey}`
    : `${origin}${reqPageKey === '/' ? '/' : reqPageKey}`;
  const publicProducts = getVisibleProductsForUser(null);
  const activeProductId =
    typeof req.query.product === 'string' ? req.query.product.trim() : null;
  const activeProduct = activeProductId
    ? publicProducts.find((p) => p.id === activeProductId)
    : undefined;

  const title = activeProduct
    ? `${activeProduct.title} — ${settings.siteName}`
    : pageOverride?.seoTitle?.trim() ||
      settings.seoTitle?.trim() ||
      `${settings.siteName} — Hand-Carved NZ Greenstone`;
  const description = activeProduct
    ? activeProduct.description ||
      `${activeProduct.material} ${activeProduct.designType} hand-carved in Napier, New Zealand.`
    : pageOverride?.metaDescription?.trim() ||
      settings.seoDescription?.trim() ||
      settings.tagline;
  const keywords =
    (pageOverride ? pageOverride.keywords : settings.seoKeywords)?.trim() || '';
  const robots = settings.allowSearchIndexing === false ? 'noindex, nofollow' : 'index, follow';
  const ogTitle = activeProduct
    ? title
    : settings.ogTitle?.trim() || title;
  const ogDescription = activeProduct
    ? description
    : settings.ogDescription?.trim() || description;
  const ogSiteName = settings.ogSiteName?.trim() || settings.siteName || 'Pounamu Atelier';
  const rawOgImg =
    activeProduct?.images?.[0] ||
    settings.ogImageUrl?.trim() ||
    '/src/assets/images/jesse_carving_hero_1794557997280.jpg';
  const ogImage = toAbsoluteSeoUrl(rawOgImg, origin);
  const twitterCard = settings.twitterCardType || 'summary_large_image';

  const structuredData = buildStoreStructuredData({
    settings,
    origin,
    canonicalUrl: canonical,
    resolvedOgImage: ogImage,
    descriptionOverride: description,
    products: publicProducts,
    activeProductId,
  });

  const seoBlock = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    keywords ? `<meta name="keywords" content="${escapeHtmlAttr(keywords)}" />` : '',
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonical)}" />`,
    `<link rel="alternate" type="text/plain" title="AI Agent Store Guide (llms.txt)" href="/llms.txt" />`,
    `<link rel="alternate" type="application/json" title="AI Agent Catalog JSON API" href="/api/agent/catalog" />`,
    `<meta property="og:type" content="${activeProduct ? 'product' : 'website'}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(ogSiteName)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(ogDescription)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
    `<meta name="twitter:card" content="${escapeHtmlAttr(twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(ogDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`,
    `<script id="pounamu-store-jsonld" type="application/ld+json">${serializeJsonLdSafe(structuredData)}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');

  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:name|property)="(?:description|keywords|robots|og:[^"]+|twitter:[^"]+)"[^>]*\/?>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*\/?>\s*/gi, '')
    .replace(/<link\s+rel="alternate"[^>]*title="AI Agent[^"]*"[^>]*\/?>\s*/gi, '')
    .replace(/<script\s+id="pounamu-store-jsonld"[\s\S]*?<\/script>\s*/gi, '');

  return cleaned.replace('<head>', `<head>\n    ${seoBlock}`);
}

async function extractStripeFeeAndNet(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  fallbackTotalCents: number
): Promise<{ feeCents: number; netCents: number }> {
  try {
    let latestCharge = paymentIntent.latest_charge;
    if (typeof latestCharge === 'string') {
      const expandedPi = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['latest_charge.balance_transaction'],
      });
      latestCharge = expandedPi.latest_charge;
    }
    if (
      latestCharge &&
      typeof latestCharge === 'object' &&
      'balance_transaction' in latestCharge &&
      latestCharge.balance_transaction &&
      typeof latestCharge.balance_transaction === 'object'
    ) {
      const bt = latestCharge.balance_transaction as Stripe.BalanceTransaction;
      return { feeCents: bt.fee, netCents: bt.net };
    }
  } catch {
    // Fall back to estimated NZ fee if balance_transaction is still settling
  }
  const feeCents = Math.round(fallbackTotalCents * 0.027 + 30);
  return { feeCents, netCents: Math.max(0, fallbackTotalCents - feeCents) };
}

function refreshPublicSitemap() {
  try {
    return writePublicSitemap();
  } catch (err) {
    console.warn('Unable to regenerate public/sitemap.xml:', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  startSitemapScheduler({ unrefTimer: true });

  // Security headers (preserve iFrame embedding compatibility for AI Studio preview)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // --- Stripe Webhook (MUST mount BEFORE express.json() so req.body stays raw Buffer) ---
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const creds = getResolvedStripeCredentials();

    if (!creds.secretKey || !creds.webhookSecret) {
      return res.status(400).json({ error: 'Stripe webhook secrets are not configured on server.' });
    }
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header.' });
    }

    const stripe = new Stripe(creds.secretKey);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, signature, creds.webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid signature';
      return res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object as Stripe.PaymentIntent;
        const isGiftCardPi =
          pi.metadata?.kind === 'gift_card' ||
          (!pi.metadata?.orderId && Boolean(getGiftCardByPaymentIntentId(pi.id)));

        if (isGiftCardPi) {
          const gcResult = activateGiftCardAtomic({
            giftCardId: pi.metadata?.giftCardId,
            paymentIntentId: pi.id,
            eventId: event.id,
            eventType: event.type,
          });
          if (gcResult.giftCard && gcResult.newlyActivated) {
            void sendGiftCardDeliveryEmail(gcResult.giftCard).catch((emailErr) => {
              console.warn('Webhook gift card delivery email failed:', emailErr);
            });
          }
          return res.json({ received: true });
        }

        const orderId = pi.metadata?.orderId || '';
        const order =
          (orderId ? getOrderById(orderId) : null) || getOrderByPaymentIntentId(pi.id);

        const { feeCents, netCents } = await extractStripeFeeAndNet(
          stripe,
          pi,
          order?.totalCents ?? pi.amount_received ?? pi.amount
        );

        const paidResult = markOrderPaidAtomic({
          orderId: order?.id || orderId,
          paymentIntentId: pi.id,
          stripeFeeCents: feeCents,
          netCents,
          eventId: event.id,
          eventType: event.type,
        });
        refreshPublicSitemap();
        if (paidResult.order && !paidResult.alreadyProcessed) {
          void sendOrderConfirmationEmail({
            order: paidResult.order,
            authenticatedUserId: paidResult.order.userId,
          }).catch((emailErr) => {
            console.warn('Webhook order confirmation email failed:', emailErr);
          });
        }
      } else if (
        event.type === 'payment_intent.payment_failed' ||
        event.type === 'payment_intent.canceled'
      ) {
        if (recordStripeEvent(event.id, event.type)) {
          const pi = event.data.object as Stripe.PaymentIntent;
          const orderId = pi.metadata?.orderId;
          const order =
            (orderId ? getOrderById(orderId) : null) || getOrderByPaymentIntentId(pi.id);
          if (order && order.status === 'PENDING') {
            releaseOrderReservations(order.id);
          }
        }
      } else if (event.type === 'charge.refunded') {
        if (recordStripeEvent(event.id, event.type)) {
          const charge = event.data.object as Stripe.Charge;
          const piId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id;
          if (piId) {
            const order = getOrderByPaymentIntentId(piId);
            if (order) {
              recordOrderRefund({
                orderId: order.id,
                absoluteRefundedCents: charge.amount_refunded,
              });
            }
          }
        }
      } else {
        recordStripeEvent(event.id, event.type);
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Stripe webhook processing error:', err);
      res.status(500).json({ error: 'Webhook processing error' });
    }
  });

  app.use(express.json({ limit: '10mb' }));

  // CSRF protection for cookie-authenticated mutations (Stripe & PayPal webhooks are signature-verified)
  const csrfUnsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  app.use('/api', (req, res, next) => {
    if (!csrfUnsafeMethods.has(req.method)) return next();
    if (req.path === '/paypal/webhook' || req.path === '/stripe/webhook') return next();
    const cookies = parseCookies(req.headers.cookie);
    if (!cookies[SESSION_COOKIE_NAME]) return next();
    if (req.headers.authorization?.startsWith('Bearer ')) return next();
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return next();

    const expectedHost = (req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const originHeader = req.get('origin') || req.get('referer');
    if (originHeader && expectedHost) {
      try {
        const parsedOrigin = new URL(originHeader);
        if (parsedOrigin.host.toLowerCase() === expectedHost) {
          return next();
        }
      } catch {
        // Malformed origin rejected below
      }
    }
    return res
      .status(403)
      .json({ error: 'Cross-site request rejected (missing origin or X-Requested-With).' });
  });

  const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 15, keyPrefix: 'auth' });
  const lookupRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'lookup' });
  const giftCardRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyPrefix: 'giftcard' });
  const commissionRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10, keyPrefix: 'commission' });

  // --- Bootstrap Endpoint ---
  app.get('/api/bootstrap', (req, res) => {
    const user = getAuthenticatedUser(req);
    const settings = getSiteSettings();
    const products = getVisibleProductsForUser(user);
    const galleryItems = getGalleryItems();
    const couriers = getCouriers();
    const rates = getCourierRates();
    const discounts = getDiscounts(user?.role !== 'ADMIN');
    const customPricing = getCustomPricing();

    let orders: Order[] = [];
    let commissions: CustomCommission[] = [];

    if (user?.role === 'ADMIN') {
      orders = getAllOrders();
      commissions = getAllCommissions();
    } else if (user) {
      orders = getOrdersForUser(user);
      commissions = getCommissionsForUser(user);
    }

    const wishlist = user ? getWishlistForUser(user.id) : [];
    const giftCards =
      user?.role === 'ADMIN' ? getAllGiftCards() : user ? getGiftCardsForUser(user) : [];
    const pageSeoMetadata = getAllPageSeoMetadata();

    res.json({
      user,
      settings,
      products,
      galleryItems,
      couriers,
      rates,
      discounts,
      customPricing,
      orders,
      commissions,
      wishlist,
      giftCards,
      pageSeoMetadata,
    });
  });

  // --- Provenance & Unique Certificate Verification Endpoint ---
  app.get(
    '/api/provenance/verify',
    lookupRateLimiter,
    validateQuery(provenanceLookupRouteQuerySchema),
    (req, res) => {
      const rawCode =
        typeof req.query.code === 'string'
          ? req.query.code
          : typeof req.query.cert === 'string'
          ? req.query.cert
          : '';
      const buyer = typeof req.query.buyer === 'string' ? req.query.buyer : undefined;
      if (!rawCode.trim()) {
        return res.json({ verified: false, record: null });
      }
      const result = verifyCertificateOrProvenance(rawCode, buyer);
      return res.json(result);
    }
  );

  // --- Auth Routes ---
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  });

  app.post(
    '/api/auth/register',
    authRateLimiter,
    validateBody(registerPayloadSchema),
    (req, res) => {
      const settings = getSiteSettings();
      if (!settings.allowEmailRegistration) {
        return res.status(403).json({
          error: 'Email registration is currently disabled in studio settings.',
        });
      }

      const { firstName, lastName, email, password } = req.body as {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
      };

      const existing = getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const user = createEmailUser({
        email,
        firstName,
        lastName: lastName || '',
        password,
        role: 'CUSTOMER',
      });

      const token = createSession(user.id);
      setSessionCookie(res, req, token);

      const orders = getOrdersForUser(user);
      const commissions = getCommissionsForUser(user);
      const wishlist = getWishlistForUser(user.id);
      const giftCards = getGiftCardsForUser(user);
      res.status(201).json({ user, token, orders, commissions, wishlist, giftCards });
    }
  );

  app.post(
    '/api/auth/login',
    authRateLimiter,
    validateBody(loginServerPayloadSchema),
    (req, res) => {
      const { email, username, password } = req.body as {
        email?: string;
        username?: string;
        password: string;
      };
      const identifier = (email ?? username ?? '').trim();

      const found = findUserForLogin(identifier);
      if (!found || !found.passwordHash || !verifyPassword(password, found.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const user: UserProfile = {
        id: found.id,
        email: found.email,
        firstName: found.firstName,
        lastName: found.lastName,
        role: found.role,
        authProvider: found.authProvider,
        createdAt: found.createdAt,
      };

      const token = createSession(user.id);
      setSessionCookie(res, req, token);

      const orders = user.role === 'ADMIN' ? getAllOrders() : getOrdersForUser(user);
      const commissions =
        user.role === 'ADMIN' ? getAllCommissions() : getCommissionsForUser(user);
      const wishlist = getWishlistForUser(user.id);
      const giftCards = user.role === 'ADMIN' ? getAllGiftCards() : getGiftCardsForUser(user);

      res.json({ user, token, orders, commissions, wishlist, giftCards });
    }
  );

  app.post(
    '/api/auth/google',
    authRateLimiter,
    validateBody(googleAuthPayloadSchema),
    async (req, res) => {
      const settings = getSiteSettings();
      if (!settings.allowGmailOAuth) {
        return res.status(403).json({
          error: 'Gmail / Google OAuth sign-in is currently disabled in studio settings.',
        });
      }

      const { idToken, accessToken } = req.body as { idToken?: string; accessToken?: string };

    try {
      let email = '';
      let firstName = '';
      let lastName = '';

      if (idToken) {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!verifyRes.ok) {
          return res.status(401).json({ error: 'Invalid Google ID token.' });
        }
        const payload = (await verifyRes.json()) as {
          email?: string;
          email_verified?: string | boolean;
          given_name?: string;
          family_name?: string;
          name?: string;
          aud?: string;
        };

        const expectedClientId = settings.googleClientId || process.env.VITE_GOOGLE_CLIENT_ID;
        if (expectedClientId && payload.aud && payload.aud !== expectedClientId) {
          return res.status(401).json({ error: 'Google token audience mismatch.' });
        }

        if (!payload.email || (payload.email_verified !== true && payload.email_verified !== 'true')) {
          return res.status(401).json({ error: 'Google account email is not verified.' });
        }

        email = payload.email;
        firstName = payload.given_name || (payload.name ? payload.name.split(' ')[0] : 'Customer');
        lastName =
          payload.family_name ||
          (payload.name ? payload.name.split(' ').slice(1).join(' ') : '');
      } else if (accessToken) {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userinfoRes.ok) {
          return res.status(401).json({ error: 'Invalid Google access token.' });
        }
        const payload = (await userinfoRes.json()) as {
          email?: string;
          email_verified?: boolean;
          given_name?: string;
          family_name?: string;
          name?: string;
        };
        if (!payload.email || !payload.email_verified) {
          return res.status(401).json({ error: 'Google account email is not verified.' });
        }
        email = payload.email;
        firstName = payload.given_name || (payload.name ? payload.name.split(' ')[0] : 'Customer');
        lastName =
          payload.family_name ||
          (payload.name ? payload.name.split(' ').slice(1).join(' ') : '');
      }

      const user = upsertGoogleUser({ email, firstName, lastName });
      const token = createSession(user.id);
      setSessionCookie(res, req, token);

      const orders = user.role === 'ADMIN' ? getAllOrders() : getOrdersForUser(user);
      const commissions =
        user.role === 'ADMIN' ? getAllCommissions() : getCommissionsForUser(user);
      const wishlist = getWishlistForUser(user.id);
      const giftCards = user.role === 'ADMIN' ? getAllGiftCards() : getGiftCardsForUser(user);

      res.json({ user, token, orders, commissions, wishlist, giftCards });
    } catch {
      res.status(500).json({ error: 'Failed to verify Google authentication.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getRequestToken(req);
    if (token) {
      deleteSession(token);
    }
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  app.patch('/api/auth/profile', validateBody(profileUpdateSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const { firstName, lastName } = req.body as { firstName: string; lastName: string };

    const updated = updateUserName(user.id, firstName, lastName ?? '');
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: updated });
  });

  app.patch('/api/auth/password', validateBody(passwordUpdatePayloadSchema), (req, res) => {
    const sessionUser = getAuthenticatedUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required.' });

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword: string;
    };

    const record = getUserWithPasswordById(sessionUser.id);
    if (!record) return res.status(404).json({ error: 'User not found.' });

    if (record.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, record.passwordHash)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    updateUserPassword(sessionUser.id, newPassword);
    res.json({ ok: true });
  });

  // --- Payments Configuration (Public & Admin) ---
  app.get('/api/payments/config', (_req, res) => {
    const settings = getSiteSettings();
    const creds = getResolvedStripeCredentials();
    const paypalCreds = getResolvedPayPalCredentials();
    res.json({
      stripeEnabled: settings.stripeEnabled ?? true,
      stripeMode: settings.stripeMode || 'test',
      publishableKey: creds.publishableKey,
      configured: Boolean(creds.publishableKey && creds.secretKey),
      webhookConfigured: Boolean(creds.webhookSecret),
      paypalEnabled: settings.paypalEnabled ?? true,
      paypalMode: paypalCreds.mode,
      paypalClientId: paypalCreds.clientId,
      paypalConfigured: Boolean(paypalCreds.clientId && paypalCreds.clientSecret),
      paypalWebhookConfigured: Boolean(paypalCreds.webhookId),
      cashOnPickupEnabled: settings.cashOnPickupEnabled ?? true,
      cashOnPickupInstructions: settings.cashOnPickupInstructions || '',
    });
  });

  app.get('/api/admin/payment-settings', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    res.json({ paymentSettings: getAdminPaymentSettingsView() });
  });

  app.put('/api/admin/payment-settings', validateBody(paymentSettingsSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const {
      stripeEnabled,
      stripeMode,
      stripePublishableKey,
      stripeStatementDescriptor,
      stripeSecretKey,
      stripeWebhookSecret,
      paypalEnabled,
      paypalMode,
      paypalClientId,
      paypalClientSecret,
      paypalWebhookId,
      cashOnPickupEnabled,
      cashOnPickupInstructions,
      clearSecretKey,
      clearWebhookSecret,
      clearPaypalSecret,
      clearPaypalWebhookId,
    } = req.body as {
      stripeEnabled?: boolean;
      stripeMode?: 'test' | 'live';
      stripePublishableKey?: string;
      stripeStatementDescriptor?: string;
      stripeSecretKey?: string;
      stripeWebhookSecret?: string;
      paypalEnabled?: boolean;
      paypalMode?: 'sandbox' | 'live';
      paypalClientId?: string;
      paypalClientSecret?: string;
      paypalWebhookId?: string;
      cashOnPickupEnabled?: boolean;
      cashOnPickupInstructions?: string;
      clearSecretKey?: boolean;
      clearWebhookSecret?: boolean;
      clearPaypalSecret?: boolean;
      clearPaypalWebhookId?: boolean;
    };

    const currentSettings = getSiteSettings();
    const nextSettings: SiteSettings = {
      ...currentSettings,
      stripeEnabled: typeof stripeEnabled === 'boolean' ? stripeEnabled : currentSettings.stripeEnabled,
      stripeMode: stripeMode ? (stripeMode === 'live' ? 'live' : 'test') : currentSettings.stripeMode,
      stripePublishableKey:
        typeof stripePublishableKey === 'string'
          ? stripePublishableKey.trim()
          : currentSettings.stripePublishableKey,
      stripeStatementDescriptor:
        typeof stripeStatementDescriptor === 'string'
          ? stripeStatementDescriptor.trim().slice(0, 22)
          : currentSettings.stripeStatementDescriptor,
      paypalEnabled:
        typeof paypalEnabled === 'boolean'
          ? paypalEnabled
          : currentSettings.paypalEnabled ?? true,
      paypalMode: paypalMode
        ? paypalMode === 'live'
          ? 'live'
          : 'sandbox'
        : currentSettings.paypalMode || 'sandbox',
      paypalClientId:
        typeof paypalClientId === 'string'
          ? paypalClientId.trim()
          : currentSettings.paypalClientId,
      cashOnPickupEnabled:
        typeof cashOnPickupEnabled === 'boolean'
          ? cashOnPickupEnabled
          : currentSettings.cashOnPickupEnabled ?? true,
      cashOnPickupInstructions:
        typeof cashOnPickupInstructions === 'string'
          ? cashOnPickupInstructions.trim()
          : currentSettings.cashOnPickupInstructions,
    };

    const savedSettings = updateSiteSettings(nextSettings);
    savePaymentSecrets({
      stripeSecretKey,
      stripeWebhookSecret,
      paypalClientSecret,
      paypalWebhookId,
      clearSecretKey,
      clearWebhookSecret,
      clearPaypalSecret,
      clearPaypalWebhookId,
    });

    res.json({
      paymentSettings: getAdminPaymentSettingsView(),
      settings: savedSettings,
    });
  });

  app.post('/api/admin/payment-settings/test', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const creds = getResolvedStripeCredentials();
    if (!creds.secretKey) {
      return res.status(400).json({
        error: 'No Stripe Secret Key saved yet. Enter a sk_test_... or sk_live_... key and save first.',
      });
    }

    try {
      const stripe = new Stripe(creds.secretKey);
      const balance = await stripe.balance.retrieve();
      res.json({
        ok: true,
        livemode: balance.livemode,
        availableCurrencies: balance.available.map((b) => b.currency.toUpperCase()),
        hasPublishableKey: Boolean(creds.publishableKey),
        hasWebhookSecret: Boolean(creds.webhookSecret),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to authenticate with Stripe.';
      res.status(400).json({ error: `Stripe connection test failed: ${message}` });
    }
  });

  app.post('/api/admin/payment-settings/test-paypal', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const creds = getResolvedPayPalCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      return res.status(400).json({
        error: 'PayPal Client ID and Client Secret are required. Save your PayPal credentials first.',
      });
    }

    try {
      const result = await testPayPalConnection({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        mode: creds.mode,
      });
      res.json({
        ok: result.ok,
        mode: result.mode,
        hasClientId: Boolean(creds.clientId),
        hasWebhookId: Boolean(creds.webhookId),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to authenticate with PayPal.';
      res.status(400).json({ error: `PayPal connection test failed: ${message}` });
    }
  });

  // --- PayPal Webhook (Verifies Transmission Signature against PayPal API) ---
  app.post('/api/paypal/webhook', async (req, res) => {
    const creds = getResolvedPayPalCredentials();
    if (!creds.clientId || !creds.clientSecret || !creds.webhookId) {
      return res.status(400).json({
        error: 'PayPal webhook ID or API credentials are not configured on server.',
      });
    }

    const event = req.body as {
      id?: string;
      event_type?: string;
      resource?: {
        id?: string;
        status?: string;
        custom_id?: string;
        amount?: { currency_code?: string; value?: string };
        seller_receivable_breakdown?: {
          paypal_fee?: { currency_code?: string; value?: string };
          net_amount?: { currency_code?: string; value?: string };
        };
        supplementary_data?: {
          related_ids?: { order_id?: string; capture_id?: string };
        };
      };
    };

    try {
      const valid = await verifyPayPalWebhookSignature({
        creds: {
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          mode: creds.mode,
        },
        webhookId: creds.webhookId,
        headers: req.headers,
        webhookEvent: event,
      });

      if (!valid) {
        return res.status(400).json({ error: 'PayPal webhook signature verification failed.' });
      }

      const eventId = event.id ? `paypal:${event.id}` : '';
      const eventType = event.event_type || '';
      const resource = event.resource;

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resource) {
        const customId = resource.custom_id?.trim() || '';
        const relatedPayPalOrderId =
          resource.supplementary_data?.related_ids?.order_id?.trim() || '';
        const captureId = resource.id?.trim() || '';

        const isGiftCard =
          customId.startsWith('gc-') ||
          Boolean(relatedPayPalOrderId && getGiftCardByPayPalOrderId(relatedPayPalOrderId));

        if (isGiftCard) {
          const gcResult = activateGiftCardAtomic({
            giftCardId: customId.startsWith('gc-') ? customId : undefined,
            paypalOrderId: relatedPayPalOrderId || undefined,
            paypalCaptureId: captureId || undefined,
            eventId: eventId || undefined,
            eventType,
          });
          if (gcResult.giftCard && gcResult.newlyActivated) {
            void sendGiftCardDeliveryEmail(gcResult.giftCard).catch((emailErr) => {
              console.warn('PayPal webhook gift card delivery email failed:', emailErr);
            });
          }
          return res.json({ received: true });
        }

        const matchedOrder =
          (customId ? getOrderById(customId) : null) ||
          (relatedPayPalOrderId ? getOrderByPayPalOrderId(relatedPayPalOrderId) : null);

        if (matchedOrder) {
          const capturedCents = payPalAmountStringToCents(resource.amount?.value);
          if (capturedCents !== null && capturedCents !== matchedOrder.totalCents) {
            return res.status(400).json({ error: 'Captured PayPal amount mismatch.' });
          }
          const feeCents =
            resource.seller_receivable_breakdown?.paypal_fee?.currency_code?.toUpperCase() === 'NZD'
              ? payPalAmountStringToCents(resource.seller_receivable_breakdown?.paypal_fee?.value) ??
                estimatePayPalFeeCents(matchedOrder.totalCents)
              : estimatePayPalFeeCents(matchedOrder.totalCents);
          const netCents =
            resource.seller_receivable_breakdown?.net_amount?.currency_code?.toUpperCase() === 'NZD'
              ? payPalAmountStringToCents(resource.seller_receivable_breakdown?.net_amount?.value) ??
                Math.max(0, matchedOrder.totalCents - feeCents)
              : Math.max(0, matchedOrder.totalCents - feeCents);

          const paidResult = markOrderPaidAtomic({
            orderId: matchedOrder.id,
            paypalOrderId: relatedPayPalOrderId || matchedOrder.paypalOrderId,
            paypalCaptureId: captureId,
            stripeFeeCents: feeCents,
            netCents,
            eventId: eventId || undefined,
            eventType,
          });
          refreshPublicSitemap();
          if (paidResult.order && !paidResult.alreadyProcessed) {
            void sendOrderConfirmationEmail({
              order: paidResult.order,
              authenticatedUserId: paidResult.order.userId,
            }).catch((emailErr) => {
              console.warn('PayPal webhook confirmation email failed:', emailErr);
            });
          }
        }
      } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED' && resource) {
        if (!eventId || recordStripeEvent(eventId, eventType)) {
          const captureId =
            resource.supplementary_data?.related_ids?.capture_id?.trim() ||
            resource.id?.trim() ||
            '';
          const refundCents = payPalAmountStringToCents(resource.amount?.value);
          const matchedOrder = captureId ? getOrderByPayPalCaptureId(captureId) : null;
          if (matchedOrder && refundCents) {
            recordOrderRefund({
              orderId: matchedOrder.id,
              refundAmountCents: refundCents,
              paypalRefundId: resource.id,
            });
          }
        }
      } else if (eventId) {
        recordStripeEvent(eventId, eventType || 'paypal.event');
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('PayPal webhook processing error:', err);
      return res.status(500).json({ error: 'PayPal webhook processing error.' });
    }
  });

  // --- Authoritative Server-Side Checkout & PaymentIntent Routes ---
  app.post(
    '/api/checkout/create-payment-intent',
    validateBody(createPaymentIntentSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const settings = getSiteSettings();
      const creds = getResolvedStripeCredentials();

      if (!settings.stripeEnabled) {
        return res.status(400).json({
          code: 'STRIPE_DISABLED',
          error: 'Online card checkout is currently paused by the studio administrator.',
        });
      }

      if (!creds.publishableKey || !creds.secretKey) {
        return res.status(400).json({
          code: 'STRIPE_NOT_CONFIGURED',
          error:
            'Stripe API keys are not configured yet. Please ask the studio administrator to enter Stripe keys in Dashboard → Admin → Payment Settings.',
        });
      }

      const {
        items: requestedItems,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        selectedServiceId,
        discountCode,
        giftCardCode,
        orderNotes,
        previousOrderId,
        idempotencyKey,
      } = req.body as {
        items: { productId: string; quantity: number }[];
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        shippingAddress: Order['shippingAddress'];
        selectedServiceId?: string;
        discountCode?: string;
        giftCardCode?: string;
        orderNotes?: string;
        previousOrderId?: string;
        idempotencyKey?: string;
      };

    if (previousOrderId) {
      cancelPendingOrder(previousOrderId);
    }

    let validGiftCard: { code: string; remainingBalanceCents: number } | null = null;
    if (giftCardCode && giftCardCode.trim()) {
      const check = validateGiftCardForCheckout(giftCardCode);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Gift card code is invalid.' });
      }
      validGiftCard = {
        code: check.code,
        remainingBalanceCents: check.remainingBalanceCents,
      };
    }

    const allProducts = getAllProducts();
    const cartItems: CartItem[] = [];
    for (const reqItem of requestedItems) {
      const qty = Math.floor(Number(reqItem.quantity));
      if (!reqItem.productId || !Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: 'Invalid cart item quantity.' });
      }
      const product = allProducts.find((p) => p.id === reqItem.productId);
      if (!product || !product.published) {
        return res.status(400).json({ error: 'One or more products are no longer available.' });
      }
      if (product.isUniquePiece && qty > 1) {
        return res.status(400).json({ error: `"${product.title}" is a 1-of-1 unique piece.` });
      }
      cartItems.push({ product, quantity: qty });
    }

    const cleanCountry = (shippingAddress.country || 'New Zealand').trim();
    const restrictedItem = cartItems.find(
      (ci) => ci.product.isExportRestricted || ci.product.material === 'Whale Bone'
    );
    if (restrictedItem && cleanCountry.toLowerCase() !== 'new zealand') {
      return res.status(400).json({
        error: `"${restrictedItem.product.title}" cannot be shipped outside New Zealand due to DOC / export restrictions.`,
      });
    }

    const couriers = getCouriers();
    const rates = getCourierRates();
    const activeDiscounts = getDiscounts(true);
    const allServices = couriers
      .filter((c) => c.isActive)
      .flatMap((c) => c.services.filter((s) => s.isActive));

    const summary = priceCart({
      items: cartItems,
      selectedServiceId,
      services: allServices,
      rates,
      discounts: activeDiscounts,
      discountCode,
      giftCardCode: validGiftCard?.code,
      giftCardBalanceCents: validGiftCard?.remainingBalanceCents || 0,
    });

    if (summary.totalCents === 0 && summary.giftCardAppliedCents > 0) {
      return res.status(400).json({
        code: 'COVERED_BY_GIFT_CARD',
        error: 'Your Gift Card covers 100% of this order. Complete checkout directly with your Gift Card.',
      });
    }
    if (summary.totalCents < 50) {
      return res.status(400).json({
        error: 'Remaining order balance after gift card must be $0.00 or at least $0.50 NZD for Stripe.',
      });
    }

    const selectedService = summary.selectedService || allServices[0];
    const selectedCourier = couriers.find((c) => c.id === selectedService?.courierId);
    const orderId = `ord-${crypto.randomUUID()}`;
    const orderNumber = `PA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pendingOrder: Order = {
      id: orderId,
      orderNumber,
      userId: user?.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress: {
        line1: shippingAddress.line1.trim(),
        line2: shippingAddress.line2?.trim() || '',
        city: shippingAddress.city.trim(),
        region: shippingAddress.region.trim(),
        postcode: shippingAddress.postcode.trim(),
        country: cleanCountry,
        isRural: Boolean(shippingAddress.isRural),
      },
      items: cartItems.map((ci) => ({
        productId: ci.product.id,
        title: ci.product.title,
        sku: ci.product.sku,
        priceCents: ci.product.priceCents,
        material: ci.product.material,
        designType: ci.product.designType,
        dimensions: ci.product.dimensions,
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
        permitRef: ci.product.permitRef,
        carverName: ci.product.carverName,
        quantity: ci.quantity,
        image: ci.product.images[0] || '',
      })),
      courierName: selectedCourier?.name || 'NZ Post',
      courierServiceName: selectedService?.name || 'Insured Courier Service',
      packageSizeCode: summary.packageSize,
      shippingCents: summary.shippingCents,
      subtotalCents: summary.subtotalCents,
      discountCents: summary.discountCents,
      discountCode: summary.appliedDiscount?.code,
      giftCardCode: summary.giftCardAppliedCents > 0 ? summary.giftCardCode : undefined,
      giftCardAppliedCents: summary.giftCardAppliedCents,
      gstCents: summary.gstCents,
      totalCents: summary.totalCents,
      paymentMethod: 'STRIPE',
      paymentStatus: 'UNPAID',
      orderNotes: orderNotes?.trim().slice(0, 1000) || undefined,
      stripePaymentIntentId: '',
      stripeFeeCents: summary.estimatedStripeFeeCents,
      netCents: summary.estimatedNetReceivedCents,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const reserved = createPendingOrderAtomic(pendingOrder, user?.id);
    if (!reserved.ok) {
      return res.status(409).json({ error: reserved.error });
    }

    try {
      const stripe = new Stripe(creds.secretKey);
      const descriptorSuffix = (settings.stripeStatementDescriptor || 'POUNAMU ATELIER')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .slice(0, 22);

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: summary.totalCents,
          currency: 'nzd',
          automatic_payment_methods: { enabled: true },
          receipt_email: pendingOrder.customerEmail,
          description: `${settings.siteName} Order ${pendingOrder.orderNumber}`,
          ...(descriptorSuffix ? { statement_descriptor_suffix: descriptorSuffix } : {}),
          metadata: {
            kind: 'order',
            orderId: pendingOrder.id,
            orderNumber: pendingOrder.orderNumber,
          },
        },
        idempotencyKey ? { idempotencyKey: `pi-${idempotencyKey}-${orderId}` } : undefined
      );

      const attached = attachStripePaymentIntent(pendingOrder.id, paymentIntent.id) || {
        ...pendingOrder,
        stripePaymentIntentId: paymentIntent.id,
      };

      res.status(201).json({
        order: attached,
        clientSecret: paymentIntent.client_secret,
        publishableKey: creds.publishableKey,
        pricing: summary,
      });
    } catch (err) {
      cancelPendingOrder(pendingOrder.id);
      const message = err instanceof Error ? err.message : 'Unable to initialize Stripe payment.';
      res.status(400).json({ error: `Stripe initialization failed: ${message}` });
    }
  });

  app.post(
    '/api/checkout/cash-on-pickup',
    validateBody(cashOnPickupCheckoutSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const settings = getSiteSettings();

      if (settings.cashOnPickupEnabled === false) {
        return res.status(400).json({
          code: 'CASH_ON_PICKUP_DISABLED',
          error: 'Cash on Pickup is currently paused by the studio administrator.',
        });
      }

      const {
        items: requestedItems,
        customerName,
        customerEmail,
        customerPhone,
        pickupNotes,
        orderNotes,
        discountCode,
        giftCardCode,
      } = req.body as {
        items: { productId: string; quantity: number }[];
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        pickupNotes?: string;
        orderNotes?: string;
        discountCode?: string;
        giftCardCode?: string;
      };

    let validGiftCard: { code: string; remainingBalanceCents: number } | null = null;
    if (giftCardCode && giftCardCode.trim()) {
      const check = validateGiftCardForCheckout(giftCardCode);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Gift card code is invalid.' });
      }
      validGiftCard = {
        code: check.code,
        remainingBalanceCents: check.remainingBalanceCents,
      };
    }

    const allProducts = getAllProducts();
    const cartItems: CartItem[] = [];
    for (const reqItem of requestedItems) {
      const qty = Math.floor(Number(reqItem.quantity));
      if (!reqItem.productId || !Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: 'Invalid cart item quantity.' });
      }
      const product = allProducts.find((p) => p.id === reqItem.productId);
      if (!product || !product.published) {
        return res.status(400).json({ error: 'One or more products are no longer available.' });
      }
      if (product.isUniquePiece && qty > 1) {
        return res.status(400).json({ error: `"${product.title}" is a 1-of-1 unique piece.` });
      }
      cartItems.push({ product, quantity: qty });
    }

    const couriers = getCouriers();
    const rates = getCourierRates();
    const activeDiscounts = getDiscounts(true);
    const allServices = couriers
      .filter((c) => c.isActive)
      .flatMap((c) => c.services.filter((s) => s.isActive));

    const summary = priceCart({
      items: cartItems,
      services: allServices,
      rates,
      discounts: activeDiscounts,
      discountCode,
      giftCardCode: validGiftCard?.code,
      giftCardBalanceCents: validGiftCard?.remainingBalanceCents || 0,
      paymentMethod: 'CASH_ON_PICKUP',
    });

    if (summary.totalCents <= 0 && summary.giftCardAppliedCents <= 0) {
      return res.status(400).json({ error: 'Order total must be greater than $0.00.' });
    }

    const orderId = `ord-${crypto.randomUUID()}`;
    const orderNumber = `PA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pickupOrder: Order = {
      id: orderId,
      orderNumber,
      userId: user?.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress: {
        line1: `Studio Pickup — ${settings.workshopAddress}`,
        line2: pickupNotes?.trim() ? `Pickup Note: ${pickupNotes.trim()}` : '',
        city: 'Napier',
        region: "Hawke's Bay",
        postcode: '4110',
        country: 'New Zealand',
        isRural: false,
      },
      items: cartItems.map((ci) => ({
        productId: ci.product.id,
        title: ci.product.title,
        sku: ci.product.sku,
        priceCents: ci.product.priceCents,
        material: ci.product.material,
        designType: ci.product.designType,
        dimensions: ci.product.dimensions,
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
        permitRef: ci.product.permitRef,
        carverName: ci.product.carverName,
        quantity: ci.quantity,
        image: ci.product.images[0] || '',
      })),
      courierName: 'Studio Pickup',
      courierServiceName: 'Cash on Pickup (Napier Workshop)',
      packageSizeCode: summary.packageSize,
      shippingCents: 0,
      subtotalCents: summary.subtotalCents,
      discountCents: summary.discountCents,
      discountCode: summary.appliedDiscount?.code,
      giftCardCode: summary.giftCardAppliedCents > 0 ? summary.giftCardCode : undefined,
      giftCardAppliedCents: summary.giftCardAppliedCents,
      gstCents: summary.gstCents,
      totalCents: summary.totalCents,
      paymentMethod: 'CASH_ON_PICKUP',
      paymentStatus: summary.totalCents === 0 ? 'PAID' : 'PAY_ON_PICKUP',
      pickupNotes: pickupNotes?.trim() || undefined,
      orderNotes: orderNotes?.trim().slice(0, 1000) || undefined,
      stripePaymentIntentId: '',
      stripeFeeCents: 0,
      netCents: summary.totalCents + summary.giftCardAppliedCents,
      status: 'PROCESSING',
      createdAt: new Date().toISOString(),
    };

    const confirmed = createCashOnPickupOrderAtomic(pickupOrder, user?.id);
    if (!confirmed.ok) {
      return res.status(409).json({ error: confirmed.error });
    }

    refreshPublicSitemap();

    let emailResult = null;
    try {
      emailResult = await sendOrderConfirmationEmail({
        order: confirmed.order,
        authenticatedUserId: confirmed.order.userId,
      });
    } catch {
      emailResult = null;
    }

    res.status(201).json({
      order: confirmed.order,
      products: getVisibleProductsForUser(user),
      emailLog: emailResult?.emailLog || null,
    });
  });

  app.post(
    '/api/checkout/gift-card-complete',
    validateBody(giftCardCheckoutCompleteSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const settings = getSiteSettings();
      const {
        items: requestedItems,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        pickupNotes,
        orderNotes,
        fulfillmentMode = 'courier',
        selectedServiceId,
        discountCode,
        giftCardCode,
      } = req.body as {
        items: { productId: string; quantity: number }[];
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        shippingAddress?: Order['shippingAddress'];
        pickupNotes?: string;
        orderNotes?: string;
        fulfillmentMode?: 'courier' | 'pickup';
        selectedServiceId?: string;
        discountCode?: string;
        giftCardCode: string;
      };

    const gcCheck = validateGiftCardForCheckout(giftCardCode);
    if (!gcCheck.valid) {
      return res.status(400).json({ error: gcCheck.error || 'Gift card code is invalid.' });
    }

    const isPickup = fulfillmentMode === 'pickup';
    if (
      !isPickup &&
      (!shippingAddress?.line1?.trim() ||
        !shippingAddress?.city?.trim() ||
        !shippingAddress?.region?.trim() ||
        !shippingAddress?.postcode?.trim())
    ) {
      return res.status(400).json({ error: 'Complete shipping address is required for courier dispatch.' });
    }

    const allProducts = getAllProducts();
    const cartItems: CartItem[] = [];
    for (const reqItem of requestedItems) {
      const qty = Math.floor(Number(reqItem.quantity));
      if (!reqItem.productId || !Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: 'Invalid cart item quantity.' });
      }
      const product = allProducts.find((p) => p.id === reqItem.productId);
      if (!product || !product.published) {
        return res.status(400).json({ error: 'One or more products are no longer available.' });
      }
      if (product.isUniquePiece && qty > 1) {
        return res.status(400).json({ error: `"${product.title}" is a 1-of-1 unique piece.` });
      }
      cartItems.push({ product, quantity: qty });
    }

    const cleanCountry = (shippingAddress?.country || 'New Zealand').trim();
    if (!isPickup) {
      const restrictedItem = cartItems.find(
        (ci) => ci.product.isExportRestricted || ci.product.material === 'Whale Bone'
      );
      if (restrictedItem && cleanCountry.toLowerCase() !== 'new zealand') {
        return res.status(400).json({
          error: `"${restrictedItem.product.title}" cannot be shipped outside New Zealand due to DOC / export restrictions.`,
        });
      }
    }

    const couriers = getCouriers();
    const rates = getCourierRates();
    const activeDiscounts = getDiscounts(true);
    const allServices = couriers
      .filter((c) => c.isActive)
      .flatMap((c) => c.services.filter((s) => s.isActive));

    const summary = priceCart({
      items: cartItems,
      selectedServiceId,
      services: allServices,
      rates,
      discounts: activeDiscounts,
      discountCode,
      giftCardCode: gcCheck.code,
      giftCardBalanceCents: gcCheck.remainingBalanceCents,
      paymentMethod: isPickup ? 'CASH_ON_PICKUP' : 'GIFT_CARD',
    });

    if (summary.totalCents > 0 || summary.giftCardAppliedCents <= 0) {
      return res.status(400).json({
        error: `Gift card balance (${gcCheck.code}) covers $${(
          summary.giftCardAppliedCents / 100
        ).toFixed(2)} NZD; $${(summary.totalCents / 100).toFixed(
          2
        )} NZD remains payable via Stripe or Cash on Pickup.`,
      });
    }

    const selectedService = summary.selectedService || allServices[0];
    const selectedCourier = couriers.find((c) => c.id === selectedService?.courierId);
    const orderId = `ord-${crypto.randomUUID()}`;
    const orderNumber = `PA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const gcOrder: Order = {
      id: orderId,
      orderNumber,
      userId: user?.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress: isPickup
        ? {
            line1: `Studio Pickup — ${settings.workshopAddress}`,
            line2: pickupNotes?.trim() ? `Pickup Note: ${pickupNotes.trim()}` : '',
            city: 'Napier',
            region: "Hawke's Bay",
            postcode: '4110',
            country: 'New Zealand',
            isRural: false,
          }
        : {
            line1: shippingAddress!.line1.trim(),
            line2: shippingAddress?.line2?.trim() || '',
            city: shippingAddress!.city.trim(),
            region: shippingAddress!.region.trim(),
            postcode: shippingAddress!.postcode.trim(),
            country: cleanCountry,
            isRural: Boolean(shippingAddress?.isRural),
          },
      items: cartItems.map((ci) => ({
        productId: ci.product.id,
        title: ci.product.title,
        sku: ci.product.sku,
        priceCents: ci.product.priceCents,
        material: ci.product.material,
        designType: ci.product.designType,
        dimensions: ci.product.dimensions,
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
        permitRef: ci.product.permitRef,
        carverName: ci.product.carverName,
        quantity: ci.quantity,
        image: ci.product.images[0] || '',
      })),
      courierName: isPickup ? 'Studio Pickup' : selectedCourier?.name || 'NZ Post',
      courierServiceName: isPickup
        ? 'Studio Collection (Napier Workshop)'
        : selectedService?.name || 'Insured Courier Service',
      packageSizeCode: summary.packageSize,
      shippingCents: summary.shippingCents,
      subtotalCents: summary.subtotalCents,
      discountCents: summary.discountCents,
      discountCode: summary.appliedDiscount?.code,
      giftCardCode: summary.giftCardCode,
      giftCardAppliedCents: summary.giftCardAppliedCents,
      gstCents: summary.gstCents,
      totalCents: 0,
      paymentMethod: 'GIFT_CARD',
      paymentStatus: 'PAID',
      pickupNotes: isPickup && pickupNotes?.trim() ? pickupNotes.trim() : undefined,
      orderNotes: orderNotes?.trim().slice(0, 1000) || undefined,
      stripePaymentIntentId: '',
      stripeFeeCents: 0,
      netCents: summary.giftCardAppliedCents,
      status: 'PAID',
      createdAt: new Date().toISOString(),
    };

    const confirmed = createGiftCardPaidOrderAtomic(gcOrder, user?.id);
    if (!confirmed.ok) {
      return res.status(409).json({ error: confirmed.error });
    }

    refreshPublicSitemap();

    let emailResult = null;
    try {
      emailResult = await sendOrderConfirmationEmail({
        order: confirmed.order,
        authenticatedUserId: confirmed.order.userId,
      });
    } catch {
      emailResult = null;
    }

    res.status(201).json({
      order: confirmed.order,
      products: getVisibleProductsForUser(user),
      emailLog: emailResult?.emailLog || null,
      remainingGiftCardBalanceCents: confirmed.remainingGiftCardBalanceCents,
    });
  });

  app.post(
    '/api/checkout/confirm-status',
    validateBody(confirmStripeStatusSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const { orderId, paymentIntentId } = req.body as {
        orderId: string;
        paymentIntentId: string;
      };

    const order = getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
      return res.status(403).json({ error: 'PaymentIntent does not belong to this order.' });
    }
    if (order.status !== 'PENDING') {
      return res.json({
        status: order.status,
        order,
        products: getVisibleProductsForUser(user),
      });
    }

    const creds = getResolvedStripeCredentials();
    if (!creds.secretKey) {
      return res.status(400).json({ error: 'Stripe secret key missing.' });
    }

    try {
      const stripe = new Stripe(creds.secretKey);
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      });

      if (pi.metadata?.orderId && pi.metadata.orderId !== order.id) {
        return res.status(403).json({ error: 'PaymentIntent does not belong to this order.' });
      }

      if (pi.status === 'succeeded') {
        const { feeCents, netCents } = await extractStripeFeeAndNet(stripe, pi, order.totalCents);
        const result = markOrderPaidAtomic({
          orderId: order.id,
          paymentIntentId: pi.id,
          stripeFeeCents: feeCents,
          netCents,
        });
        refreshPublicSitemap();
        let emailResult = null;
        if (result.order) {
          emailResult = await sendOrderConfirmationEmail({
            order: result.order,
            authenticatedUserId: result.order.userId,
          }).catch(() => null);
        }
        return res.json({
          status: result.order?.status || 'PAID',
          order: result.order || order,
          products: getVisibleProductsForUser(user),
          emailLog: emailResult?.emailLog || null,
        });
      }

      res.json({
        status: order.status,
        stripeStatus: pi.status,
        order,
        products: getVisibleProductsForUser(user),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify Stripe payment status.';
      res.status(400).json({ error: message });
    }
  });

  // --- Authoritative Server-Side PayPal Checkout Routes ---
  app.post(
    '/api/checkout/paypal/create-order',
    validateBody(createPaymentIntentSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const settings = getSiteSettings();
      const creds = getResolvedPayPalCredentials();

      if (settings.paypalEnabled === false) {
        return res.status(400).json({
          code: 'PAYPAL_DISABLED',
          error: 'PayPal checkout is currently paused by the studio administrator.',
        });
      }

      if (!creds.clientId || !creds.clientSecret) {
        return res.status(400).json({
          code: 'PAYPAL_NOT_CONFIGURED',
          error:
            'PayPal credentials are not configured yet. Please ask the studio administrator to enter the PayPal Client ID & Client Secret in Dashboard → Admin → Payment Settings.',
        });
      }

      const {
        items: requestedItems,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        selectedServiceId,
        discountCode,
        giftCardCode,
        orderNotes,
        previousOrderId,
      } = req.body as {
        items: { productId: string; quantity: number }[];
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        shippingAddress: Order['shippingAddress'];
        selectedServiceId?: string;
        discountCode?: string;
        giftCardCode?: string;
        orderNotes?: string;
        previousOrderId?: string;
      };

      if (previousOrderId) {
        cancelPendingOrder(previousOrderId);
      }

      let validGiftCard: { code: string; remainingBalanceCents: number } | null = null;
      if (giftCardCode && giftCardCode.trim()) {
        const check = validateGiftCardForCheckout(giftCardCode);
        if (!check.valid) {
          return res.status(400).json({ error: check.error || 'Gift card code is invalid.' });
        }
        validGiftCard = {
          code: check.code,
          remainingBalanceCents: check.remainingBalanceCents,
        };
      }

      const allProducts = getAllProducts();
      const cartItems: CartItem[] = [];
      for (const reqItem of requestedItems) {
        const qty = Math.floor(Number(reqItem.quantity));
        if (!reqItem.productId || !Number.isFinite(qty) || qty < 1) {
          return res.status(400).json({ error: 'Invalid cart item quantity.' });
        }
        const product = allProducts.find((p) => p.id === reqItem.productId);
        if (!product || !product.published) {
          return res.status(400).json({ error: 'One or more products are no longer available.' });
        }
        if (product.isUniquePiece && qty > 1) {
          return res.status(400).json({ error: `"${product.title}" is a 1-of-1 unique piece.` });
        }
        cartItems.push({ product, quantity: qty });
      }

      const cleanCountry = (shippingAddress.country || 'New Zealand').trim();
      const restrictedItem = cartItems.find(
        (ci) => ci.product.isExportRestricted || ci.product.material === 'Whale Bone'
      );
      if (restrictedItem && cleanCountry.toLowerCase() !== 'new zealand') {
        return res.status(400).json({
          error: `"${restrictedItem.product.title}" cannot be shipped outside New Zealand due to DOC / export restrictions.`,
        });
      }

      const couriers = getCouriers();
      const rates = getCourierRates();
      const activeDiscounts = getDiscounts(true);
      const allServices = couriers
        .filter((c) => c.isActive)
        .flatMap((c) => c.services.filter((s) => s.isActive));

      const summary = priceCart({
        items: cartItems,
        selectedServiceId,
        services: allServices,
        rates,
        discounts: activeDiscounts,
        discountCode,
        giftCardCode: validGiftCard?.code,
        giftCardBalanceCents: validGiftCard?.remainingBalanceCents || 0,
        paymentMethod: 'PAYPAL',
      });

      if (summary.totalCents === 0 && summary.giftCardAppliedCents > 0) {
        return res.status(400).json({
          code: 'COVERED_BY_GIFT_CARD',
          error: 'Your Gift Card covers 100% of this order. Complete checkout directly with your Gift Card.',
        });
      }
      if (summary.totalCents < 50) {
        return res.status(400).json({
          error: 'Remaining order balance after gift card must be $0.00 or at least $0.50 NZD for PayPal.',
        });
      }

      const selectedService = summary.selectedService || allServices[0];
      const selectedCourier = couriers.find((c) => c.id === selectedService?.courierId);
      const orderId = `ord-${crypto.randomUUID()}`;
      const orderNumber = `PA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const pendingOrder: Order = {
        id: orderId,
        orderNumber,
        userId: user?.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        shippingAddress: {
          line1: shippingAddress.line1.trim(),
          line2: shippingAddress.line2?.trim() || '',
          city: shippingAddress.city.trim(),
          region: shippingAddress.region.trim(),
          postcode: shippingAddress.postcode.trim(),
          country: cleanCountry,
          isRural: Boolean(shippingAddress.isRural),
        },
        items: cartItems.map((ci) => ({
          productId: ci.product.id,
          title: ci.product.title,
          sku: ci.product.sku,
          priceCents: ci.product.priceCents,
          material: ci.product.material,
          designType: ci.product.designType,
          dimensions: ci.product.dimensions,
          authenticityCode: ci.product.authenticityCode,
          originRiver: ci.product.originRiver,
          permitRef: ci.product.permitRef,
          carverName: ci.product.carverName,
          quantity: ci.quantity,
          image: ci.product.images[0] || '',
        })),
        courierName: selectedCourier?.name || 'NZ Post',
        courierServiceName: selectedService?.name || 'Insured Courier Service',
        packageSizeCode: summary.packageSize,
        shippingCents: summary.shippingCents,
        subtotalCents: summary.subtotalCents,
        discountCents: summary.discountCents,
        discountCode: summary.appliedDiscount?.code,
        giftCardCode: summary.giftCardAppliedCents > 0 ? summary.giftCardCode : undefined,
        giftCardAppliedCents: summary.giftCardAppliedCents,
        gstCents: summary.gstCents,
        totalCents: summary.totalCents,
        paymentMethod: 'PAYPAL',
        paymentStatus: 'UNPAID',
        orderNotes: orderNotes?.trim().slice(0, 1000) || undefined,
        stripePaymentIntentId: '',
        paypalOrderId: '',
        stripeFeeCents: summary.estimatedStripeFeeCents,
        netCents: summary.estimatedNetReceivedCents,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      const reserved = createPendingOrderAtomic(pendingOrder, user?.id);
      if (!reserved.ok) {
        return res.status(409).json({ error: reserved.error });
      }

      try {
        const ppOrder = await createPayPalOrder({
          creds: {
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            mode: creds.mode,
          },
          totalCents: summary.totalCents,
          orderId: pendingOrder.id,
          orderNumber: pendingOrder.orderNumber,
          description: `${settings.siteName} Order ${pendingOrder.orderNumber}`,
          brandName: settings.siteName,
        });

        const attached = attachPayPalOrder(pendingOrder.id, ppOrder.id) || {
          ...pendingOrder,
          paypalOrderId: ppOrder.id,
        };

        res.status(201).json({
          order: attached,
          paypalOrderId: ppOrder.id,
          clientId: creds.clientId,
          mode: creds.mode,
          pricing: summary,
        });
      } catch (err) {
        cancelPendingOrder(pendingOrder.id);
        const message = err instanceof Error ? err.message : 'Unable to initialize PayPal checkout.';
        res.status(400).json({ error: `PayPal initialization failed: ${message}` });
      }
    }
  );

  app.post(
    '/api/checkout/paypal/capture-order',
    validateBody(paypalCaptureOrderSchema),
    async (req, res) => {
      const user = getAuthenticatedUser(req);
      const { orderId, paypalOrderId } = req.body as {
        orderId: string;
        paypalOrderId: string;
      };

      const order = getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      if (order.paypalOrderId && order.paypalOrderId !== paypalOrderId) {
        return res.status(403).json({ error: 'PayPal order does not belong to this studio order.' });
      }
      if (order.status !== 'PENDING') {
        return res.json({
          status: order.status,
          order,
          products: getVisibleProductsForUser(user),
        });
      }

      const creds = getResolvedPayPalCredentials();
      if (!creds.clientId || !creds.clientSecret) {
        return res.status(400).json({ error: 'PayPal credentials are not configured on server.' });
      }

      try {
        let captureResult;
        try {
          captureResult = await capturePayPalOrder({
            creds: {
              clientId: creds.clientId,
              clientSecret: creds.clientSecret,
              mode: creds.mode,
            },
            paypalOrderId,
          });
        } catch (capErr) {
          const existingDetails = await getPayPalOrderDetails({
            creds: {
              clientId: creds.clientId,
              clientSecret: creds.clientSecret,
              mode: creds.mode,
            },
            paypalOrderId,
          });
          if (existingDetails && existingDetails.captureStatus === 'COMPLETED') {
            captureResult = existingDetails;
          } else {
            throw capErr;
          }
        }

        if (captureResult.customId && captureResult.customId !== order.id) {
          return res.status(403).json({ error: 'PayPal order reference mismatch.' });
        }

        if (
          captureResult.captureStatus !== 'COMPLETED' &&
          captureResult.orderStatus !== 'COMPLETED'
        ) {
          return res.status(400).json({
            error: `PayPal payment has not completed yet (status: ${captureResult.captureStatus || captureResult.orderStatus}).`,
          });
        }

        if (captureResult.currencyCode !== 'NZD') {
          return res.status(400).json({ error: 'Unexpected PayPal payment currency.' });
        }

        if (
          captureResult.capturedCents !== null &&
          captureResult.capturedCents !== order.totalCents
        ) {
          return res.status(400).json({
            error: 'Captured PayPal amount does not match the authoritative NZD order total.',
          });
        }

        const feeCents =
          captureResult.feeCents !== null
            ? captureResult.feeCents
            : estimatePayPalFeeCents(order.totalCents);
        const netCents =
          captureResult.netCents !== null
            ? captureResult.netCents
            : Math.max(0, order.totalCents - feeCents);

        const result = markOrderPaidAtomic({
          orderId: order.id,
          paypalOrderId: captureResult.paypalOrderId,
          paypalCaptureId: captureResult.captureId,
          stripeFeeCents: feeCents,
          netCents,
        });
        refreshPublicSitemap();

        let emailResult = null;
        if (result.order) {
          emailResult = await sendOrderConfirmationEmail({
            order: result.order,
            authenticatedUserId: result.order.userId,
          }).catch(() => null);
        }

        return res.json({
          status: result.order?.status || 'PAID',
          order: result.order || order,
          products: getVisibleProductsForUser(user),
          emailLog: emailResult?.emailLog || null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to capture PayPal payment.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.post(
    '/api/checkout/paypal/cancel-order',
    validateBody(paypalCancelOrderSchema),
    (req, res) => {
      const { orderId, paypalOrderId } = req.body as {
        orderId: string;
        paypalOrderId?: string;
      };
      const existing = getOrderById(orderId);
      if (!existing || existing.status !== 'PENDING' || existing.paymentMethod !== 'PAYPAL') {
        return res.json({ ok: true });
      }
      if (paypalOrderId && existing.paypalOrderId && existing.paypalOrderId !== paypalOrderId) {
        return res.status(403).json({ error: 'PayPal order mismatch.' });
      }
      cancelPendingOrder(existing.id);
      return res.json({ ok: true });
    }
  );

  // --- Orders Routes ---
  app.post('/api/orders/:id/order-complete', async (req, res) => {
    const user = getAuthenticatedUser(req);
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const bodyEmail =
      typeof req.body?.customerEmail === 'string'
        ? req.body.customerEmail.trim().toLowerCase()
        : '';
    const isAuthorized =
      user?.role === 'ADMIN' ||
      (user && order.userId && user.id === order.userId) ||
      (user && user.email.toLowerCase() === order.customerEmail.toLowerCase()) ||
      (!order.userId && bodyEmail && bodyEmail === order.customerEmail.toLowerCase());

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized for this order confirmation.' });
    }
    if (order.status === 'PENDING') {
      return res.status(400).json({ error: 'Order payment has not completed yet.' });
    }

    try {
      const result = await sendOrderConfirmationEmail({
        order,
        authenticatedUserId: user?.id || order.userId,
        forceResend: Boolean(req.body?.forceResend) && user?.role === 'ADMIN',
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process order confirmation email.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/orders/:id/email-log', (req, res) => {
    const user = getAuthenticatedUser(req);
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const isAuthorized =
      user?.role === 'ADMIN' ||
      (user && order.userId && user.id === order.userId) ||
      (user && user.email.toLowerCase() === order.customerEmail.toLowerCase());
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Permission required.' });
    }
    const log = getOrderEmailLog(order.id, 'order_confirmation');
    res.json({ emailLog: log });
  });

  app.get('/api/orders/:id/email-logs', (req, res) => {
    const user = getAuthenticatedUser(req);
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const isAuthorized =
      user?.role === 'ADMIN' ||
      (user && order.userId && user.id === order.userId) ||
      (user && user.email.toLowerCase() === order.customerEmail.toLowerCase());
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Permission required.' });
    }
    const emailLogs = getOrderEmailLogsForOrder(order.id);
    res.json({ emailLogs });
  });

  app.get('/api/admin/order-email-logs', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    res.json({ emailLogs: getAllOrderEmailLogs() });
  });
  app.get(
    '/api/orders/lookup',
    lookupRateLimiter,
    validateQuery(orderLookupRouteQuerySchema),
    (req, res) => {
      const user = getAuthenticatedUser(req);
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const verifyEmail =
        typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      if (!query) {
        return res.json({ order: null });
      }

    let order: Order | null = null;
    if (user?.role === 'ADMIN') {
      order = findOrderByQuery(query);
    } else if (user) {
      const exactMatch = findOrderByOrderNumber(query);
      if (exactMatch) {
        order = exactMatch;
      } else {
        const byEmailOrOrder = findOrderByQuery(query);
        if (
          byEmailOrOrder &&
          (byEmailOrOrder.userId === user.id ||
            byEmailOrOrder.customerEmail.toLowerCase() === user.email.toLowerCase())
        ) {
          order = byEmailOrOrder;
        }
      }
    } else {
      order = findOrderByOrderNumber(query);
    }

    if (!order) {
      return res.json({ order: null });
    }

    const isOwner =
      user?.role === 'ADMIN' ||
      (user &&
        (order.userId === user.id ||
          order.customerEmail.toLowerCase() === user.email.toLowerCase())) ||
      Boolean(verifyEmail && verifyEmail === order.customerEmail.toLowerCase());

    res.json({ order: isOwner ? order : redactOrderForGuest(order) });
  });

  app.get('/api/orders/:id/status', (req, res) => {
    const user = getAuthenticatedUser(req);
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const verifyEmail =
      typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const isAuthorized =
      user?.role === 'ADMIN' ||
      (user &&
        (order.userId === user.id ||
          order.customerEmail.toLowerCase() === user.email.toLowerCase())) ||
      Boolean(verifyEmail && verifyEmail === order.customerEmail.toLowerCase());

    if (!isAuthorized) {
      return res.json({
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderNumber: order.orderNumber,
      });
    }
    res.json({
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderNumber: order.orderNumber,
      order,
    });
  });

  app.get('/api/orders/:id/certificates', lookupRateLimiter, (req, res) => {
    const user = getAuthenticatedUser(req);
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const verifyEmail =
      typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const isAuthorized =
      user?.role === 'ADMIN' ||
      (user &&
        (order.userId === user.id ||
          order.customerEmail.toLowerCase() === user.email.toLowerCase())) ||
      Boolean(verifyEmail && verifyEmail === order.customerEmail.toLowerCase());

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Not authorized to access certificates for this order.',
      });
    }
    if (order.status === 'PENDING') {
      return res.status(400).json({
        error: 'Certificates are issued once payment or order confirmation is completed.',
      });
    }

    const issued = ensureCertificatesForOrder(order.id);
    res.json({
      certificates: issued.certificates,
      order: issued.order || order,
    });
  });

  app.post('/api/orders', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Orders must be placed through verified checkout or created by a studio admin.',
      });
    }
    const order = req.body as Order;
    if (!order || !order.orderNumber || !order.customerEmail) {
      return res.status(400).json({ error: 'Invalid order payload.' });
    }
    const saved = createOrder(order, user.id);
    const products = getAllProducts();
    res.status(201).json({ order: saved, products });
  });

  app.post('/api/orders/:id/refund', validateBody(orderRefundSchema), async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status === 'PENDING') {
      return res.status(400).json({ error: 'Cannot refund an unpaid pending order.' });
    }

    const alreadyRefunded = order.refundedAmountCents || 0;
    const remainingCents = Math.max(0, order.totalCents - alreadyRefunded);
    if (remainingCents <= 0) {
      return res.status(400).json({ error: 'Order has already been fully refunded.' });
    }

    const { amountCents, reason } = req.body as {
      amountCents?: number;
      reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    };
    const refundCents =
      typeof amountCents === 'number' && amountCents > 0
        ? Math.min(remainingCents, Math.round(amountCents))
        : remainingCents;

    let stripeRefundId: string | undefined;
    let paypalRefundId: string | undefined;
    const creds = getResolvedStripeCredentials();
    const paypalCreds = getResolvedPayPalCredentials();

    if (order.paymentMethod === 'PAYPAL' && order.paypalCaptureId) {
      if (!paypalCreds.clientId || !paypalCreds.clientSecret) {
        return res.status(400).json({
          error: 'PayPal API credentials are missing. Configure PayPal credentials before refunding.',
        });
      }
      try {
        const ppRefund = await refundPayPalCapture({
          creds: {
            clientId: paypalCreds.clientId,
            clientSecret: paypalCreds.clientSecret,
            mode: paypalCreds.mode,
          },
          captureId: order.paypalCaptureId,
          amountCents: refundCents,
          orderNumber: order.orderNumber,
          note: `Refund (${reason || 'requested_by_customer'}) for Order ${order.orderNumber}`,
        });
        paypalRefundId = ppRefund.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'PayPal refund failed.';
        return res.status(400).json({ error: `PayPal refund failed: ${msg}` });
      }
    } else if (
      order.stripePaymentIntentId &&
      order.stripePaymentIntentId.startsWith('pi_') &&
      !order.stripePaymentIntentId.startsWith('pi_3Pounamu') &&
      creds.secretKey
    ) {
      try {
        const stripe = new Stripe(creds.secretKey);
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: refundCents,
          reason: reason || 'requested_by_customer',
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        });
        stripeRefundId = refund.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stripe refund failed.';
        return res.status(400).json({ error: `Stripe refund failed: ${msg}` });
      }
    }

    const updated = recordOrderRefund({
      orderId: order.id,
      refundAmountCents: refundCents,
      refundId: stripeRefundId,
      paypalRefundId,
    });
    let statusNotification: OrderEmailLog | null = null;
    if (updated && updated.status !== order.status) {
      try {
        const result = await sendOrderStatusNotificationEmail({
          order: updated,
          previousStatus: order.status,
          nextStatus: updated.status,
        });
        statusNotification = result.emailLog;
      } catch (err) {
        console.error('Failed to send refund status email:', err);
      }
    }
    res.json({ order: updated, statusNotification });
  });

  app.patch('/api/orders/:id', validateBody(orderPatchAdminSchema), async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const existing = getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const body = req.body as Partial<Order>;
    const nextTracking =
      typeof body.trackingNumber === 'string'
        ? body.trackingNumber.trim() || undefined
        : existing.trackingNumber;
    const nextStatus = body.status ?? existing.status;
    const nextShippedAt =
      nextStatus === 'SHIPPED'
        ? body.shippedAt || existing.shippedAt || new Date().toISOString()
        : body.shippedAt ?? existing.shippedAt;
    const nextDeliveredAt =
      nextStatus === 'DELIVERED'
        ? body.deliveredAt || existing.deliveredAt || new Date().toISOString()
        : body.deliveredAt ?? existing.deliveredAt;

    const nextPaymentStatus =
      body.paymentStatus ??
      (nextStatus === 'DELIVERED' && existing.paymentMethod === 'CASH_ON_PICKUP'
        ? 'PAID'
        : nextStatus === 'REFUNDED'
        ? 'REFUNDED'
        : existing.paymentStatus);

    const merged: Order = {
      ...existing,
      ...body,
      id: existing.id,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      trackingNumber: nextTracking,
      shippedAt: nextShippedAt,
      deliveredAt: nextDeliveredAt,
      actualCourierCostCents:
        typeof body.actualCourierCostCents === 'number' &&
        Number.isFinite(body.actualCourierCostCents) &&
        body.actualCourierCostCents >= 0
          ? Math.round(body.actualCourierCostCents)
          : existing.actualCourierCostCents,
    };

    const saved = updateOrder(merged);
    let statusNotification: OrderEmailLog | null = null;
    if (saved.status !== existing.status) {
      try {
        const result = await sendOrderStatusNotificationEmail({
          order: saved,
          previousStatus: existing.status,
          nextStatus: saved.status,
        });
        statusNotification = result.emailLog;
      } catch (err) {
        console.error('Failed to send order status notification email:', err);
      }
    }
    res.json({ order: saved, statusNotification });
  });

  app.patch('/api/orders/:id/tracking', validateBody(orderTrackingUpdateSchema), async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const existing = getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const body = req.body as {
      trackingNumber: string;
      actualCourierCostCents?: number;
      courierName?: string;
      courierServiceName?: string;
      status?: Order['status'];
    };
    const cleanedTracking = body.trackingNumber.trim();
    const nextStatus =
      body.status ||
      (existing.status === 'PAID' || existing.status === 'PROCESSING' || existing.status === 'FULFILLING'
        ? 'SHIPPED'
        : existing.status);
    const updated: Order = {
      ...existing,
      status: nextStatus,
      trackingNumber: cleanedTracking,
      courierName: body.courierName?.trim() || existing.courierName,
      courierServiceName: body.courierServiceName?.trim() || existing.courierServiceName,
      shippedAt: existing.shippedAt || new Date().toISOString(),
      actualCourierCostCents:
        typeof body.actualCourierCostCents === 'number' &&
        Number.isFinite(body.actualCourierCostCents) &&
        body.actualCourierCostCents >= 0
          ? Math.round(body.actualCourierCostCents)
          : existing.actualCourierCostCents,
    };
    const saved = updateOrder(updated);
    let statusNotification: OrderEmailLog | null = null;
    if (saved.status !== existing.status) {
      try {
        const result = await sendOrderStatusNotificationEmail({
          order: saved,
          previousStatus: existing.status,
          nextStatus: saved.status,
        });
        statusNotification = result.emailLog;
      } catch (err) {
        console.error('Failed to send tracking status notification email:', err);
      }
    }
    res.json({ order: saved, statusNotification });
  });

  // --- Products Routes ---
  app.post('/api/products', validateBody(productPayloadSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const rawProduct = req.body as Product;
    const generatedId = rawProduct.id || `prod-${crypto.randomUUID().slice(0, 8)}`;
    const generatedSlug =
      rawProduct.slug ||
      rawProduct.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      generatedId;
    const newProduct: Product = {
      ...rawProduct,
      id: generatedId,
      slug: generatedSlug,
      sku: rawProduct.sku || `SKU-${generatedId.toUpperCase()}`,
    };
    const saved = addProduct(newProduct);
    refreshPublicSitemap();
    res.status(201).json({ product: saved });
  });

  app.put('/api/products/:id', validateBody(productPayloadSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const updatedProduct = req.body as Product;
    const saved = updateProduct({ ...updatedProduct, id: req.params.id });
    if (!saved) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    refreshPublicSitemap();
    res.json({ product: saved });
  });

  app.delete('/api/products/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const deleted = deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    refreshPublicSitemap();
    res.json({ ok: true, id: req.params.id });
  });

  // --- Gallery Archive Routes ---
  app.post('/api/gallery', validateBody(galleryItemSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const body = req.body as Partial<GalleryItem>;
    const item: GalleryItem = {
      id: body.id || `gal-${crypto.randomUUID().slice(0, 8)}`,
      title: (body.title || '').trim(),
      material: body.material || 'Kawakawa',
      designType: body.designType || 'Toki',
      originRiver: body.originRiver?.trim() || 'West Coast, Te Wai Pounamu',
      authenticityCode: body.authenticityCode?.trim() || 'ARCHIVE',
      dimensions: body.dimensions?.trim() || '60mm × 26mm × 8mm',
      description:
        body.description?.trim() ||
        `Past heirloom ${body.material} ${body.designType} carved by Jesse.`,
      storyNote: body.storyNote?.trim() || undefined,
      imageUrl: body.imageUrl?.trim() || '/src/assets/images/product_toki_pounamu_1794468031889.jpg',
      carvedYear: body.carvedYear !== undefined && body.carvedYear !== null && String(body.carvedYear).trim()
        ? String(body.carvedYear).trim()
        : String(new Date().getFullYear()),
      originalPriceCents:
        typeof body.originalPriceCents === 'number' && body.originalPriceCents > 0
          ? Math.round(body.originalPriceCents)
          : undefined,
      carverName: body.carverName?.trim() || 'Jesse',
      createdAt: body.createdAt || new Date().toISOString(),
    };
    const saved = addGalleryItem(item);
    refreshPublicSitemap();
    res.status(201).json({ galleryItem: saved, galleryItems: getGalleryItems() });
  });

  app.delete('/api/gallery/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const deleted = deleteGalleryItem(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Gallery item not found.' });
    }
    refreshPublicSitemap();
    res.json({ ok: true, id: req.params.id, galleryItems: getGalleryItems() });
  });

  // --- Authenticated User Wishlist Routes ---
  app.get('/api/wishlist', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in or create an account to view your wishlist.' });
    }
    res.json({ wishlist: getWishlistForUser(user.id) });
  });

  app.post('/api/wishlist', validateBody(wishlistPayloadSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in or create an account to save to your wishlist.' });
    }
    const body = req.body as WishlistPayloadInput;
    const result = addWishlistItem(user.id, {
      itemId: body.itemId,
      itemKind: body.itemKind === 'gallery' ? 'gallery' : 'product',
      title: body.title,
      material: body.material,
      designType: body.designType,
      priceCents: typeof body.priceCents === 'number' ? body.priceCents : undefined,
      image: body.image || '',
      authenticityCode: body.authenticityCode,
      originRiver: body.originRiver,
    });
    res.json(result);
  });

  app.post('/api/wishlist/toggle', validateBody(wishlistPayloadSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in or create an account to manage your wishlist.' });
    }
    const body = req.body as WishlistPayloadInput;
    const result = toggleWishlistItem(user.id, {
      itemId: body.itemId,
      itemKind: body.itemKind === 'gallery' ? 'gallery' : 'product',
      title: body.title,
      material: body.material,
      designType: body.designType,
      priceCents: typeof body.priceCents === 'number' ? body.priceCents : undefined,
      image: body.image || '',
      authenticityCode: body.authenticityCode,
      originRiver: body.originRiver,
    });
    res.json(result);
  });

  app.delete('/api/wishlist/:itemId', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const wishlist = removeWishlistItem(user.id, req.params.itemId);
    res.json({ wishlist });
  });

  // --- Settings & Sitemap Routes ---
  app.put('/api/settings', validateBody(siteSettingsUpdateSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const currentSettings = getSiteSettings();
    const nextSettings = { ...(req.body as SiteSettings) };
    const policyChanged =
      nextSettings.termsAndConditionsText !== currentSettings.termsAndConditionsText ||
      nextSettings.privacyPolicyText !== currentSettings.privacyPolicyText ||
      nextSettings.shippingAndReturnsPolicyText !== currentSettings.shippingAndReturnsPolicyText ||
      nextSettings.customCommissionsPolicyText !== currentSettings.customCommissionsPolicyText ||
      nextSettings.authenticityPolicyText !== currentSettings.authenticityPolicyText ||
      nextSettings.returnPolicyDays !== currentSettings.returnPolicyDays;

    if (policyChanged) {
      nextSettings.legalNoticeUpdatedAt = new Date().toISOString();
    }

    const saved = updateSiteSettings(nextSettings);
    refreshPublicSitemap();
    res.json({ settings: saved });
  });

  app.get('/api/sitemap/status', (_req, res) => {
    res.json(getSitemapStatus());
  });

  app.post('/api/sitemap/regenerate', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const summary = writePublicSitemap();
    res.json({
      ok: true,
      baseUrl: summary.baseUrl,
      totalUrls: summary.totalUrls,
      staticPageCount: summary.staticPageCount,
      publishedProductCount: summary.publishedProductCount,
      activeProductCount: summary.activeProductCount,
      galleryItemCount: summary.galleryItemCount,
      retiredArchiveCount: summary.retiredArchiveCount,
      generatedAt: new Date().toISOString(),
      scheduler: getSitemapStatus(),
    });
  });

  app.get('/api/admin/seo-audit', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    res.json({ pageSeoMetadata: getAllPageSeoMetadata() });
  });

  app.put('/api/admin/seo-audit', validateBody(pageSeoAuditEntrySchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const body = req.body as {
      pageKey: string;
      seoTitle: string;
      metaDescription: string;
      keywords: string;
    };
    const entry = upsertPageSeoMetadata({
      pageKey: body.pageKey,
      seoTitle: body.seoTitle ?? '',
      metaDescription: body.metaDescription ?? '',
      keywords: body.keywords ?? '',
    });
    const settings = getSiteSettings();
    const pageSeoMetadata = getAllPageSeoMetadata();
    res.json({ entry, settings, pageSeoMetadata });
  });

  app.delete('/api/admin/seo-audit', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey : '';
    if (!pageKey.trim()) {
      return res.status(400).json({ error: 'pageKey query parameter is required.' });
    }
    deletePageSeoMetadata(pageKey);
    res.json({ pageSeoMetadata: getAllPageSeoMetadata() });
  });

  // --- Couriers, Rates, Discounts & Custom Pricing Routes ---
  app.put('/api/couriers/:id', validateBody(courierUpdateSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const courier = req.body as Courier;
    const couriers = updateCourier({ ...courier, id: req.params.id });
    res.json({ couriers });
  });

  app.patch('/api/rates/:id', validateBody(courierRatePatchSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const { priceCents } = req.body as { priceCents: number };
    const rates = updateCourierRate(req.params.id, priceCents);
    res.json({ rates });
  });

  app.post('/api/rates/bulk-raise', validateBody(bulkRaiseRatesSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const { percent } = req.body as { percent: number };
    const rates = bulkRaiseCourierRates(percent);
    res.json({ rates });
  });

  app.post('/api/discounts', validateBody(discountRuleSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const rule = req.body as DiscountRule;
    const discounts = upsertDiscount(rule);
    res.json({ discounts });
  });

  app.delete('/api/discounts/:code', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const discounts = deleteDiscount(req.params.code);
    res.json({ discounts });
  });

  // --- Digital Gift Card Routes ---
  app.get(
    '/api/gift-cards/validate',
    giftCardRateLimiter,
    validateQuery(giftCardValidateRouteQuerySchema),
    (req, res) => {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const result = validateGiftCardForCheckout(code);
      res.json(result);
    }
  );

  app.post(
    '/api/gift-cards/purchase-stripe',
    validateBody(giftCardPurchaseSchema),
    async (req, res) => {
      const settings = getSiteSettings();
      const creds = getResolvedStripeCredentials();
      if (!settings.stripeEnabled) {
        return res.status(400).json({
          code: 'STRIPE_DISABLED',
          error: 'Online card checkout is currently paused by the studio administrator.',
        });
      }
      if (!creds.publishableKey || !creds.secretKey) {
        return res.status(400).json({
          code: 'STRIPE_NOT_CONFIGURED',
          error:
            'Stripe API keys are not configured yet. Please select Cash on Pickup or ask the studio administrator to enter Stripe keys.',
        });
      }

      const {
        amountCents,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
      } = req.body as {
        amountCents: number;
        purchaserName: string;
        purchaserEmail: string;
        recipientName: string;
        recipientEmail: string;
        message: string;
      };

      const cleanAmount = Math.round(Number(amountCents));

      const pendingCard = createGiftCardRecord({
        amountCents: cleanAmount,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
        purchasePaymentMethod: 'STRIPE',
        purchaseStatus: 'PENDING',
        isActive: false,
      });

      try {
        const stripe = new Stripe(creds.secretKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: cleanAmount,
          currency: 'nzd',
          automatic_payment_methods: { enabled: true },
          receipt_email: purchaserEmail.trim(),
          description: `${settings.siteName} Digital Gift Card (${pendingCard.orderNumber})`,
          metadata: {
            kind: 'gift_card',
            giftCardId: pendingCard.id,
            giftCardCode: pendingCard.code,
            orderNumber: pendingCard.orderNumber,
          },
        });

        const updatedCard =
          attachStripePaymentIntentToGiftCard(pendingCard.id, paymentIntent.id) || pendingCard;

        res.status(201).json({
          giftCard: updatedCard,
          clientSecret: paymentIntent.client_secret,
          publishableKey: creds.publishableKey,
        });
      } catch (err) {
        deleteGiftCard(pendingCard.id);
        const msg = err instanceof Error ? err.message : 'Unable to start Stripe gift card checkout.';
        res.status(400).json({ error: `Stripe initialization failed: ${msg}` });
      }
    }
  );

  app.post(
    '/api/gift-cards/confirm-stripe',
    validateBody(giftCardConfirmStripeSchema),
    async (req, res) => {
      const { giftCardId, paymentIntentId } = req.body as {
        giftCardId: string;
        paymentIntentId: string;
      };

    const existing = getGiftCardById(giftCardId);
    if (!existing) {
      return res.status(404).json({ error: 'Gift card not found.' });
    }
    if (existing.purchaseStatus === 'ACTIVE' && existing.isActive) {
      return res.json({ status: 'ACTIVE', giftCard: existing });
    }

    const creds = getResolvedStripeCredentials();
    if (!creds.secretKey) {
      return res.status(400).json({ error: 'Stripe secret key missing.' });
    }

    try {
      const stripe = new Stripe(creds.secretKey);
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.metadata?.giftCardId && pi.metadata.giftCardId !== existing.id) {
        return res.status(403).json({ error: 'PaymentIntent does not match this gift card.' });
      }
      if (pi.status === 'succeeded') {
        const activated = activateGiftCardAtomic({
          giftCardId: existing.id,
          paymentIntentId: pi.id,
        });
        let emailLog = null;
        if (activated.giftCard && activated.newlyActivated) {
          const emailRes = await sendGiftCardDeliveryEmail(activated.giftCard).catch(() => null);
          emailLog = emailRes?.emailLog || null;
        }
        return res.json({
          status: activated.giftCard?.purchaseStatus || 'ACTIVE',
          giftCard: activated.giftCard || existing,
          emailLog,
        });
      }
      return res.json({ status: existing.purchaseStatus, stripeStatus: pi.status, giftCard: existing });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify Stripe gift card payment.';
      res.status(400).json({ error: msg });
    }
  });

  app.post(
    '/api/gift-cards/purchase-paypal',
    validateBody(giftCardPurchaseSchema),
    async (req, res) => {
      const settings = getSiteSettings();
      const creds = getResolvedPayPalCredentials();
      if (settings.paypalEnabled === false) {
        return res.status(400).json({
          code: 'PAYPAL_DISABLED',
          error: 'PayPal checkout is currently paused by the studio administrator.',
        });
      }
      if (!creds.clientId || !creds.clientSecret) {
        return res.status(400).json({
          code: 'PAYPAL_NOT_CONFIGURED',
          error:
            'PayPal API credentials are not configured yet. Please select another payment method or enter PayPal keys in Admin Payment Settings.',
        });
      }

      const {
        amountCents,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
      } = req.body as {
        amountCents: number;
        purchaserName: string;
        purchaserEmail: string;
        recipientName: string;
        recipientEmail: string;
        message: string;
      };

      const cleanAmount = Math.round(Number(amountCents));
      const pendingCard = createGiftCardRecord({
        amountCents: cleanAmount,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
        purchasePaymentMethod: 'PAYPAL',
        purchaseStatus: 'PENDING',
        isActive: false,
      });

      try {
        const ppOrder = await createPayPalOrder({
          creds: {
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            mode: creds.mode,
          },
          totalCents: cleanAmount,
          orderId: pendingCard.id,
          orderNumber: pendingCard.orderNumber,
          description: `${settings.siteName} Digital Gift Card (${pendingCard.orderNumber})`,
          brandName: settings.siteName,
        });

        const updatedCard = attachPayPalOrderToGiftCard(pendingCard.id, ppOrder.id) || pendingCard;
        res.status(201).json({
          giftCard: updatedCard,
          paypalOrderId: ppOrder.id,
          clientId: creds.clientId,
          mode: creds.mode,
        });
      } catch (err) {
        deleteGiftCard(pendingCard.id);
        const msg = err instanceof Error ? err.message : 'Unable to start PayPal gift card checkout.';
        res.status(400).json({ error: `PayPal initialization failed: ${msg}` });
      }
    }
  );

  app.post(
    '/api/gift-cards/confirm-paypal',
    validateBody(giftCardConfirmPayPalSchema),
    async (req, res) => {
      const { giftCardId, paypalOrderId } = req.body as {
        giftCardId: string;
        paypalOrderId: string;
      };

      const existing = getGiftCardById(giftCardId);
      if (!existing) {
        return res.status(404).json({ error: 'Gift card not found.' });
      }
      if (existing.paypalOrderId && existing.paypalOrderId !== paypalOrderId) {
        return res.status(403).json({ error: 'PayPal Order ID does not match this gift card.' });
      }
      if (existing.purchaseStatus === 'ACTIVE' && existing.isActive) {
        return res.json({ status: 'ACTIVE', giftCard: existing });
      }

      const creds = getResolvedPayPalCredentials();
      if (!creds.clientId || !creds.clientSecret) {
        return res.status(400).json({ error: 'PayPal credentials missing on server.' });
      }

      try {
        let captureResult;
        try {
          captureResult = await capturePayPalOrder({
            creds: {
              clientId: creds.clientId,
              clientSecret: creds.clientSecret,
              mode: creds.mode,
            },
            paypalOrderId,
          });
        } catch (capErr) {
          const existingDetails = await getPayPalOrderDetails({
            creds: {
              clientId: creds.clientId,
              clientSecret: creds.clientSecret,
              mode: creds.mode,
            },
            paypalOrderId,
          });
          if (existingDetails && existingDetails.captureStatus === 'COMPLETED') {
            captureResult = existingDetails;
          } else {
            throw capErr;
          }
        }

        if (
          captureResult.captureStatus !== 'COMPLETED' &&
          captureResult.orderStatus !== 'COMPLETED'
        ) {
          return res.status(400).json({
            error: `PayPal gift card payment not completed (${captureResult.captureStatus || captureResult.orderStatus}).`,
          });
        }

        if (
          captureResult.capturedCents !== null &&
          captureResult.capturedCents !== existing.initialAmountCents
        ) {
          return res.status(400).json({ error: 'Captured PayPal gift card amount mismatch.' });
        }

        const activated = activateGiftCardAtomic({
          giftCardId: existing.id,
          paypalOrderId: captureResult.paypalOrderId,
          paypalCaptureId: captureResult.captureId,
        });

        let emailLog = null;
        if (activated.giftCard && activated.newlyActivated) {
          const emailRes = await sendGiftCardDeliveryEmail(activated.giftCard).catch(() => null);
          emailLog = emailRes?.emailLog || null;
        }

        return res.json({
          status: activated.giftCard?.purchaseStatus || 'ACTIVE',
          giftCard: activated.giftCard || existing,
          emailLog,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to verify PayPal gift card payment.';
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    '/api/gift-cards/purchase-pickup',
    validateBody(giftCardPurchaseSchema),
    (req, res) => {
      const settings = getSiteSettings();
      if (settings.cashOnPickupEnabled === false) {
        return res.status(400).json({
          error: 'Cash on Pickup is currently paused by the studio administrator.',
        });
      }

      const {
        amountCents,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
      } = req.body as {
        amountCents: number;
        purchaserName: string;
        purchaserEmail: string;
        recipientName: string;
        recipientEmail: string;
        message: string;
      };

      const cleanAmount = Math.round(Number(amountCents));

      const pendingPickupCard = createGiftCardRecord({
        amountCents: cleanAmount,
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        message,
        purchasePaymentMethod: 'CASH_ON_PICKUP',
        purchaseStatus: 'PENDING',
        isActive: false,
      });

      res.status(201).json({ giftCard: pendingPickupCard });
    }
  );

  app.get('/api/admin/gift-cards', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    res.json({
      giftCards: getAllGiftCards(),
      redemptions: getGiftCardRedemptions(),
    });
  });

  app.post('/api/admin/gift-cards', validateBody(adminGiftCardCreateSchema), async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    const {
      amountCents,
      code,
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      message,
      expiresAt,
      sendEmail = true,
    } = req.body as {
      amountCents: number;
      code?: string;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName: string;
      recipientEmail: string;
      message?: string;
      expiresAt?: string;
      sendEmail?: boolean;
    };

    const cleanAmount = Math.round(Number(amountCents));

    const giftCard = createGiftCardRecord({
      amountCents: cleanAmount,
      code,
      purchaserName: purchaserName?.trim() || `${user.firstName} ${user.lastName}`.trim() || 'Pounamu Atelier',
      purchaserEmail: purchaserEmail?.trim() || user.email,
      recipientName,
      recipientEmail,
      message,
      purchasePaymentMethod: 'ADMIN_ISSUED',
      purchaseStatus: 'ACTIVE',
      isActive: true,
      expiresAt,
    });

    let emailLog = null;
    if (sendEmail) {
      const emailRes = await sendGiftCardDeliveryEmail(giftCard).catch(() => null);
      emailLog = emailRes?.emailLog || null;
    }

    res.status(201).json({
      giftCard,
      giftCards: getAllGiftCards(),
      emailLog,
    });
  });

  app.patch('/api/admin/gift-cards/:id', validateBody(adminGiftCardPatchSchema), async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const existing = getGiftCardById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Gift card not found.' });
    }

    const patch = req.body as {
      isActive?: boolean;
      purchaseStatus?: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REDEEMED';
      remainingBalanceCents?: number;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
      expiresAt?: string | null;
      activateAndEmail?: boolean;
    };

    const updated = updateGiftCardAdmin(existing.id, {
      isActive: patch.activateAndEmail ? true : patch.isActive,
      purchaseStatus: patch.activateAndEmail ? 'ACTIVE' : patch.purchaseStatus,
      remainingBalanceCents: patch.remainingBalanceCents,
      recipientName: patch.recipientName,
      recipientEmail: patch.recipientEmail,
      message: patch.message,
      expiresAt: patch.expiresAt,
    });

    let emailLog = null;
    if (updated && existing.purchaseStatus === 'PENDING' && updated.purchaseStatus === 'ACTIVE') {
      const emailRes = await sendGiftCardDeliveryEmail(updated).catch(() => null);
      emailLog = emailRes?.emailLog || null;
    }

    res.json({
      giftCard: updated,
      giftCards: getAllGiftCards(),
      emailLog,
    });
  });

  app.delete('/api/admin/gift-cards/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const deleted = deleteGiftCard(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Gift card not found.' });
    }
    res.json({ ok: true, giftCards: getAllGiftCards() });
  });

  app.put('/api/custom-pricing', validateBody(customPricingConfigSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const nextConfig = req.body as CustomPricingConfig;
    const customPricing = updateCustomPricing(nextConfig);
    res.json({ customPricing });
  });

  // --- Custom Commissions Routes ---
  app.get(
    '/api/commissions/lookup',
    lookupRateLimiter,
    validateQuery(commissionLookupRouteQuerySchema),
    (req, res) => {
      const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
      const email = typeof req.query.email === 'string' ? req.query.email : '';
      const commission = findCommissionByRefAndEmail(ref, email);
      res.json({ commission });
    }
  );

  app.post(
    '/api/commissions',
    commissionRateLimiter,
    validateBody(commissionCreateSchema),
    (req, res) => {
      const user = getAuthenticatedUser(req);
      const body = req.body as CustomCommission & {
        mode?: 'configurator' | 'direct-quote';
        includePauaEye?: boolean;
        includeHardwoodBox?: boolean;
      };

      const customPricing = getCustomPricing();
      const isConfigurator = body.mode === 'configurator';
      const authoritativeCents = isConfigurator
        ? calculateCustomPieceCents(customPricing, {
            material: body.material,
            design: body.designType,
            sizeMm: Number(body.pendantSizeMm) || 65,
            includePauaEye: Boolean(body.includePauaEye),
            includeHardwoodBox: Boolean(body.includeHardwoodBox),
          })
        : undefined;

      const commission: CustomCommission = {
        id: body.id || `comm-${crypto.randomUUID().slice(0, 8)}`,
        referenceNumber:
          body.referenceNumber ||
          `CC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail.trim(),
        customerPhone: body.customerPhone?.trim() || '',
        material: body.material,
        designType: body.designType,
        pendantSizeMm: Number(body.pendantSizeMm) || 65,
        cordStyle: body.cordStyle || 'Traditional 4-Plait Black Waxed Cord',
        bindingStyle: body.bindingStyle || 'Traditional Cross-Lash with Bone Toggle',
        specialNotes: body.specialNotes?.trim() || '',
        budgetRange:
          body.budgetRange ||
          (authoritativeCents ? `$${(authoritativeCents / 100).toFixed(2)} NZD` : 'Quote requested'),
        referenceImageUrl: body.referenceImageUrl,
        status: 'REQUESTED',
        ...(authoritativeCents !== undefined
          ? {
              quoteAmountCents: authoritativeCents,
              depositAmountCents: Math.round(authoritativeCents * 0.5),
              leadTimeWeeks: 3,
            }
          : {}),
        messages: Array.isArray(body.messages) ? body.messages : [],
        createdAt: body.createdAt || new Date().toISOString(),
      };

      const saved = createCommission(commission, user?.id);
      res.status(201).json({ commission: saved });
    }
  );

  app.post('/api/commissions/:id/messages', validateBody(commissionMessageSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    const { text, sender, customerEmail, email } = req.body as {
      text: string;
      sender?: 'customer' | 'carver';
      customerEmail?: string;
      email?: string;
    };
    const target = getCommissionById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Commission not found.' });
    }
    const bodyEmail = (customerEmail ?? email ?? '').trim().toLowerCase();
    const isOwner =
      user?.role === 'ADMIN' ||
      (user && user.email.toLowerCase() === target.customerEmail.toLowerCase()) ||
      Boolean(bodyEmail && bodyEmail === target.customerEmail.toLowerCase());
    if (!isOwner) {
      return res
        .status(403)
        .json({ error: 'Permission required to post messages on this commission.' });
    }
    const resolvedSender = user?.role === 'ADMIN' && sender === 'carver' ? 'carver' : 'customer';
    const updated: CustomCommission = {
      ...target,
      messages: [
        ...target.messages,
        {
          id: `msg-${Date.now()}`,
          sender: resolvedSender,
          senderName: resolvedSender === 'carver' ? 'Jesse' : target.customerName,
          text: text.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const saved = updateCommission(updated);
    res.json({ commission: saved });
  });

  app.post('/api/commissions/:id/accept', validateBody(commissionAcceptSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    const target = getCommissionById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Commission not found.' });
    }
    const bodyEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const isOwner =
      user?.role === 'ADMIN' ||
      (user && user.email.toLowerCase() === target.customerEmail.toLowerCase()) ||
      (bodyEmail && bodyEmail === target.customerEmail.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({ error: 'Permission required to accept this quote.' });
    }

    const updated: CustomCommission = {
      ...target,
      status: 'ACCEPTED',
    };
    const saved = updateCommission(updated);
    res.json({ commission: saved });
  });

  app.patch('/api/commissions/:id', validateBody(commissionAdminUpdateSchema), (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const target = getCommissionById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Commission not found.' });
    }
    const { status, quoteAmountCents, depositAmountCents, leadTimeWeeks } = req.body as {
      status?: CustomCommission['status'];
      quoteAmountCents?: number;
      depositAmountCents?: number;
      leadTimeWeeks?: number;
    };

    const nextQuote =
      typeof quoteAmountCents === 'number' && quoteAmountCents >= 0
        ? Math.round(quoteAmountCents)
        : target.quoteAmountCents;

    const nextDeposit =
      typeof depositAmountCents === 'number' && depositAmountCents >= 0
        ? Math.round(depositAmountCents)
        : typeof nextQuote === 'number'
        ? Math.round(nextQuote * 0.5)
        : target.depositAmountCents;

    const updated: CustomCommission = {
      ...target,
      status: status ?? target.status,
      quoteAmountCents: nextQuote,
      depositAmountCents: nextDeposit,
      leadTimeWeeks:
        typeof leadTimeWeeks === 'number' && leadTimeWeeks > 0
          ? Math.round(leadTimeWeeks)
          : target.leadTimeWeeks,
    };

    const saved = updateCommission(updated);
    res.json({ commission: saved });
  });

  app.patch(
    '/api/commissions/:id/status',
    validateBody(commissionStatusUpdateSchema),
    (req, res) => {
      const user = getAuthenticatedUser(req);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin permission required.' });
      }
      const { status } = req.body as { status: CustomCommission['status'] };
      const target = getCommissionById(req.params.id);
      if (!target) {
        return res.status(404).json({ error: 'Commission not found.' });
      }
      const saved = updateCommission({ ...target, status });
      res.json({ commission: saved });
    }
  );

  // --- AI Search Discovery & Agentic Commerce Endpoints ---
  const agentCartRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'agentcart' });

  app.get(['/api/agent/catalog', '/api/catalog/search'], validateQuery(agentCatalogQuerySchema), (req, res) => {
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const materialFilter =
      typeof req.query.material === 'string' ? req.query.material.trim().toLowerCase() : '';
    const designFilter =
      typeof req.query.design === 'string' ? req.query.design.trim().toLowerCase() : '';
    const inStockOnly =
      req.query.inStock === 'true' || req.query.inStock === '1';
    const inStockFalse =
      req.query.inStock === 'false' || req.query.inStock === '0';
    const maxPriceCents =
      typeof req.query.maxPriceNzd === 'number' && Number.isFinite(req.query.maxPriceNzd)
        ? Math.round(req.query.maxPriceNzd * 100)
        : undefined;
    const limit = typeof req.query.limit === 'number' ? req.query.limit : 50;

    const publicProducts = getVisibleProductsForUser(null);
    const filtered = publicProducts
      .filter((p) => {
        const available = p.isMadeToOrder || p.quantity > 0;
        if (inStockOnly && !available) return false;
        if (inStockFalse && available) return false;
        if (
          materialFilter &&
          materialFilter !== 'all' &&
          !p.material.toLowerCase().includes(materialFilter)
        ) {
          return false;
        }
        if (
          designFilter &&
          designFilter !== 'all' &&
          !p.designType.toLowerCase().includes(designFilter)
        ) {
          return false;
        }
        if (typeof maxPriceCents === 'number' && p.priceCents > maxPriceCents) {
          return false;
        }
        if (q) {
          const haystack = [
            p.id,
            p.sku,
            p.title,
            p.material,
            p.designType,
            p.originRiver,
            p.authenticityCode,
            p.description,
            p.spiritualMeaning,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .slice(0, limit)
      .map((p) => toPublicAgentProduct(p, origin));

    res.json({
      store: {
        name: settings.siteName,
        tagline: settings.tagline,
        workshopAddress: settings.workshopAddress,
        currency: 'NZD',
        gstIncluded: true,
        gstRatePercent: 15,
        stripeEnabled: settings.stripeEnabled ?? true,
        paypalEnabled: settings.paypalEnabled ?? true,
        cashOnPickupEnabled: settings.cashOnPickupEnabled ?? true,
      },
      agentActions: {
        createCartEndpoint: `${origin}/api/agent/cart`,
        shippingOptionsEndpoint: `${origin}/api/agent/shipping-options`,
        deepLinkAddTemplate: `${origin}/?add={productId}&qty=1&cart=1`,
        deepLinkCheckoutTemplate: `${origin}/?add={productId}&qty=1&checkout=1`,
      },
      totalCount: filtered.length,
      products: filtered,
    });
  });

  app.get('/api/agent/shipping-options', (req, res) => {
    const settings = getSiteSettings();
    const couriers = getCouriers().filter((c) => c.isActive);
    const rates = getCourierRates();
    const allProducts = getVisibleProductsForUser(null);

    const rawProductIds =
      typeof req.query.productIds === 'string'
        ? req.query.productIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const sampleCartItems: CartItem[] = rawProductIds
      .map((pid) => allProducts.find((p) => p.id === pid))
      .filter((p): p is Product => Boolean(p))
      .map((product) => ({ product, quantity: 1 }));

    const samplePackageSize =
      sampleCartItems.length > 0 ? determinePackageSize(sampleCartItems) : 'BAG-S';
    const itemsSubtotalCents = sampleCartItems.reduce(
      (sum, item) => sum + item.product.priceCents * item.quantity,
      0
    );

    const services = couriers.flatMap((c) =>
      c.services
        .filter((s) => s.isActive)
        .map((s) => {
          const matchingRate = rates.find(
            (r) => r.courierServiceId === s.id && r.packageSizeCode === samplePackageSize
          );
          const rawCostCents = matchingRate ? matchingRate.priceCents : 0;
          const qualifiesFree =
            Boolean(s.freeOverAmountCents && s.freeOverAmountCents > 0) &&
            itemsSubtotalCents >= (s.freeOverAmountCents || 0);
          return {
            serviceId: s.id,
            courierId: c.id,
            courierName: c.name,
            serviceName: s.name,
            requiresSignature: s.requiresSignature,
            deliveryEstimateDays: s.deliveryEstimateDays,
            freeOverAmountNzd: s.freeOverAmountCents ? s.freeOverAmountCents / 100 : null,
            maxOrderValueNzd: s.maxOrderValueCents ? s.maxOrderValueCents / 100 : null,
            estimatedShippingCents: qualifiesFree ? 0 : rawCostCents,
            estimatedShippingNzd: qualifiesFree ? 0 : Number((rawCostCents / 100).toFixed(2)),
          };
        })
    );

    res.json({
      currency: 'NZD',
      originAddress: settings.workshopAddress,
      packageSizeCode: samplePackageSize,
      packageSize: PACKAGE_SIZES[samplePackageSize],
      cashOnPickupEnabled: settings.cashOnPickupEnabled ?? true,
      stripeEnabled: settings.stripeEnabled ?? true,
      paypalEnabled: settings.paypalEnabled ?? true,
      services,
      rateMatrix: rates,
    });
  });

  app.post('/api/agent/cart', agentCartRateLimiter, validateBody(agentCartCreateSchema), (req, res) => {
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    const {
      items: requestedItems,
      discountCode,
      selectedServiceId,
      paymentMethod = 'STRIPE',
      notes,
    } = req.body as {
      items: { productId: string; quantity: number }[];
      discountCode?: string;
      selectedServiceId?: string;
      paymentMethod?: 'STRIPE' | 'PAYPAL' | 'CASH_ON_PICKUP';
      notes?: string;
    };

    if (paymentMethod === 'CASH_ON_PICKUP' && settings.cashOnPickupEnabled === false) {
      return res.status(400).json({ error: 'Cash on Pickup is currently disabled by the studio.' });
    }
    if (paymentMethod === 'PAYPAL' && settings.paypalEnabled === false) {
      return res.status(400).json({ error: 'PayPal checkout is currently disabled by the studio.' });
    }

    const allProducts = getVisibleProductsForUser(null);
    const mergedMap = new Map<string, number>();
    for (const line of requestedItems) {
      mergedMap.set(line.productId, (mergedMap.get(line.productId) || 0) + line.quantity);
    }

    const resolvedCartItems: CartItem[] = [];
    for (const [productId, quantity] of mergedMap.entries()) {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) {
        return res.status(400).json({
          error: `Product "${productId}" was not found or is unpublished.`,
        });
      }
      if (!product.isMadeToOrder && product.quantity <= 0) {
        return res.status(409).json({
          error: `"${product.title}" is currently sold out and unavailable for purchase.`,
        });
      }
      if (product.isUniquePiece && quantity > 1) {
        return res.status(409).json({
          error: `"${product.title}" is a 1-of-1 unique piece; maximum quantity is 1.`,
        });
      }
      if (!product.isMadeToOrder && quantity > product.quantity) {
        return res.status(409).json({
          error: `Only ${product.quantity} unit(s) available for "${product.title}".`,
        });
      }
      resolvedCartItems.push({ product, quantity });
    }

    const couriers = getCouriers().filter((c) => c.isActive);
    const allServices = couriers.flatMap((c) => c.services.filter((s) => s.isActive));
    const rates = getCourierRates();
    const activeDiscounts = getDiscounts(true);

    const summary = priceCart({
      items: resolvedCartItems,
      selectedServiceId,
      services: allServices,
      rates,
      discounts: activeDiscounts,
      discountCode,
      paymentMethod,
    });

    const session = createAgentCartSession({
      items: resolvedCartItems.map((ci) => ({
        productId: ci.product.id,
        quantity: ci.quantity,
      })),
      discountCode: summary.appliedDiscount?.code || discountCode,
      selectedServiceId: summary.selectedService?.id || selectedServiceId,
      paymentMethod,
      notes,
    });

    const itemsQuery = resolvedCartItems
      .map((ci) => `${encodeURIComponent(ci.product.id)}:${ci.quantity}`)
      .join(',');

    res.status(201).json({
      agentCartId: session.id,
      expiresAt: session.expiresAt,
      cartUrl: `${origin}/?agentCart=${encodeURIComponent(session.id)}&cart=1`,
      checkoutUrl: `${origin}/?agentCart=${encodeURIComponent(session.id)}&checkout=1`,
      directItemsCheckoutUrl: `${origin}/?items=${itemsQuery}&checkout=1`,
      items: resolvedCartItems.map((ci) => ({
        ...toPublicAgentProduct(ci.product, origin),
        quantity: ci.quantity,
        lineTotalCents: ci.product.priceCents * ci.quantity,
        lineTotalNzd: Number(((ci.product.priceCents * ci.quantity) / 100).toFixed(2)),
      })),
      pricing: {
        currency: 'NZD',
        gstIncluded: true,
        itemsTotalCents: summary.itemsTotalCents,
        discountCents: summary.discountCents,
        shippingCents: summary.shippingCents,
        subtotalCents: summary.subtotalCents,
        gstCents: summary.gstCents,
        totalCents: summary.totalCents,
        totalNzd: Number((summary.totalCents / 100).toFixed(2)),
        packageSize: summary.packageSize,
        selectedServiceId: summary.selectedService?.id || null,
        selectedServiceName: summary.selectedService?.name || null,
        appliedDiscountCode: summary.appliedDiscount?.code || null,
        discountError: summary.discountError || null,
        paymentMethod,
      },
      checkoutHandoffInstructions:
        'Present checkoutUrl to the user so they can enter delivery details and complete payment securely via Stripe Elements (SAQ A), PayPal, or Cash on Pickup.',
    });
  });

  app.get('/api/agent/cart/:id', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const session = getAgentCartSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Agent cart session not found or expired.' });
    }

    const allProducts = getVisibleProductsForUser(null);
    const cartItems: CartItem[] = [];
    const unavailableItems: { productId: string; reason: string }[] = [];

    for (const line of session.items) {
      const product = allProducts.find((p) => p.id === line.productId);
      if (!product) {
        unavailableItems.push({ productId: line.productId, reason: 'Product no longer available.' });
        continue;
      }
      if (!product.isMadeToOrder && product.quantity <= 0) {
        unavailableItems.push({ productId: line.productId, reason: `"${product.title}" is now sold out.` });
        continue;
      }
      const clampedQty = product.isUniquePiece
        ? 1
        : product.isMadeToOrder
        ? line.quantity
        : Math.min(line.quantity, product.quantity);
      cartItems.push({ product, quantity: clampedQty });
    }

    const couriers = getCouriers().filter((c) => c.isActive);
    const allServices = couriers.flatMap((c) => c.services.filter((s) => s.isActive));
    const rates = getCourierRates();
    const activeDiscounts = getDiscounts(true);

    const summary = priceCart({
      items: cartItems,
      selectedServiceId: session.selectedServiceId || undefined,
      services: allServices,
      rates,
      discounts: activeDiscounts,
      discountCode: session.discountCode || undefined,
      paymentMethod: session.paymentMethod,
    });

    res.json({
      agentCart: session,
      cartItems,
      unavailableItems,
      cartUrl: `${origin}/?agentCart=${encodeURIComponent(session.id)}&cart=1`,
      checkoutUrl: `${origin}/?agentCart=${encodeURIComponent(session.id)}&checkout=1`,
      pricing: {
        currency: 'NZD',
        itemsTotalCents: summary.itemsTotalCents,
        discountCents: summary.discountCents,
        shippingCents: summary.shippingCents,
        subtotalCents: summary.subtotalCents,
        gstCents: summary.gstCents,
        totalCents: summary.totalCents,
        totalNzd: Number((summary.totalCents / 100).toFixed(2)),
        packageSize: summary.packageSize,
        selectedServiceId: summary.selectedService?.id || null,
        appliedDiscountCode: summary.appliedDiscount?.code || null,
      },
    });
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    const allow = settings.allowSearchIndexing !== false;
    const body = allow
      ? [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/admin/',
          'Disallow: /?tab=dashboard',
          '',
          '# Explicit AI Search & Shopping Agent Access',
          'User-agent: OAI-SearchBot',
          'Allow: /',
          '',
          'User-agent: ChatGPT-User',
          'Allow: /',
          '',
          'User-agent: GPTBot',
          'Allow: /',
          '',
          'User-agent: PerplexityBot',
          'Allow: /',
          '',
          'User-agent: ClaudeBot',
          'Allow: /',
          '',
          'User-agent: Claude-User',
          'Allow: /',
          '',
          'User-agent: Google-Extended',
          'Allow: /',
          '',
          `Sitemap: ${origin}/sitemap.xml`,
          `# AI Agent Store Guide: ${origin}/llms.txt`,
          `# OpenAPI Schema: ${origin}/api/openapi.json`,
          '',
        ].join('\n')
      : ['User-agent: *', 'Disallow: /', ''].join('\n');

    res.type('text/plain; charset=utf-8').send(body);
  });

  app.get(['/llms.txt', '/llms-full.txt'], (req, res) => {
    const isFull = req.path === '/llms-full.txt';
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    const publicProducts = getVisibleProductsForUser(null).filter(
      (p) => p.isMadeToOrder || p.quantity > 0
    );
    const couriers = getCouriers().filter((c) => c.isActive);
    const services = couriers.flatMap((c) =>
      c.services.filter((s) => s.isActive).map((s) => ({ courier: c.name, service: s }))
    );

    const lines: string[] = [
      `# ${settings.siteName}`,
      '',
      `> ${settings.tagline || 'Hand-carved authentic New Zealand Pounamu taonga by Jesse in Napier, Hawke’s Bay.'}`,
      '',
      `- Workshop Address: ${settings.workshopAddress}`,
      `- Contact Email: ${settings.contactEmail}`,
      `- Currency: NZD (All prices include 15% New Zealand GST)`,
      `- Provenance: Certified Ngāi Tahu Pounamu traceability codes & carved origin records`,
      `- Sitemap: ${origin}/sitemap.xml`,
      `- OpenAPI Tool Spec: ${origin}/api/openapi.json`,
      '',
      '## AI Agent & Browser Checkout URLs',
      '',
      `- Live JSON Product Search: \`GET ${origin}/api/agent/catalog?q={query}&material={variety}&inStock=true\``,
      `- Live Shipping Options: \`GET ${origin}/api/agent/shipping-options\``,
      `- Create Priced Agent Cart Session: \`POST ${origin}/api/agent/cart\` (returns persistent \`checkoutUrl\` for user confirmation)`,
      `- Instant Search Link: \`${origin}/?q={search_term}\``,
      `- Direct Add-to-Cart Link: \`${origin}/?add={productId}&qty=1&cart=1\``,
      `- Direct Instant Checkout Handoff Link: \`${origin}/?add={productId}&qty=1&checkout=1\``,
      `- Multi-Item Checkout Link: \`${origin}/?items={id1}:{qty1},{id2}:{qty2}&checkout=1\``,
      '',
      'Note: Payments are completed by the customer via Stripe Elements (SAQ A), PayPal, or Studio Cash on Pickup on the checkout modal. AI agents should assemble the cart via `POST /api/agent/cart` or open `directCheckoutUrl` for the customer.',
      '',
      `## Available Taonga (${publicProducts.length} in stock or carved to order)`,
      '',
    ];

    for (const p of publicProducts) {
      const nzd = (p.priceCents / 100).toFixed(2);
      const stockLabel = p.isMadeToOrder
        ? 'Carved to Order'
        : p.isUniquePiece
        ? 'Unique 1-of-1 Piece (Qty 1)'
        : `${p.quantity} in stock`;
      lines.push(
        `- **${p.title}** (\`${p.id}\`, SKU: \`${p.sku}\`) — $${nzd} NZD (${stockLabel})`
      );
      lines.push(
        `  - Stone: ${p.material} | Motif: ${p.designType} | Origin: ${p.originRiver} | Auth Code: ${p.authenticityCode}`
      );
      lines.push(
        `  - View: ${origin}/?tab=store&product=${encodeURIComponent(p.id)} | Buy Now: ${origin}/?add=${encodeURIComponent(p.id)}&qty=1&checkout=1`
      );
      if (isFull) {
        lines.push(`  - Dimensions: ${p.dimensions} | Cord: ${p.cordDetails} | Carver: ${p.carverName}`);
        if (p.description) lines.push(`  - Description: ${p.description}`);
        if (p.spiritualMeaning) lines.push(`  - Meaning: ${p.spiritualMeaning}`);
      }
    }

    if (isFull) {
      lines.push('');
      lines.push('## Courier & Pickup Options');
      lines.push('');
      for (const entry of services) {
        lines.push(
          `- **${entry.courier} — ${entry.service.name}** (ID: \`${entry.service.id}\`): ETA ${entry.service.deliveryEstimateDays}${entry.service.requiresSignature ? ', Signature Required' : ''}`
        );
      }
      if (settings.cashOnPickupEnabled !== false) {
        lines.push(`- **Cash / EFTPOS on Studio Pickup** (${settings.workshopAddress}) — $0.00 NZD shipping`);
      }
    }

    res.type('text/plain; charset=utf-8').send(lines.join('\n'));
  });

  app.get('/.well-known/ai-plugin.json', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    res.json({
      schema_version: 'v1',
      name_for_human: settings.siteName,
      name_for_model: 'taonga_by_jesse_store',
      description_for_human: settings.tagline,
      description_for_model:
        'Search authentic New Zealand Pounamu (greenstone) carvings, inspect Ngai Tahu provenance & stock, calculate NZ courier shipping, assemble a cart, and generate a direct checkout URL for the customer.',
      auth: { type: 'none' },
      api: {
        type: 'openapi',
        url: `${origin}/api/openapi.json`,
      },
      logo_url: toAbsoluteSeoUrl(settings.logoUrl || settings.ogImageUrl, origin),
      contact_email: settings.contactEmail,
      legal_info_url: `${origin}/?tab=policies&doc=terms`,
    });
  });

  app.get('/api/openapi.json', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const settings = getSiteSettings();
    res.json({
      openapi: '3.1.0',
      info: {
        title: `${settings.siteName} Agentic Commerce API`,
        version: '1.0.0',
        description:
          'Machine-readable catalog search, shipping estimate, and cart-to-checkout handoff API for AI assistants acting on behalf of a customer.',
      },
      servers: [{ url: origin }],
      paths: {
        '/api/agent/catalog': {
          get: {
            operationId: 'searchTaongaCatalog',
            summary: 'Search available New Zealand Pounamu carvings and return NZD pricing + checkout deep links.',
            parameters: [
              { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text keyword (e.g. Toki, Koru, Kawakawa)' },
              { name: 'material', in: 'query', schema: { type: 'string' }, description: 'Stone variety filter (e.g. Kawakawa, Kahurangi, Inanga, Tangiwai)' },
              { name: 'design', in: 'query', schema: { type: 'string' }, description: 'Design motif filter (e.g. Toki, Koru, Roimata, Manaia)' },
              { name: 'inStock', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter to immediately purchasable pieces' },
              { name: 'maxPriceNzd', in: 'query', schema: { type: 'number' }, description: 'Maximum price in NZD' },
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            ],
            responses: {
              '200': { description: 'Matching catalog products and direct cart/checkout URLs' },
            },
          },
        },
        '/api/agent/shipping-options': {
          get: {
            operationId: 'getShippingOptions',
            summary: 'Get active NZ courier services, package size dimensions, and NZD shipping rates.',
            parameters: [
              { name: 'productIds', in: 'query', schema: { type: 'string' }, description: 'Comma-separated product IDs to calculate package size & free-shipping thresholds' },
            ],
            responses: {
              '200': { description: 'Courier services and shipping estimates' },
            },
          },
        },
        '/api/agent/cart': {
          post: {
            operationId: 'createAgentCheckoutCart',
            summary: 'Validate stock, calculate GST-inclusive NZD totals, and return a persistent checkoutUrl for the user.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['items'],
                    properties: {
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['productId', 'quantity'],
                          properties: {
                            productId: { type: 'string' },
                            quantity: { type: 'integer', minimum: 1 },
                          },
                        },
                      },
                      discountCode: { type: 'string' },
                      selectedServiceId: { type: 'string' },
                      paymentMethod: { type: 'string', enum: ['STRIPE', 'PAYPAL', 'CASH_ON_PICKUP'], default: 'STRIPE' },
                      notes: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': { description: 'Priced cart session with checkoutUrl and cartUrl for human buyer completion' },
              '400': { description: 'Validation or unknown product error' },
              '409': { description: 'Insufficient stock or 1-of-1 unique piece limit reached' },
            },
          },
        },
        '/api/agent/cart/{id}': {
          get: {
            operationId: 'getAgentCartSession',
            summary: 'Retrieve a stored AI agent cart session with live stock and NZD pricing.',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              '200': { description: 'Hydrated agent cart session and live totals' },
              '404': { description: 'Session not found or expired' },
            },
          },
        },
      },
    });
  });

  // --- Search Engine Sitemap (/sitemap.xml) ---
  app.get('/sitemap.xml', (_req, res) => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.type('application/xml; charset=utf-8').send(fs.readFileSync(sitemapPath, 'utf-8'));
      return;
    }
    const generated = writePublicSitemap();
    res.type('application/xml; charset=utf-8').send(generated.xml);
  });

  // --- Static Public Assets (/logo.png, /favicon.png, /favicon.ico, /assets/*) ---
  app.use(express.static(path.resolve(process.cwd(), 'public'), { index: false }));
  // Serve catalog/gallery/studio images stored under /src/assets in production too
  app.use(
    '/src/assets',
    express.static(path.resolve(process.cwd(), 'src', 'assets'), { index: false, maxAge: '7d' })
  );

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get('/', async (req, res, next) => {
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const settings = getSiteSettings();
        const withSeo = injectSeoMetaIntoHtml(rawHtml, settings, req);
        const transformed = await vite.transformIndexHtml(req.originalUrl, withSeo);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      const rawHtml = fs.readFileSync(indexPath, 'utf-8');
      const settings = getSiteSettings();
      const withSeo = injectSeoMetaIntoHtml(rawHtml, settings, req);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(withSeo);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pounamu Atelier server running on http://0.0.0.0:${PORT} (SQLite WAL ready)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
