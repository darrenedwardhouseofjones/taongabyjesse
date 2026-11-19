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
  attachStripePaymentIntent,
  attachStripePaymentIntentToGiftCard,
  bulkRaiseCourierRates,
  cancelPendingOrder,
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
  findCommissionByRefAndEmail,
  findOrderByQuery,
  findUserForLogin,
  getAdminPaymentSettingsView,
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
  getGiftCardByPaymentIntentId,
  getGiftCardRedemptions,
  getGiftCardsForUser,
  getOrderById,
  getOrderByPaymentIntentId,
  getOrderEmailLog,
  getOrderEmailLogsForOrder,
  getOrdersForUser,
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
  verifyPassword,
  type WishlistPayloadInput,
} from './server/db.ts';
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
import { calculateCustomPieceCents, priceCart } from './src/utils/pricing.ts';
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
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectSeoMetaIntoHtml(html: string, settings: SiteSettings, req: express.Request): string {
  const origin =
    process.env.APP_URL?.replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
  const reqPageKey = normalizeSeoPageKey(req.originalUrl || '/');
  const pageOverride = getAllPageSeoMetadata().find((item) => item.pageKey === reqPageKey);
  const canonical = settings.canonicalUrl?.trim()
    ? `${settings.canonicalUrl.trim().replace(/\/$/, '')}${reqPageKey === '/' ? '/' : reqPageKey}`
    : `${origin}${reqPageKey === '/' ? '/' : reqPageKey}`;
  const title =
    pageOverride?.seoTitle?.trim() ||
    settings.seoTitle?.trim() ||
    `${settings.siteName} — Hand-Carved NZ Greenstone`;
  const description =
    pageOverride?.metaDescription?.trim() ||
    settings.seoDescription?.trim() ||
    settings.tagline;
  const keywords =
    (pageOverride ? pageOverride.keywords : settings.seoKeywords)?.trim() || '';
  const robots = settings.allowSearchIndexing === false ? 'noindex, nofollow' : 'index, follow';
  const ogTitle = settings.ogTitle?.trim() || title;
  const ogDescription = settings.ogDescription?.trim() || description;
  const ogSiteName = settings.ogSiteName?.trim() || settings.siteName || 'Pounamu Atelier';
  const rawOgImg = settings.ogImageUrl?.trim() || '/src/assets/images/jesse_carving_hero_1794557997280.jpg';
  const ogImage = /^(https?:|data:)/i.test(rawOgImg)
    ? rawOgImg
    : `${origin}${rawOgImg.startsWith('/') ? rawOgImg : `/${rawOgImg}`}`;
  const twitterCard = settings.twitterCardType || 'summary_large_image';

  const seoBlock = [
    `<title>${escapeHtmlAttr(title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    keywords ? `<meta name="keywords" content="${escapeHtmlAttr(keywords)}" />` : '',
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(ogSiteName)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(ogDescription)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
    `<meta name="twitter:card" content="${escapeHtmlAttr(twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(ogDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:name|property)="(?:description|keywords|robots|og:[^"]+|twitter:[^"]+)"[^>]*\/?>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*\/?>\s*/gi, '');

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
  startSitemapScheduler({ unrefTimer: true });

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

  // --- Bootstrap Endpoint ---
  app.get('/api/bootstrap', (req, res) => {
    const user = getAuthenticatedUser(req);
    const settings = getSiteSettings();
    const products = getAllProducts();
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

  // --- Provenance Verification Endpoint ---
  app.get('/api/provenance/verify', (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!code) {
      return res.json({ verified: false, record: null });
    }
    const products = getAllProducts();
    const matchedProduct = products.find(
      (p) => p.authenticityCode.trim().toUpperCase() === code
    );
    if (matchedProduct) {
      return res.json({
        verified: true,
        record: {
          title: matchedProduct.title,
          authenticityCode: matchedProduct.authenticityCode,
          originRiver: matchedProduct.originRiver,
          material: matchedProduct.material,
          carverName: matchedProduct.carverName,
          image: matchedProduct.images[0] || '',
          permitRef: matchedProduct.permitRef,
        },
      });
    }
    const galleryItems = getGalleryItems();
    const matchedGallery = galleryItems.find(
      (g) => g.authenticityCode.trim().toUpperCase() === code
    );
    if (matchedGallery) {
      return res.json({
        verified: true,
        record: {
          title: matchedGallery.title,
          authenticityCode: matchedGallery.authenticityCode,
          originRiver: matchedGallery.originRiver,
          material: matchedGallery.material,
          carverName: matchedGallery.carverName || 'Jesse',
          image: matchedGallery.imageUrl || '',
        },
      });
    }
    const orders = getAllOrders();
    for (const order of orders) {
      const item = order.items.find(
        (i) => i.authenticityCode.trim().toUpperCase() === code
      );
      if (item) {
        return res.json({
          verified: true,
          record: {
            title: item.title,
            authenticityCode: item.authenticityCode,
            originRiver: item.originRiver,
            material: item.material,
            carverName: 'Jesse',
            image: item.image,
          },
        });
      }
    }
    return res.json({ verified: false, record: null });
  });

  // --- Auth Routes ---
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    const settings = getSiteSettings();
    if (!settings.allowEmailRegistration) {
      return res.status(403).json({
        error: 'Email registration is currently disabled in studio settings.',
      });
    }

    const { firstName, lastName, email, password } = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    };

    if (!firstName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'First name, email, and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

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
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password?: string;
    };
    const identifier = (email ?? username ?? '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required.' });
    }

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
  });

  app.post('/api/auth/google', async (req, res) => {
    const settings = getSiteSettings();
    if (!settings.allowGmailOAuth) {
      return res.status(403).json({
        error: 'Gmail / Google OAuth sign-in is currently disabled in studio settings.',
      });
    }

    const { idToken, accessToken } = req.body as { idToken?: string; accessToken?: string };
    if (!idToken && !accessToken) {
      return res.status(400).json({ error: 'Google token is required.' });
    }

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
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.patch('/api/auth/profile', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const { firstName, lastName } = req.body as { firstName?: string; lastName?: string };
    if (!firstName?.trim()) {
      return res.status(400).json({ error: 'First name cannot be empty.' });
    }

    const updated = updateUserName(user.id, firstName, lastName ?? '');
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: updated });
  });

  app.patch('/api/auth/password', (req, res) => {
    const sessionUser = getAuthenticatedUser(req);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required.' });

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

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
    res.json({
      stripeEnabled: settings.stripeEnabled ?? true,
      stripeMode: settings.stripeMode || 'test',
      publishableKey: creds.publishableKey,
      configured: Boolean(creds.publishableKey && creds.secretKey),
      webhookConfigured: Boolean(creds.webhookSecret),
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

  app.put('/api/admin/payment-settings', (req, res) => {
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
      cashOnPickupEnabled,
      cashOnPickupInstructions,
      clearSecretKey,
      clearWebhookSecret,
    } = req.body as {
      stripeEnabled?: boolean;
      stripeMode?: 'test' | 'live';
      stripePublishableKey?: string;
      stripeStatementDescriptor?: string;
      stripeSecretKey?: string;
      stripeWebhookSecret?: string;
      cashOnPickupEnabled?: boolean;
      cashOnPickupInstructions?: string;
      clearSecretKey?: boolean;
      clearWebhookSecret?: boolean;
    };

    const currentSettings = getSiteSettings();
    const nextSettings: SiteSettings = {
      ...currentSettings,
      stripeEnabled: typeof stripeEnabled === 'boolean' ? stripeEnabled : currentSettings.stripeEnabled,
      stripeMode: stripeMode === 'live' ? 'live' : 'test',
      stripePublishableKey:
        typeof stripePublishableKey === 'string'
          ? stripePublishableKey.trim()
          : currentSettings.stripePublishableKey,
      stripeStatementDescriptor:
        typeof stripeStatementDescriptor === 'string'
          ? stripeStatementDescriptor.trim().slice(0, 22)
          : currentSettings.stripeStatementDescriptor,
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
      clearSecretKey,
      clearWebhookSecret,
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

  // --- Authoritative Server-Side Checkout & PaymentIntent Routes ---
  app.post('/api/checkout/create-payment-intent', async (req, res) => {
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
      items?: { productId: string; quantity: number }[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      shippingAddress?: Order['shippingAddress'];
      selectedServiceId?: string;
      discountCode?: string;
      giftCardCode?: string;
      orderNotes?: string;
      previousOrderId?: string;
      idempotencyKey?: string;
    };

    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Customer name, email, and phone are required.' });
    }
    if (
      !shippingAddress?.line1?.trim() ||
      !shippingAddress?.city?.trim() ||
      !shippingAddress?.region?.trim() ||
      !shippingAddress?.postcode?.trim()
    ) {
      return res.status(400).json({ error: 'Complete shipping address is required.' });
    }

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
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
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

  app.post('/api/checkout/cash-on-pickup', async (req, res) => {
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
      items?: { productId: string; quantity: number }[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      pickupNotes?: string;
      orderNotes?: string;
      discountCode?: string;
      giftCardCode?: string;
    };

    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({
        error: 'Full name, email address, and mobile phone number are required for Cash on Pickup.',
      });
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
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
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
      products: getAllProducts(),
      emailLog: emailResult?.emailLog || null,
    });
  });

  app.post('/api/checkout/gift-card-complete', async (req, res) => {
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
      items?: { productId: string; quantity: number }[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      shippingAddress?: Order['shippingAddress'];
      pickupNotes?: string;
      orderNotes?: string;
      fulfillmentMode?: 'courier' | 'pickup';
      selectedServiceId?: string;
      discountCode?: string;
      giftCardCode?: string;
    };

    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Customer name, email, and phone are required.' });
    }
    if (!giftCardCode?.trim()) {
      return res.status(400).json({ error: 'A valid gift card code is required.' });
    }

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
        authenticityCode: ci.product.authenticityCode,
        originRiver: ci.product.originRiver,
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
      products: getAllProducts(),
      emailLog: emailResult?.emailLog || null,
      remainingGiftCardBalanceCents: confirmed.remainingGiftCardBalanceCents,
    });
  });

  app.post('/api/checkout/confirm-status', async (req, res) => {
    const { orderId, paymentIntentId } = req.body as {
      orderId?: string;
      paymentIntentId?: string;
    };
    if (!orderId || !paymentIntentId) {
      return res.status(400).json({ error: 'orderId and paymentIntentId are required.' });
    }

    const order = getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status !== 'PENDING') {
      return res.json({ status: order.status, order, products: getAllProducts() });
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
          products: getAllProducts(),
          emailLog: emailResult?.emailLog || null,
        });
      }

      res.json({ status: order.status, stripeStatus: pi.status, order, products: getAllProducts() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify Stripe payment status.';
      res.status(400).json({ error: message });
    }
  });

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
  app.get('/api/orders/lookup', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const order = findOrderByQuery(query);
    res.json({ order });
  });

  app.get('/api/orders/:id/status', (req, res) => {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ status: order.status, orderNumber: order.orderNumber, order });
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

  app.post('/api/orders/:id/refund', async (req, res) => {
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
    const creds = getResolvedStripeCredentials();

    if (
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

  app.patch('/api/orders/:id', async (req, res) => {
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

  app.patch('/api/orders/:id/tracking', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const existing = getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const body = req.body as {
      trackingNumber?: string;
      actualCourierCostCents?: number;
      courierName?: string;
      courierServiceName?: string;
      status?: Order['status'];
    };
    const cleanedTracking = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
    if (!cleanedTracking) {
      return res.status(400).json({ error: 'A valid tracking number is required.' });
    }
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
  app.post('/api/products', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const newProduct = req.body as Product;
    if (!newProduct || !newProduct.title?.trim()) {
      return res.status(400).json({ error: 'Invalid product payload.' });
    }
    const saved = addProduct(newProduct);
    refreshPublicSitemap();
    res.status(201).json({ product: saved });
  });

  app.put('/api/products/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const updatedProduct = req.body as Product;
    if (!updatedProduct || !updatedProduct.title?.trim()) {
      return res.status(400).json({ error: 'Invalid product payload.' });
    }
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
  app.post('/api/gallery', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const body = req.body as Partial<GalleryItem>;
    if (!body || !body.title?.trim() || !body.material || !body.designType) {
      return res.status(400).json({ error: 'Title, stone material, and design motif are required.' });
    }
    const item: GalleryItem = {
      id: body.id || `gal-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title.trim(),
      material: body.material,
      designType: body.designType,
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

  app.post('/api/wishlist', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in or create an account to save to your wishlist.' });
    }
    const body = req.body as Partial<WishlistPayloadInput>;
    if (!body?.itemId || !body?.title || !body?.material || !body?.designType) {
      return res.status(400).json({ error: 'Invalid wishlist item payload.' });
    }
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

  app.post('/api/wishlist/toggle', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in or create an account to manage your wishlist.' });
    }
    const body = req.body as Partial<WishlistPayloadInput>;
    if (!body?.itemId || !body?.title || !body?.material || !body?.designType) {
      return res.status(400).json({ error: 'Invalid wishlist item payload.' });
    }
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
  app.put('/api/settings', (req, res) => {
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

  app.put('/api/admin/seo-audit', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const body = req.body as {
      pageKey?: string;
      seoTitle?: string;
      metaDescription?: string;
      keywords?: string;
    };
    if (!body || typeof body.pageKey !== 'string' || !body.pageKey.trim()) {
      return res.status(400).json({ error: 'pageKey is required.' });
    }
    const entry = upsertPageSeoMetadata({
      pageKey: body.pageKey,
      seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle : '',
      metaDescription: typeof body.metaDescription === 'string' ? body.metaDescription : '',
      keywords: typeof body.keywords === 'string' ? body.keywords : '',
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
  app.put('/api/couriers/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const courier = req.body as Courier;
    if (!courier || !courier.name?.trim() || !Array.isArray(courier.services)) {
      return res.status(400).json({ error: 'Invalid courier payload.' });
    }
    const couriers = updateCourier({ ...courier, id: req.params.id });
    res.json({ couriers });
  });

  app.patch('/api/rates/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const { priceCents } = req.body as { priceCents?: number };
    if (typeof priceCents !== 'number' || priceCents < 0) {
      return res.status(400).json({ error: 'Valid priceCents required.' });
    }
    const rates = updateCourierRate(req.params.id, priceCents);
    res.json({ rates });
  });

  app.post('/api/rates/bulk-raise', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const { percent } = req.body as { percent?: number };
    if (typeof percent !== 'number') {
      return res.status(400).json({ error: 'Valid percent required.' });
    }
    const rates = bulkRaiseCourierRates(percent);
    res.json({ rates });
  });

  app.post('/api/discounts', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const rule = req.body as DiscountRule;
    if (!rule || !rule.code?.trim() || !rule.type) {
      return res.status(400).json({ error: 'Discount code and type are required.' });
    }
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
  app.get('/api/gift-cards/validate', (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const result = validateGiftCardForCheckout(code);
    res.json(result);
  });

  app.post('/api/gift-cards/purchase-stripe', async (req, res) => {
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
      amountCents?: number;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
    };

    const cleanAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(cleanAmount) || cleanAmount < 2000 || cleanAmount > 200000) {
      return res.status(400).json({
        error: 'Gift card amount must be between $20.00 and $2,000.00 NZD.',
      });
    }
    if (
      !purchaserName?.trim() ||
      !purchaserEmail?.trim() ||
      !recipientName?.trim() ||
      !recipientEmail?.trim()
    ) {
      return res.status(400).json({
        error: 'Your name, your email, recipient name, and recipient email are all required.',
      });
    }

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
  });

  app.post('/api/gift-cards/confirm-stripe', async (req, res) => {
    const { giftCardId, paymentIntentId } = req.body as {
      giftCardId?: string;
      paymentIntentId?: string;
    };
    if (!giftCardId || !paymentIntentId) {
      return res.status(400).json({ error: 'giftCardId and paymentIntentId are required.' });
    }

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

  app.post('/api/gift-cards/purchase-pickup', (req, res) => {
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
      amountCents?: number;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
    };

    const cleanAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(cleanAmount) || cleanAmount < 2000 || cleanAmount > 200000) {
      return res.status(400).json({
        error: 'Gift card amount must be between $20.00 and $2,000.00 NZD.',
      });
    }
    if (
      !purchaserName?.trim() ||
      !purchaserEmail?.trim() ||
      !recipientName?.trim() ||
      !recipientEmail?.trim()
    ) {
      return res.status(400).json({
        error: 'Your name, your email, recipient name, and recipient email are all required.',
      });
    }

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
  });

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

  app.post('/api/admin/gift-cards', async (req, res) => {
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
      amountCents?: number;
      code?: string;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
      expiresAt?: string;
      sendEmail?: boolean;
    };

    const cleanAmount = Math.round(Number(amountCents));
    if (!Number.isFinite(cleanAmount) || cleanAmount < 100) {
      return res.status(400).json({ error: 'Gift card value must be at least $1.00 NZD.' });
    }
    if (!recipientName?.trim() || !recipientEmail?.trim()) {
      return res.status(400).json({ error: 'Recipient name and email are required.' });
    }

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

  app.patch('/api/admin/gift-cards/:id', async (req, res) => {
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

  app.put('/api/custom-pricing', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const nextConfig = req.body as CustomPricingConfig;
    if (!nextConfig || !nextConfig.materialBaseCents || !nextConfig.designMultiplier) {
      return res.status(400).json({ error: 'Invalid custom pricing configuration.' });
    }
    const customPricing = updateCustomPricing(nextConfig);
    res.json({ customPricing });
  });

  // --- Custom Commissions Routes ---
  app.get('/api/commissions/lookup', (req, res) => {
    const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    const commission = findCommissionByRefAndEmail(ref, email);
    res.json({ commission });
  });

  app.post('/api/commissions', (req, res) => {
    const user = getAuthenticatedUser(req);
    const body = req.body as CustomCommission & {
      mode?: 'configurator' | 'direct-quote';
      includePauaEye?: boolean;
      includeHardwoodBox?: boolean;
    };
    if (!body || !body.customerName?.trim() || !body.customerEmail?.trim()) {
      return res.status(400).json({ error: 'Customer name and email are required.' });
    }

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
      budgetRange: body.budgetRange || (authoritativeCents ? `$${(authoritativeCents / 100).toFixed(2)} NZD` : 'Quote requested'),
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
  });

  app.post('/api/commissions/:id/messages', (req, res) => {
    const user = getAuthenticatedUser(req);
    const { text, sender } = req.body as { text?: string; sender?: 'customer' | 'carver' };
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }
    const target = getCommissionById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Commission not found.' });
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

  app.post('/api/commissions/:id/accept', (req, res) => {
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

  app.patch('/api/commissions/:id', (req, res) => {
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

  app.patch('/api/commissions/:id/status', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    const { status } = req.body as { status?: CustomCommission['status'] };
    const target = getCommissionById(req.params.id);
    if (!target || !status) {
      return res.status(404).json({ error: 'Commission or status invalid.' });
    }
    const saved = updateCommission({ ...target, status });
    res.json({ commission: saved });
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
