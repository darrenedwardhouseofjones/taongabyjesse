import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COURIER_RATES,
  DEFAULT_COURIERS,
  DEFAULT_CUSTOM_PRICING,
  DEFAULT_SITE_SETTINGS,
} from '../src/utils/defaults.ts';
import type {
  Courier,
  CourierRate,
  CourierService,
  CustomCommission,
  CustomPricingConfig,
  DesignMotif,
  DiscountRule,
  GalleryItem,
  GiftCard,
  GiftCardPurchaseStatus,
  GiftCardRedemption,
  GiftCardValidationResult,
  Order,
  OrderEmailLog,
  OrderEmailTemplate,
  PageSeoMetadata,
  Product,
  SiteSettings,
  StoneVariety,
  UserProfile,
  UserRole,
  WishlistItem,
} from '../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'pounamu.db');
const db = new Database(DB_PATH);

// Enable WAL mode & foreign keys as specified in architecture
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize SQLite Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    user_id TEXT,
    customer_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    customer_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courier_rates (
    id TEXT PRIMARY KEY,
    courier_service_id TEXT NOT NULL,
    package_size_code TEXT NOT NULL,
    price_cents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_secrets (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    stripe_secret_key TEXT NOT NULL DEFAULT '',
    stripe_webhook_secret TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    received_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    released INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS couriers (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    tracking_url_template TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    services_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS discounts (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    value INTEGER NOT NULL,
    min_spend_cents INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_pricing (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_kind TEXT NOT NULL DEFAULT 'product',
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL,
    UNIQUE(user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS order_emails (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    template TEXT NOT NULL DEFAULT 'order_confirmation',
    recipient_email TEXT NOT NULL,
    registered_user_id TEXT,
    subject TEXT NOT NULL,
    text_body TEXT NOT NULL,
    html_body TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    sent_at TEXT NOT NULL,
    UNIQUE(order_id, template)
  );

  CREATE TABLE IF NOT EXISTS page_seo_metadata (
    page_key TEXT PRIMARY KEY,
    seo_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gift_cards (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    initial_amount_cents INTEGER NOT NULL,
    remaining_balance_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NZD',
    purchaser_name TEXT NOT NULL,
    purchaser_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    purchase_payment_method TEXT NOT NULL DEFAULT 'STRIPE',
    purchase_status TEXT NOT NULL DEFAULT 'ACTIVE',
    stripe_payment_intent_id TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    order_number TEXT NOT NULL DEFAULT '',
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gift_card_redemptions (
    id TEXT PRIMARY KEY,
    gift_card_id TEXT NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    gift_card_code TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMMITTED',
    expires_at TEXT,
    redeemed_at TEXT NOT NULL
  );
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

// Initialize schema defaults & optional env-configured initial admin user idempotently
function seedDatabase() {
  const now = new Date().toISOString();

  // Initialize Site Settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as {
    count: number;
  };
  if (settingsCount.count === 0) {
    db.prepare('INSERT INTO site_settings (id, data_json, updated_at) VALUES (1, ?, ?)').run(
      JSON.stringify(DEFAULT_SITE_SETTINGS),
      now
    );
  }

  // Ensure at least one ADMIN user (Jesse by default) exists on fresh deployment
  const adminCount = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'")
    .get() as { count: number };
  if (adminCount.count === 0) {
    const adminEmail =
      process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'jesse@pounamuatelier.co.nz';
    const envPassword = process.env.ADMIN_PASSWORD?.trim();
    const adminPassword =
      envPassword && envPassword.length >= 8 ? envPassword : 'AtelierAdmin2026!';
    const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Jesse';
    const lastName = process.env.ADMIN_LAST_NAME?.trim() || '';

    const existingByEmail = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .get(adminEmail) as { id: string } | undefined;

    if (existingByEmail) {
      db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(existingByEmail.id);
    } else {
      db.prepare(`
        INSERT INTO users (id, email, first_name, last_name, password_hash, auth_provider, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'usr-admin-jesse',
        adminEmail,
        firstName,
        lastName,
        hashPassword(adminPassword),
        'email',
        'ADMIN',
        now
      );
      console.log(`Initialized default studio admin user in SQLite: ${adminEmail} (${firstName})`);
    }
  }

  // Initialize Default Couriers & Rates on fresh empty database
  const couriersCount = db.prepare('SELECT COUNT(*) as count FROM couriers').get() as {
    count: number;
  };
  if (couriersCount.count === 0) {
    const insertCourier = db.prepare(
      'INSERT INTO couriers (id, sort_order, name, tracking_url_template, is_active, services_json) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction((items: Courier[]) => {
      items.forEach((c, idx) => {
        insertCourier.run(
          c.id,
          idx,
          c.name,
          c.trackingUrlTemplate,
          c.isActive ? 1 : 0,
          JSON.stringify(c.services)
        );
      });
    });
    tx(DEFAULT_COURIERS);
  }

  const ratesCount = db.prepare('SELECT COUNT(*) as count FROM courier_rates').get() as {
    count: number;
  };
  if (ratesCount.count === 0) {
    const insertRate = db.prepare(
      'INSERT INTO courier_rates (id, courier_service_id, package_size_code, price_cents) VALUES (?, ?, ?, ?)'
    );
    const tx = db.transaction((items: CourierRate[]) => {
      items.forEach((r) =>
        insertRate.run(r.id, r.courierServiceId, r.packageSizeCode, r.priceCents)
      );
    });
    tx(DEFAULT_COURIER_RATES);
  }

  // Initialize Custom Pricing Config
  const customPricingCount = db.prepare('SELECT COUNT(*) as count FROM custom_pricing').get() as {
    count: number;
  };
  if (customPricingCount.count === 0) {
    db.prepare('INSERT INTO custom_pricing (id, data_json, updated_at) VALUES (1, ?, ?)').run(
      JSON.stringify(DEFAULT_CUSTOM_PRICING),
      now
    );
  }
}

seedDatabase();

// Cleanup expired sessions periodically
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

// --- Query & Mutation Helpers ---

interface DbUserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string | null;
  auth_provider: 'email' | 'google';
  role: UserRole;
  created_at: string;
}

function mapUserRow(row: DbUserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    authProvider: row.auth_provider,
    createdAt: row.created_at,
  };
}

export function getSiteSettings(): SiteSettings {
  const row = db.prepare('SELECT data_json FROM site_settings WHERE id = 1').get() as
    | { data_json: string }
    | undefined;
  if (!row) return DEFAULT_SITE_SETTINGS;
  return { ...DEFAULT_SITE_SETTINGS, ...(JSON.parse(row.data_json) as Partial<SiteSettings>) };
}

export function updateSiteSettings(settings: SiteSettings): SiteSettings {
  const merged = { ...DEFAULT_SITE_SETTINGS, ...settings };
  db.prepare('UPDATE site_settings SET data_json = ?, updated_at = ? WHERE id = 1').run(
    JSON.stringify(merged),
    new Date().toISOString()
  );
  return merged;
}

export function getAllProducts(): Product[] {
  const rows = db.prepare('SELECT data_json FROM products ORDER BY sort_order ASC').all() as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as Product);
}

export function addProduct(product: Product): Product {
  db.prepare('INSERT INTO products (id, sort_order, data_json) VALUES (?, ?, ?)').run(
    product.id,
    -Date.now(),
    JSON.stringify(product)
  );
  return product;
}

export function updateProduct(product: Product): Product | null {
  const res = db
    .prepare('UPDATE products SET data_json = ? WHERE id = ?')
    .run(JSON.stringify(product), product.id);
  return res.changes > 0 ? product : null;
}

export function deleteProduct(productId: string): boolean {
  const res = db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  return res.changes > 0;
}

// --- Gallery Archive Helpers ---

export function getGalleryItems(): GalleryItem[] {
  const rows = db
    .prepare('SELECT data_json FROM gallery_items ORDER BY sort_order ASC, created_at DESC')
    .all() as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as GalleryItem);
}

export function addGalleryItem(item: GalleryItem): GalleryItem {
  db.prepare(
    'INSERT INTO gallery_items (id, sort_order, created_at, data_json) VALUES (?, ?, ?, ?)'
  ).run(item.id, -Date.now(), item.createdAt, JSON.stringify(item));
  return item;
}

export function deleteGalleryItem(id: string): boolean {
  const res = db.prepare('DELETE FROM gallery_items WHERE id = ?').run(id);
  return res.changes > 0;
}

// --- User Wishlist Helpers (Authenticated Accounts Only) ---

export interface WishlistPayloadInput {
  itemId: string;
  itemKind: 'product' | 'gallery';
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  priceCents?: number;
  image: string;
  authenticityCode?: string;
  originRiver?: string;
}

export function getWishlistForUser(userId: string): WishlistItem[] {
  const rows = db
    .prepare('SELECT id, user_id, item_id, item_kind, created_at, data_json FROM wishlists WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as {
    id: string;
    user_id: string;
    item_id: string;
    item_kind: 'product' | 'gallery';
    created_at: string;
    data_json: string;
  }[];

  const liveProducts = getAllProducts();
  const productMap = new Map(liveProducts.map((p) => [p.id, p]));

  return rows.map((row) => {
    const parsed = JSON.parse(row.data_json) as Omit<
      WishlistItem,
      'id' | 'userId' | 'itemId' | 'itemKind' | 'createdAt' | 'isAvailableNow'
    >;
    const liveProd = productMap.get(row.item_id);
    const isAvailableNow = Boolean(
      liveProd && liveProd.published && (liveProd.isMadeToOrder || liveProd.quantity > 0)
    );
    return {
      id: row.id,
      userId: row.user_id,
      itemId: row.item_id,
      itemKind: row.item_kind,
      title: liveProd?.title || parsed.title,
      material: liveProd?.material || parsed.material,
      designType: liveProd?.designType || parsed.designType,
      priceCents: liveProd?.priceCents ?? parsed.priceCents,
      image: liveProd?.images?.[0] || parsed.image,
      authenticityCode: liveProd?.authenticityCode || parsed.authenticityCode,
      originRiver: liveProd?.originRiver || parsed.originRiver,
      isAvailableNow,
      createdAt: row.created_at,
    };
  });
}

export function addWishlistItem(
  userId: string,
  input: WishlistPayloadInput
): { wishlist: WishlistItem[]; added: boolean } {
  const existing = db
    .prepare('SELECT id FROM wishlists WHERE user_id = ? AND item_id = ?')
    .get(userId, input.itemId) as { id: string } | undefined;

  if (existing) {
    return { wishlist: getWishlistForUser(userId), added: false };
  }

  const now = new Date().toISOString();
  const id = `wish-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(
    'INSERT INTO wishlists (id, user_id, item_id, item_kind, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    userId,
    input.itemId,
    input.itemKind,
    now,
    JSON.stringify({
      title: input.title,
      material: input.material,
      designType: input.designType,
      priceCents: input.priceCents,
      image: input.image,
      authenticityCode: input.authenticityCode,
      originRiver: input.originRiver,
    })
  );
  return { wishlist: getWishlistForUser(userId), added: true };
}

export function toggleWishlistItem(
  userId: string,
  input: WishlistPayloadInput
): { wishlist: WishlistItem[]; added: boolean } {
  const existing = db
    .prepare('SELECT id FROM wishlists WHERE user_id = ? AND item_id = ?')
    .get(userId, input.itemId) as { id: string } | undefined;

  if (existing) {
    db.prepare('DELETE FROM wishlists WHERE id = ? AND user_id = ?').run(existing.id, userId);
    return { wishlist: getWishlistForUser(userId), added: false };
  }

  return addWishlistItem(userId, input);
}

export function removeWishlistItem(userId: string, itemId: string): WishlistItem[] {
  db.prepare('DELETE FROM wishlists WHERE user_id = ? AND (item_id = ? OR id = ?)').run(
    userId,
    itemId,
    itemId
  );
  return getWishlistForUser(userId);
}

interface DbCourierRow {
  id: string;
  name: string;
  tracking_url_template: string;
  is_active: number;
  services_json: string;
}

export function getCouriers(): Courier[] {
  const rows = db
    .prepare(
      'SELECT id, name, tracking_url_template, is_active, services_json FROM couriers ORDER BY sort_order ASC'
    )
    .all() as DbCourierRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trackingUrlTemplate: row.tracking_url_template,
    isActive: row.is_active === 1,
    services: JSON.parse(row.services_json) as CourierService[],
  }));
}

export function updateCourier(courier: Courier): Courier[] {
  db.prepare(
    'UPDATE couriers SET name = ?, tracking_url_template = ?, is_active = ?, services_json = ? WHERE id = ?'
  ).run(
    courier.name,
    courier.trackingUrlTemplate,
    courier.isActive ? 1 : 0,
    JSON.stringify(courier.services),
    courier.id
  );
  return getCouriers();
}

interface DbDiscountRow {
  code: string;
  type: DiscountRule['type'];
  value: number;
  min_spend_cents: number;
  description: string;
  is_active: number;
}

export function getDiscounts(activeOnly = false): DiscountRule[] {
  const sql = activeOnly
    ? 'SELECT code, type, value, min_spend_cents, description, is_active FROM discounts WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT code, type, value, min_spend_cents, description, is_active FROM discounts ORDER BY created_at DESC';
  const rows = db.prepare(sql).all() as DbDiscountRow[];
  return rows.map((r) => ({
    code: r.code,
    type: r.type,
    value: r.value,
    minSpendCents: r.min_spend_cents || undefined,
    description: r.description,
    isActive: r.is_active === 1,
  }));
}

export function upsertDiscount(discount: DiscountRule): DiscountRule[] {
  const cleanCode = discount.code.trim().toUpperCase();
  db.prepare(
    `INSERT INTO discounts (code, type, value, min_spend_cents, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       type = excluded.type,
       value = excluded.value,
       min_spend_cents = excluded.min_spend_cents,
       description = excluded.description,
       is_active = excluded.is_active`
  ).run(
    cleanCode,
    discount.type,
    Math.max(0, Math.round(discount.value)),
    Math.max(0, Math.round(discount.minSpendCents || 0)),
    discount.description.trim(),
    discount.isActive ? 1 : 0,
    new Date().toISOString()
  );
  return getDiscounts();
}

export function deleteDiscount(code: string): DiscountRule[] {
  db.prepare('DELETE FROM discounts WHERE UPPER(code) = UPPER(?)').run(code.trim());
  return getDiscounts();
}

function normalizeCustomPricing(raw: Partial<CustomPricingConfig>): CustomPricingConfig {
  const defaultStones = DEFAULT_CUSTOM_PRICING.stoneOptions || [];
  const defaultDesigns = DEFAULT_CUSTOM_PRICING.designOptions || [];
  const defaultSizes = DEFAULT_CUSTOM_PRICING.sizeOptions || [];

  const stoneOptions = Array.isArray(raw.stoneOptions)
    ? raw.stoneOptions
        .filter((s) => s && typeof s.name === 'string' && s.name.trim())
        .map((s) => ({
          name: s.name.trim(),
          description: (s.description || '').trim() || 'Aotearoa Greenstone',
          baseCents:
            typeof s.baseCents === 'number' && Number.isFinite(s.baseCents) && s.baseCents >= 0
              ? Math.round(s.baseCents)
              : 28000,
        }))
    : Object.entries(raw.materialBaseCents || DEFAULT_CUSTOM_PRICING.materialBaseCents).map(
        ([name, baseCents]) => {
          const def = defaultStones.find((d) => d.name === name);
          return {
            name,
            description: def?.description || 'Aotearoa Greenstone',
            baseCents: typeof baseCents === 'number' ? Math.round(baseCents) : 28000,
          };
        }
      );

  const designOptions = Array.isArray(raw.designOptions)
    ? raw.designOptions
        .filter((d) => d && typeof d.name === 'string' && d.name.trim())
        .map((d) => {
          const def = defaultDesigns.find((x) => x.name === d.name.trim());
          return {
            name: d.name.trim(),
            label: (d.label || d.name).trim(),
            meaning: (d.meaning || '').trim() || 'Traditional Motif',
            multiplier:
              typeof d.multiplier === 'number' && Number.isFinite(d.multiplier) && d.multiplier > 0
                ? Number(d.multiplier)
                : 1.0,
            previewImageUrl:
              d.previewImageUrl?.trim() ||
              def?.previewImageUrl ||
              '/src/assets/images/modern_hero_pounamu_1794472502033.jpg',
          };
        })
    : Object.entries(raw.designMultiplier || DEFAULT_CUSTOM_PRICING.designMultiplier).map(
        ([name, multiplier]) => {
          const def = defaultDesigns.find((x) => x.name === name);
          return {
            name,
            label: def?.label || name,
            meaning: def?.meaning || 'Traditional Motif',
            multiplier: typeof multiplier === 'number' ? multiplier : 1.0,
            previewImageUrl:
              def?.previewImageUrl || '/src/assets/images/modern_hero_pounamu_1794472502033.jpg',
          };
        }
      );

  const sizeMultFallback = {
    ...DEFAULT_CUSTOM_PRICING.sizeMultiplier,
    ...(raw.sizeMultiplier || {}),
  };

  const sizeOptions = Array.isArray(raw.sizeOptions)
    ? raw.sizeOptions
        .filter((sz) => sz && typeof sz.mm === 'number' && Number.isFinite(sz.mm) && sz.mm > 0)
        .map((sz) => ({
          mm: Math.round(sz.mm),
          label: (sz.label || `${Math.round(sz.mm)}mm`).trim(),
          multiplier:
            typeof sz.multiplier === 'number' && Number.isFinite(sz.multiplier) && sz.multiplier > 0
              ? Number(sz.multiplier)
              : 1.0,
        }))
    : defaultSizes.map((sz) => ({
        mm: sz.mm,
        label: sz.label,
        multiplier:
          sz.mm <= 50
            ? sizeMultFallback.small45
            : sz.mm >= 80
            ? sizeMultFallback.large85
            : sizeMultFallback.medium65,
      }));

  const cordOptions = Array.isArray(raw.cordOptions)
    ? raw.cordOptions.map((c) => String(c).trim()).filter(Boolean)
    : DEFAULT_CUSTOM_PRICING.cordOptions;

  const bindingOptions = Array.isArray(raw.bindingOptions)
    ? raw.bindingOptions.map((b) => String(b).trim()).filter(Boolean)
    : DEFAULT_CUSTOM_PRICING.bindingOptions;

  const materialBaseCents: Record<string, number> = {};
  stoneOptions.forEach((s) => {
    materialBaseCents[s.name] = s.baseCents;
  });

  const designMultiplier: Record<string, number> = {};
  designOptions.forEach((d) => {
    designMultiplier[d.name] = d.multiplier;
  });

  return {
    materialBaseCents,
    designMultiplier,
    sizeMultiplier: {
      small45: sizeOptions[0]?.multiplier ?? sizeMultFallback.small45,
      medium65: sizeOptions[1]?.multiplier ?? sizeMultFallback.medium65,
      large85: sizeOptions[2]?.multiplier ?? sizeMultFallback.large85,
    },
    stoneOptions,
    designOptions,
    sizeOptions,
    pauaEyeCents:
      typeof raw.pauaEyeCents === 'number' && Number.isFinite(raw.pauaEyeCents) && raw.pauaEyeCents >= 0
        ? Math.round(raw.pauaEyeCents)
        : DEFAULT_CUSTOM_PRICING.pauaEyeCents,
    hardwoodBoxCents:
      typeof raw.hardwoodBoxCents === 'number' &&
      Number.isFinite(raw.hardwoodBoxCents) &&
      raw.hardwoodBoxCents >= 0
        ? Math.round(raw.hardwoodBoxCents)
        : DEFAULT_CUSTOM_PRICING.hardwoodBoxCents,
    cordOptions,
    bindingOptions,
  };
}

export function getCustomPricing(): CustomPricingConfig {
  const row = db.prepare('SELECT data_json FROM custom_pricing WHERE id = 1').get() as
    | { data_json: string }
    | undefined;
  if (!row) return normalizeCustomPricing(DEFAULT_CUSTOM_PRICING);
  return normalizeCustomPricing(JSON.parse(row.data_json) as Partial<CustomPricingConfig>);
}

export function updateCustomPricing(config: CustomPricingConfig): CustomPricingConfig {
  const normalized = normalizeCustomPricing(config);
  db.prepare('UPDATE custom_pricing SET data_json = ?, updated_at = ? WHERE id = 1').run(
    JSON.stringify(normalized),
    new Date().toISOString()
  );
  return normalized;
}

export function getCourierRates(): CourierRate[] {
  const rows = db
    .prepare(
      'SELECT id, courier_service_id as courierServiceId, package_size_code as packageSizeCode, price_cents as priceCents FROM courier_rates'
    )
    .all() as CourierRate[];
  return rows;
}

export function updateCourierRate(rateId: string, newPriceCents: number): CourierRate[] {
  db.prepare('UPDATE courier_rates SET price_cents = ? WHERE id = ?').run(newPriceCents, rateId);
  return getCourierRates();
}

export function bulkRaiseCourierRates(percent: number): CourierRate[] {
  const factor = 1 + percent / 100;
  const rows = getCourierRates();
  const stmt = db.prepare('UPDATE courier_rates SET price_cents = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const r of rows) {
      stmt.run(Math.round(r.priceCents * factor), r.id);
    }
  });
  tx();
  return getCourierRates();
}

export function getAllOrders(): Order[] {
  const rows = db.prepare('SELECT data_json FROM orders ORDER BY created_at DESC').all() as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as Order);
}

export function getOrdersForUser(user: UserProfile): Order[] {
  const rows = db
    .prepare(
      'SELECT data_json FROM orders WHERE user_id = ? OR LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC'
    )
    .all(user.id, user.email) as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as Order);
}

export function findOrderByQuery(query: string): Order | null {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;
  const row = db
    .prepare(
      'SELECT data_json FROM orders WHERE LOWER(order_number) = ? OR LOWER(customer_email) = ? ORDER BY created_at DESC LIMIT 1'
    )
    .get(clean, clean) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as Order) : null;
}

export function createOrder(order: Order, userId?: string): Order {
  const enrichedOrder: Order = userId ? { ...order, userId } : order;

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO orders (id, order_number, user_id, customer_email, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      enrichedOrder.id,
      enrichedOrder.orderNumber,
      userId ?? null,
      enrichedOrder.customerEmail.toLowerCase(),
      enrichedOrder.createdAt,
      JSON.stringify(enrichedOrder)
    );

    // Decrement stock for non-made-to-order items
    const updateProd = db.prepare('UPDATE products SET data_json = ? WHERE id = ?');
    const getProd = db.prepare('SELECT data_json FROM products WHERE id = ?');
    for (const item of enrichedOrder.items) {
      const prodRow = getProd.get(item.productId) as { data_json: string } | undefined;
      if (prodRow) {
        const prod = JSON.parse(prodRow.data_json) as Product;
        if (!prod.isMadeToOrder) {
          prod.quantity = Math.max(0, prod.quantity - item.quantity);
          updateProd.run(JSON.stringify(prod), prod.id);
        }
      }
    }
  });

  tx();
  return enrichedOrder;
}

export function updateOrder(order: Order): Order {
  db.prepare('UPDATE orders SET data_json = ? WHERE id = ?').run(JSON.stringify(order), order.id);
  return order;
}

export function getOrderById(orderId: string): Order | null {
  const row = db.prepare('SELECT data_json FROM orders WHERE id = ?').get(orderId) as
    | { data_json: string }
    | undefined;
  return row ? (JSON.parse(row.data_json) as Order) : null;
}

export function getOrderByPaymentIntentId(paymentIntentId: string): Order | null {
  const rows = db.prepare('SELECT data_json FROM orders ORDER BY created_at DESC LIMIT 200').all() as {
    data_json: string;
  }[];
  for (const r of rows) {
    const o = JSON.parse(r.data_json) as Order;
    if (o.stripePaymentIntentId === paymentIntentId) return o;
  }
  return null;
}

// --- Payment Secrets & Stripe Webhook Idempotency Helpers ---

function maskSecretKey(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••••••';
  const prefix = clean.slice(0, 7);
  const suffix = clean.slice(-4);
  return `${prefix}••••${suffix}`;
}

export function getResolvedStripeCredentials(): {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  secretSource: 'database' | 'env' | 'none';
  webhookSource: 'database' | 'env' | 'none';
} {
  const settings = getSiteSettings();
  const row = db
    .prepare('SELECT stripe_secret_key, stripe_webhook_secret FROM payment_secrets WHERE id = 1')
    .get() as { stripe_secret_key: string; stripe_webhook_secret: string } | undefined;

  const dbSecret = row?.stripe_secret_key?.trim() || '';
  const envSecret = process.env.STRIPE_SECRET_KEY?.trim() || '';
  const secretKey = dbSecret || envSecret;
  const secretSource: 'database' | 'env' | 'none' = dbSecret
    ? 'database'
    : envSecret
    ? 'env'
    : 'none';

  const dbWebhook = row?.stripe_webhook_secret?.trim() || '';
  const envWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
  const webhookSecret = dbWebhook || envWebhook;
  const webhookSource: 'database' | 'env' | 'none' = dbWebhook
    ? 'database'
    : envWebhook
    ? 'env'
    : 'none';

  const publishableKey =
    settings.stripePublishableKey?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
    '';

  return {
    publishableKey,
    secretKey,
    webhookSecret,
    secretSource,
    webhookSource,
  };
}

export function getAdminPaymentSettingsView() {
  const settings = getSiteSettings();
  const creds = getResolvedStripeCredentials();
  return {
    stripeEnabled: settings.stripeEnabled ?? true,
    stripeMode: settings.stripeMode || 'test',
    stripePublishableKey: creds.publishableKey,
    stripeStatementDescriptor: settings.stripeStatementDescriptor || 'POUNAMU ATELIER',
    cashOnPickupEnabled: settings.cashOnPickupEnabled ?? true,
    cashOnPickupInstructions:
      settings.cashOnPickupInstructions ??
      DEFAULT_SITE_SETTINGS.cashOnPickupInstructions ??
      '',
    hasSecretKey: Boolean(creds.secretKey),
    secretKeyMasked: maskSecretKey(creds.secretKey),
    hasWebhookSecret: Boolean(creds.webhookSecret),
    webhookSecretMasked: maskSecretKey(creds.webhookSecret),
    secretSource: creds.secretSource,
    webhookSource: creds.webhookSource,
  };
}

export function savePaymentSecrets(params: {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  clearSecretKey?: boolean;
  clearWebhookSecret?: boolean;
}): void {
  const existing = db
    .prepare('SELECT stripe_secret_key, stripe_webhook_secret FROM payment_secrets WHERE id = 1')
    .get() as { stripe_secret_key: string; stripe_webhook_secret: string } | undefined;

  const nextSecret = params.clearSecretKey
    ? ''
    : params.stripeSecretKey && params.stripeSecretKey.trim()
    ? params.stripeSecretKey.trim()
    : existing?.stripe_secret_key || '';

  const nextWebhook = params.clearWebhookSecret
    ? ''
    : params.stripeWebhookSecret && params.stripeWebhookSecret.trim()
    ? params.stripeWebhookSecret.trim()
    : existing?.stripe_webhook_secret || '';

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO payment_secrets (id, stripe_secret_key, stripe_webhook_secret, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       stripe_secret_key = excluded.stripe_secret_key,
       stripe_webhook_secret = excluded.stripe_webhook_secret,
       updated_at = excluded.updated_at`
  ).run(nextSecret, nextWebhook, now);
}

// --- Stock Reservations & Atomic Stripe Checkout Lifecycle ---

export function releaseExpiredReservations(): void {
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE reservations SET released = 1 WHERE released = 0 AND expires_at < ?').run(
    nowIso
  );
  db.prepare(
    "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE status = 'HELD' AND expires_at IS NOT NULL AND expires_at < ?"
  ).run(nowIso);
}

export function releaseOrderReservations(orderId: string): void {
  db.prepare('UPDATE reservations SET released = 1 WHERE order_id = ?').run(orderId);
  db.prepare(
    "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE order_id = ? AND status = 'HELD'"
  ).run(orderId);
}

export function createPendingOrderAtomic(
  order: Order,
  userId?: string
): { ok: true; order: Order } | { ok: false; error: string } {
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const enrichedOrder: Order = {
    ...(userId ? { ...order, userId } : order),
    status: 'PENDING',
  };

  try {
    const tx = db.transaction(() => {
      // Clear expired stock reservations & expired gift card holds inside the same transaction
      db.prepare('UPDATE reservations SET released = 1 WHERE released = 0 AND expires_at < ?').run(
        nowIso
      );
      db.prepare(
        "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE status = 'HELD' AND expires_at IS NOT NULL AND expires_at < ?"
      ).run(nowIso);

      const getProd = db.prepare('SELECT data_json FROM products WHERE id = ?');
      const getReserved = db.prepare(
        'SELECT COALESCE(SUM(quantity), 0) as qty FROM reservations WHERE product_id = ? AND released = 0 AND expires_at >= ?'
      );
      const insertReservation = db.prepare(
        'INSERT INTO reservations (id, product_id, order_id, quantity, expires_at, released) VALUES (?, ?, ?, ?, ?, 0)'
      );

      for (const item of enrichedOrder.items) {
        const prodRow = getProd.get(item.productId) as { data_json: string } | undefined;
        if (!prodRow) {
          throw new Error(`Product "${item.title}" is no longer available.`);
        }
        const prod = JSON.parse(prodRow.data_json) as Product;
        if (!prod.isMadeToOrder) {
          const reservedRow = getReserved.get(prod.id, nowIso) as { qty: number };
          const available = prod.quantity - reservedRow.qty;
          if (available < item.quantity) {
            throw new Error(
              available <= 0
                ? `"${prod.title}" is currently reserved by another collector or out of stock.`
                : `Only ${available} unit(s) of "${prod.title}" available right now.`
            );
          }
          insertReservation.run(
            `res-${crypto.randomUUID()}`,
            prod.id,
            enrichedOrder.id,
            item.quantity,
            expiresAtIso
          );
        }
      }

      if (enrichedOrder.giftCardCode && (enrichedOrder.giftCardAppliedCents || 0) > 0) {
        const cleanGcCode = enrichedOrder.giftCardCode.trim().toUpperCase();
        const applyCents = enrichedOrder.giftCardAppliedCents || 0;
        const gcRow = db
          .prepare('SELECT * FROM gift_cards WHERE UPPER(code) = ?')
          .get(cleanGcCode) as DbGiftCardRow | undefined;
        if (!gcRow || gcRow.is_active !== 1 || gcRow.purchase_status !== 'ACTIVE') {
          throw new Error(`Gift card "${cleanGcCode}" is inactive or no longer valid.`);
        }
        if (gcRow.expires_at && gcRow.expires_at <= nowIso) {
          throw new Error(`Gift card "${cleanGcCode}" has expired.`);
        }
        const heldRow = db
          .prepare(
            "SELECT COALESCE(SUM(amount_cents), 0) as held FROM gift_card_redemptions WHERE gift_card_id = ? AND status = 'HELD' AND (expires_at IS NULL OR expires_at >= ?)"
          )
          .get(gcRow.id, nowIso) as { held: number };
        const availableCents = Math.max(0, gcRow.remaining_balance_cents - heldRow.held);
        if (availableCents < applyCents) {
          throw new Error(
            `Gift card "${cleanGcCode}" only has $${(availableCents / 100).toFixed(2)} NZD available right now.`
          );
        }
        db.prepare(
          `INSERT INTO gift_card_redemptions (id, gift_card_id, gift_card_code, order_id, order_number, amount_cents, status, expires_at, redeemed_at)
           VALUES (?, ?, ?, ?, ?, ?, 'HELD', ?, ?)`
        ).run(
          `gcr-${crypto.randomUUID()}`,
          gcRow.id,
          gcRow.code,
          enrichedOrder.id,
          enrichedOrder.orderNumber,
          applyCents,
          expiresAtIso,
          nowIso
        );
      }

      db.prepare(
        'INSERT INTO orders (id, order_number, user_id, customer_email, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        enrichedOrder.id,
        enrichedOrder.orderNumber,
        userId ?? null,
        enrichedOrder.customerEmail.toLowerCase(),
        enrichedOrder.createdAt,
        JSON.stringify(enrichedOrder)
      );
    });

    tx();
    return { ok: true, order: enrichedOrder };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unable to reserve stock.' };
  }
}

export function createCashOnPickupOrderAtomic(
  order: Order,
  userId?: string
): { ok: true; order: Order } | { ok: false; error: string } {
  const nowIso = new Date().toISOString();
  const isCoveredInFull = order.totalCents === 0 && (order.giftCardAppliedCents || 0) > 0;
  const enrichedOrder: Order = {
    ...(userId ? { ...order, userId } : order),
    paymentMethod: 'CASH_ON_PICKUP',
    paymentStatus: isCoveredInFull ? 'PAID' : 'PAY_ON_PICKUP',
    status: 'PROCESSING',
    stripePaymentIntentId: '',
    stripeFeeCents: 0,
    netCents: order.totalCents + (order.giftCardAppliedCents || 0),
  };

  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE reservations SET released = 1 WHERE released = 0 AND expires_at < ?').run(
        nowIso
      );
      db.prepare(
        "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE status = 'HELD' AND expires_at IS NOT NULL AND expires_at < ?"
      ).run(nowIso);

      const getProd = db.prepare('SELECT data_json FROM products WHERE id = ?');
      const getReserved = db.prepare(
        'SELECT COALESCE(SUM(quantity), 0) as qty FROM reservations WHERE product_id = ? AND released = 0 AND expires_at >= ?'
      );
      const updateProd = db.prepare('UPDATE products SET data_json = ? WHERE id = ?');

      for (const item of enrichedOrder.items) {
        const prodRow = getProd.get(item.productId) as { data_json: string } | undefined;
        if (!prodRow) {
          throw new Error(`Product "${item.title}" is no longer available.`);
        }
        const prod = JSON.parse(prodRow.data_json) as Product;
        if (!prod.isMadeToOrder) {
          const reservedRow = getReserved.get(prod.id, nowIso) as { qty: number };
          const available = prod.quantity - reservedRow.qty;
          if (available < item.quantity) {
            throw new Error(
              available <= 0
                ? `"${prod.title}" is currently reserved by another collector or out of stock.`
                : `Only ${available} unit(s) of "${prod.title}" available right now.`
            );
          }
          prod.quantity = Math.max(0, prod.quantity - item.quantity);
          updateProd.run(JSON.stringify(prod), prod.id);
        }
      }

      if (enrichedOrder.giftCardCode && (enrichedOrder.giftCardAppliedCents || 0) > 0) {
        commitDirectGiftCardDeductionTx({
          code: enrichedOrder.giftCardCode,
          amountCents: enrichedOrder.giftCardAppliedCents || 0,
          orderId: enrichedOrder.id,
          orderNumber: enrichedOrder.orderNumber,
          nowIso,
        });
      }

      db.prepare(
        'INSERT INTO orders (id, order_number, user_id, customer_email, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        enrichedOrder.id,
        enrichedOrder.orderNumber,
        userId ?? null,
        enrichedOrder.customerEmail.toLowerCase(),
        enrichedOrder.createdAt,
        JSON.stringify(enrichedOrder)
      );
    });

    tx();
    return { ok: true, order: enrichedOrder };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to confirm Cash on Pickup order.',
    };
  }
}

export function createGiftCardPaidOrderAtomic(
  order: Order,
  userId?: string
): { ok: true; order: Order; remainingGiftCardBalanceCents: number } | { ok: false; error: string } {
  const nowIso = new Date().toISOString();
  const appliedCents = order.giftCardAppliedCents || 0;
  if (!order.giftCardCode || appliedCents <= 0 || order.totalCents !== 0) {
    return {
      ok: false,
      error: 'Gift card must cover the full order total ($0.00 balance due) for instant Gift Card checkout.',
    };
  }

  const enrichedOrder: Order = {
    ...(userId ? { ...order, userId } : order),
    paymentMethod: 'GIFT_CARD',
    paymentStatus: 'PAID',
    status: 'PAID',
    stripePaymentIntentId: '',
    stripeFeeCents: 0,
    netCents: appliedCents,
  };

  try {
    let remainingAfter = 0;
    const tx = db.transaction(() => {
      db.prepare('UPDATE reservations SET released = 1 WHERE released = 0 AND expires_at < ?').run(
        nowIso
      );
      db.prepare(
        "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE status = 'HELD' AND expires_at IS NOT NULL AND expires_at < ?"
      ).run(nowIso);

      const getProd = db.prepare('SELECT data_json FROM products WHERE id = ?');
      const getReserved = db.prepare(
        'SELECT COALESCE(SUM(quantity), 0) as qty FROM reservations WHERE product_id = ? AND released = 0 AND expires_at >= ?'
      );
      const updateProd = db.prepare('UPDATE products SET data_json = ? WHERE id = ?');

      for (const item of enrichedOrder.items) {
        const prodRow = getProd.get(item.productId) as { data_json: string } | undefined;
        if (!prodRow) {
          throw new Error(`Product "${item.title}" is no longer available.`);
        }
        const prod = JSON.parse(prodRow.data_json) as Product;
        if (!prod.isMadeToOrder) {
          const reservedRow = getReserved.get(prod.id, nowIso) as { qty: number };
          const available = prod.quantity - reservedRow.qty;
          if (available < item.quantity) {
            throw new Error(
              available <= 0
                ? `"${prod.title}" is currently reserved by another collector or out of stock.`
                : `Only ${available} unit(s) of "${prod.title}" available right now.`
            );
          }
          prod.quantity = Math.max(0, prod.quantity - item.quantity);
          updateProd.run(JSON.stringify(prod), prod.id);
        }
      }

      remainingAfter = commitDirectGiftCardDeductionTx({
        code: enrichedOrder.giftCardCode!,
        amountCents: appliedCents,
        orderId: enrichedOrder.id,
        orderNumber: enrichedOrder.orderNumber,
        nowIso,
      });

      db.prepare(
        'INSERT INTO orders (id, order_number, user_id, customer_email, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        enrichedOrder.id,
        enrichedOrder.orderNumber,
        userId ?? null,
        enrichedOrder.customerEmail.toLowerCase(),
        enrichedOrder.createdAt,
        JSON.stringify(enrichedOrder)
      );
    });

    tx();
    return { ok: true, order: enrichedOrder, remainingGiftCardBalanceCents: remainingAfter };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to complete order with gift card.',
    };
  }
}

export function hasStripeEventBeenProcessed(eventId: string): boolean {
  const row = db
    .prepare('SELECT event_id FROM stripe_events WHERE event_id = ?')
    .get(eventId) as { event_id: string } | undefined;
  return Boolean(row);
}

export function recordStripeEvent(eventId: string, eventType: string): boolean {
  const res = db
    .prepare(
      'INSERT OR IGNORE INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)'
    )
    .run(eventId, eventType, new Date().toISOString());
  return res.changes > 0;
}

export function cancelPendingOrder(orderId: string): void {
  const existing = getOrderById(orderId);
  if (!existing || existing.status !== 'PENDING') return;
  const tx = db.transaction(() => {
    db.prepare('UPDATE reservations SET released = 1 WHERE order_id = ?').run(orderId);
    db.prepare(
      "UPDATE gift_card_redemptions SET status = 'RELEASED' WHERE order_id = ? AND status = 'HELD'"
    ).run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  });
  tx();
}

export function attachStripePaymentIntent(orderId: string, paymentIntentId: string): Order | null {
  const existing = getOrderById(orderId);
  if (!existing) return null;
  const updated: Order = { ...existing, stripePaymentIntentId: paymentIntentId };
  return updateOrder(updated);
}

export function markOrderPaidAtomic(params: {
  orderId: string;
  paymentIntentId: string;
  stripeFeeCents?: number;
  netCents?: number;
  eventId?: string;
  eventType?: string;
}): { order: Order | null; alreadyProcessed: boolean } {
  const tx = db.transaction(() => {
    const nowIso = new Date().toISOString();
    if (params.eventId) {
      const seen = db
        .prepare('SELECT event_id FROM stripe_events WHERE event_id = ?')
        .get(params.eventId) as { event_id: string } | undefined;
      if (seen) {
        const existingOrder =
          (params.orderId ? getOrderById(params.orderId) : null) ||
          (params.paymentIntentId ? getOrderByPaymentIntentId(params.paymentIntentId) : null);
        return { order: existingOrder, alreadyProcessed: true };
      }
      db.prepare('INSERT INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)').run(
        params.eventId,
        params.eventType || 'payment_intent.succeeded',
        nowIso
      );
    }

    const order =
      (params.orderId ? getOrderById(params.orderId) : null) ||
      (params.paymentIntentId ? getOrderByPaymentIntentId(params.paymentIntentId) : null);
    if (!order) {
      return { order: null, alreadyProcessed: false };
    }

    if (order.status !== 'PENDING') {
      return { order, alreadyProcessed: true };
    }

    const getProd = db.prepare('SELECT data_json FROM products WHERE id = ?');
    const updateProd = db.prepare('UPDATE products SET data_json = ? WHERE id = ?');
    for (const item of order.items) {
      const prodRow = getProd.get(item.productId) as { data_json: string } | undefined;
      if (prodRow) {
        const prod = JSON.parse(prodRow.data_json) as Product;
        if (!prod.isMadeToOrder) {
          prod.quantity = Math.max(0, prod.quantity - item.quantity);
          updateProd.run(JSON.stringify(prod), prod.id);
        }
      }
    }

    db.prepare('UPDATE reservations SET released = 1 WHERE order_id = ?').run(order.id);

    // Commit any Gift Card deduction held or attached to this order
    if (order.giftCardCode && (order.giftCardAppliedCents || 0) > 0) {
      const heldRow = db
        .prepare("SELECT * FROM gift_card_redemptions WHERE order_id = ? AND status = 'HELD' LIMIT 1")
        .get(order.id) as DbGiftCardRedemptionRow | undefined;

      if (heldRow) {
        const gcRow = db
          .prepare('SELECT * FROM gift_cards WHERE id = ?')
          .get(heldRow.gift_card_id) as DbGiftCardRow | undefined;
        if (gcRow) {
          const nextBal = Math.max(0, gcRow.remaining_balance_cents - heldRow.amount_cents);
          const nextStatus: GiftCardPurchaseStatus = nextBal <= 0 ? 'REDEEMED' : 'ACTIVE';
          db.prepare(
            'UPDATE gift_cards SET remaining_balance_cents = ?, purchase_status = ?, updated_at = ? WHERE id = ?'
          ).run(nextBal, nextStatus, nowIso, gcRow.id);
        }
        db.prepare(
          "UPDATE gift_card_redemptions SET status = 'COMMITTED', redeemed_at = ? WHERE id = ?"
        ).run(nowIso, heldRow.id);
      } else {
        commitDirectGiftCardDeductionTx({
          code: order.giftCardCode,
          amountCents: order.giftCardAppliedCents || 0,
          orderId: order.id,
          orderNumber: order.orderNumber,
          nowIso,
        });
      }
    }

    const feeCents =
      typeof params.stripeFeeCents === 'number'
        ? params.stripeFeeCents
        : order.stripeFeeCents || Math.round(order.totalCents * 0.027 + 30);
    const netCents =
      typeof params.netCents === 'number' ? params.netCents : Math.max(0, order.totalCents - feeCents);

    const paidOrder: Order = {
      ...order,
      paymentMethod: order.paymentMethod || 'STRIPE',
      paymentStatus: 'PAID',
      status: 'PAID',
      stripePaymentIntentId: params.paymentIntentId || order.stripePaymentIntentId,
      stripeFeeCents: feeCents,
      netCents: netCents + (order.giftCardAppliedCents || 0),
    };

    db.prepare('UPDATE orders SET data_json = ? WHERE id = ?').run(
      JSON.stringify(paidOrder),
      paidOrder.id
    );

    return { order: paidOrder, alreadyProcessed: false };
  });

  return tx();
}

export function recordOrderRefund(params: {
  orderId: string;
  refundAmountCents?: number;
  absoluteRefundedCents?: number;
  refundId?: string;
}): Order | null {
  const order = getOrderById(params.orderId);
  if (!order) return null;

  if (params.refundId && order.stripeRefundId === params.refundId && typeof params.absoluteRefundedCents !== 'number') {
    return order;
  }

  const totalRefunded =
    typeof params.absoluteRefundedCents === 'number'
      ? Math.min(order.totalCents, Math.max(order.refundedAmountCents || 0, params.absoluteRefundedCents))
      : Math.min(order.totalCents, (order.refundedAmountCents || 0) + (params.refundAmountCents || 0));

  const updated: Order = {
    ...order,
    refundedAmountCents: totalRefunded,
    stripeRefundId: params.refundId || order.stripeRefundId,
    paymentStatus:
      totalRefunded >= order.totalCents ? 'REFUNDED' : order.paymentStatus || 'PAID',
    status: totalRefunded >= order.totalCents ? 'REFUNDED' : order.status,
  };
  return updateOrder(updated);
}

export function getAllCommissions(): CustomCommission[] {
  const rows = db.prepare('SELECT data_json FROM commissions ORDER BY created_at DESC').all() as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as CustomCommission);
}

export function getCommissionsForUser(user: UserProfile): CustomCommission[] {
  const rows = db
    .prepare(
      'SELECT data_json FROM commissions WHERE user_id = ? OR LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC'
    )
    .all(user.id, user.email) as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as CustomCommission);
}

export function createCommission(
  commission: CustomCommission,
  userId?: string
): CustomCommission {
  db.prepare(
    'INSERT INTO commissions (id, user_id, customer_email, created_at, data_json) VALUES (?, ?, ?, ?, ?)'
  ).run(
    commission.id,
    userId ?? null,
    commission.customerEmail.toLowerCase(),
    commission.createdAt,
    JSON.stringify(commission)
  );
  return commission;
}

export function updateCommission(commission: CustomCommission): CustomCommission {
  db.prepare('UPDATE commissions SET data_json = ? WHERE id = ?').run(
    JSON.stringify(commission),
    commission.id
  );
  return commission;
}

export function getCommissionById(id: string): CustomCommission | null {
  const row = db.prepare('SELECT data_json FROM commissions WHERE id = ?').get(id) as
    | { data_json: string }
    | undefined;
  return row ? (JSON.parse(row.data_json) as CustomCommission) : null;
}

export function findCommissionByRefAndEmail(
  referenceNumber: string,
  email: string
): CustomCommission | null {
  const cleanRef = referenceNumber.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanRef || !cleanEmail) return null;
  const rows = db
    .prepare('SELECT data_json FROM commissions WHERE LOWER(customer_email) = ? ORDER BY created_at DESC')
    .all(cleanEmail) as { data_json: string }[];
  for (const r of rows) {
    const comm = JSON.parse(r.data_json) as CustomCommission;
    if (comm.referenceNumber.toLowerCase() === cleanRef) return comm;
  }
  return null;
}

// --- Auth Helpers ---

export function getUserByEmail(email: string): (UserProfile & { passwordHash: string | null }) | null {
  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email.trim()) as DbUserRow | undefined;
  if (!row) return null;
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
  };
}

export function findUserForLogin(
  identifier: string
): (UserProfile & { passwordHash: string | null }) | null {
  const clean = identifier.trim();
  if (!clean) return null;

  const byEmail = getUserByEmail(clean);
  if (byEmail) return byEmail;

  if (!clean.includes('@')) {
    const matches = db
      .prepare('SELECT * FROM users WHERE LOWER(first_name) = LOWER(?)')
      .all(clean) as DbUserRow[];
    if (matches.length === 1) {
      return {
        ...mapUserRow(matches[0]),
        passwordHash: matches[0].password_hash,
      };
    }
    const adminMatch = matches.find((m) => m.role === 'ADMIN');
    if (adminMatch) {
      return {
        ...mapUserRow(adminMatch),
        passwordHash: adminMatch.password_hash,
      };
    }
  }

  return null;
}

export function getUserWithPasswordById(
  userId: string
): (UserProfile & { passwordHash: string | null }) | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
  if (!row) return null;
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
  };
}

export function getUserById(userId: string): UserProfile | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
  return row ? mapUserRow(row) : null;
}

interface DbOrderEmailRow {
  id: string;
  order_id: string;
  order_number: string;
  template: OrderEmailTemplate;
  recipient_email: string;
  registered_user_id: string | null;
  subject: string;
  text_body: string;
  html_body: string;
  provider: OrderEmailLog['provider'];
  provider_message_id: string | null;
  status: OrderEmailLog['status'];
  error_message: string | null;
  sent_at: string;
}

export function getOrderEmailLog(
  orderId: string,
  template: OrderEmailTemplate = 'order_confirmation'
): (OrderEmailLog & { textBody: string; htmlBody: string }) | null {
  const row = db
    .prepare('SELECT * FROM order_emails WHERE order_id = ? AND template = ?')
    .get(orderId, template) as DbOrderEmailRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    template: row.template,
    recipientEmail: row.recipient_email,
    registeredUserId: row.registered_user_id || undefined,
    subject: row.subject,
    provider: row.provider,
    providerMessageId: row.provider_message_id || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    sentAt: row.sent_at,
    textBody: row.text_body,
    htmlBody: row.html_body,
  };
}

export function getOrderEmailLogsForOrder(orderId: string): OrderEmailLog[] {
  const rows = db
    .prepare('SELECT * FROM order_emails WHERE order_id = ? ORDER BY sent_at DESC')
    .all(orderId) as DbOrderEmailRow[];
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    template: row.template,
    recipientEmail: row.recipient_email,
    registeredUserId: row.registered_user_id || undefined,
    subject: row.subject,
    provider: row.provider,
    providerMessageId: row.provider_message_id || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    sentAt: row.sent_at,
  }));
}

export function getAllOrderEmailLogs(): OrderEmailLog[] {
  const rows = db
    .prepare('SELECT * FROM order_emails ORDER BY sent_at DESC')
    .all() as DbOrderEmailRow[];
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    template: row.template,
    recipientEmail: row.recipient_email,
    registeredUserId: row.registered_user_id || undefined,
    subject: row.subject,
    provider: row.provider,
    providerMessageId: row.provider_message_id || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    sentAt: row.sent_at,
  }));
}

export function upsertOrderEmailLog(
  entry: OrderEmailLog & { textBody: string; htmlBody: string }
): OrderEmailLog {
  db.prepare(
    `INSERT INTO order_emails (
       id, order_id, order_number, template, recipient_email, registered_user_id,
       subject, text_body, html_body, provider, provider_message_id, status, error_message, sent_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id, template) DO UPDATE SET
       recipient_email = excluded.recipient_email,
       registered_user_id = excluded.registered_user_id,
       subject = excluded.subject,
       text_body = excluded.text_body,
       html_body = excluded.html_body,
       provider = excluded.provider,
       provider_message_id = excluded.provider_message_id,
       status = excluded.status,
       error_message = excluded.error_message,
       sent_at = excluded.sent_at`
  ).run(
    entry.id,
    entry.orderId,
    entry.orderNumber,
    entry.template,
    entry.recipientEmail,
    entry.registeredUserId || null,
    entry.subject,
    entry.textBody,
    entry.htmlBody,
    entry.provider,
    entry.providerMessageId || null,
    entry.status,
    entry.errorMessage || null,
    entry.sentAt
  );

  const saved = getOrderEmailLog(entry.orderId, entry.template);
  return saved
    ? {
        id: saved.id,
        orderId: saved.orderId,
        orderNumber: saved.orderNumber,
        template: saved.template,
        recipientEmail: saved.recipientEmail,
        registeredUserId: saved.registeredUserId,
        subject: saved.subject,
        provider: saved.provider,
        providerMessageId: saved.providerMessageId,
        status: saved.status,
        errorMessage: saved.errorMessage,
        sentAt: saved.sentAt,
      }
    : entry;
}

export function normalizeSeoPageKey(rawUrlOrKey: string): string {
  const trimmed = (rawUrlOrKey || '').trim();
  if (!trimmed) return '/';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.pathname || '/'}${parsed.search || ''}` || '/';
    } catch {
      return '/';
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

interface DbPageSeoRow {
  page_key: string;
  seo_title: string;
  meta_description: string;
  keywords: string;
  updated_at: string;
}

export function getAllPageSeoMetadata(): PageSeoMetadata[] {
  const rows = db
    .prepare('SELECT * FROM page_seo_metadata ORDER BY page_key ASC')
    .all() as DbPageSeoRow[];
  return rows.map((r) => ({
    pageKey: r.page_key,
    seoTitle: r.seo_title,
    metaDescription: r.meta_description,
    keywords: r.keywords,
    updatedAt: r.updated_at,
  }));
}

export function upsertPageSeoMetadata(entry: {
  pageKey: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
}): PageSeoMetadata {
  const normalizedKey = normalizeSeoPageKey(entry.pageKey);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO page_seo_metadata (page_key, seo_title, meta_description, keywords, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(page_key) DO UPDATE SET
       seo_title = excluded.seo_title,
       meta_description = excluded.meta_description,
       keywords = excluded.keywords,
       updated_at = excluded.updated_at`
  ).run(
    normalizedKey,
    entry.seoTitle.trim(),
    entry.metaDescription.trim(),
    entry.keywords.trim(),
    now
  );

  // Keep SiteSettings synced when the root homepage SEO is edited directly from SEO Audit
  if (normalizedKey === '/') {
    const current = getSiteSettings();
    updateSiteSettings({
      ...current,
      seoTitle: entry.seoTitle.trim() || current.seoTitle,
      seoDescription: entry.metaDescription.trim() || current.seoDescription,
      seoKeywords: entry.keywords.trim(),
    });
  }

  return {
    pageKey: normalizedKey,
    seoTitle: entry.seoTitle.trim(),
    metaDescription: entry.metaDescription.trim(),
    keywords: entry.keywords.trim(),
    updatedAt: now,
  };
}

export function deletePageSeoMetadata(pageKey: string): boolean {
  const normalizedKey = normalizeSeoPageKey(pageKey);
  const res = db
    .prepare('DELETE FROM page_seo_metadata WHERE page_key = ?')
    .run(normalizedKey);
  return res.changes > 0;
}

export function createEmailUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: UserRole;
}): UserProfile {
  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const cleanEmail = params.email.trim().toLowerCase();
  const role: UserRole = params.role ?? 'CUSTOMER';

  db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, password_hash, auth_provider, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'email', ?, ?)`
  ).run(
    id,
    cleanEmail,
    params.firstName.trim(),
    params.lastName.trim(),
    hashPassword(params.password),
    role,
    now
  );

  // Backfill link any existing guest orders placed with this email
  db.prepare('UPDATE orders SET user_id = ? WHERE user_id IS NULL AND LOWER(customer_email) = ?').run(
    id,
    cleanEmail
  );

  return {
    id,
    email: cleanEmail,
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    role,
    authProvider: 'email',
    createdAt: now,
  };
}

export function upsertGoogleUser(params: {
  email: string;
  firstName: string;
  lastName: string;
}): UserProfile {
  const cleanEmail = params.email.trim().toLowerCase();
  const existing = db
    .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
    .get(cleanEmail) as DbUserRow | undefined;

  if (existing) {
    return mapUserRow(existing);
  }

  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, password_hash, auth_provider, role, created_at)
     VALUES (?, ?, ?, ?, NULL, 'google', 'CUSTOMER', ?)`
  ).run(id, cleanEmail, params.firstName.trim() || 'Guest', params.lastName.trim(), now);

  // Link any existing guest orders with this email
  db.prepare('UPDATE orders SET user_id = ? WHERE user_id IS NULL AND LOWER(customer_email) = ?').run(
    id,
    cleanEmail
  );

  return {
    id,
    email: cleanEmail,
    firstName: params.firstName.trim() || 'Guest',
    lastName: params.lastName.trim(),
    role: 'CUSTOMER',
    authProvider: 'google',
    createdAt: now,
  };
}

export function updateUserName(userId: string, firstName: string, lastName: string): UserProfile | null {
  db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?').run(
    firstName.trim(),
    lastName.trim(),
    userId
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function updateUserPassword(userId: string, newPassword: string): boolean {
  const res = db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(hashPassword(newPassword), userId);
  return res.changes > 0;
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, expires.toISOString(), now.toISOString());
  return token;
}

export function getUserBySessionToken(token: string | undefined): UserProfile | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as DbUserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// --- Digital Gift Card Store & Redemption Helpers ---

interface DbGiftCardRow {
  id: string;
  code: string;
  initial_amount_cents: number;
  remaining_balance_cents: number;
  currency: string;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  message: string;
  purchase_payment_method: 'STRIPE' | 'CASH_ON_PICKUP' | 'ADMIN_ISSUED';
  purchase_status: GiftCardPurchaseStatus;
  stripe_payment_intent_id: string;
  is_active: number;
  order_number: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbGiftCardRedemptionRow {
  id: string;
  gift_card_id: string;
  gift_card_code: string;
  order_id: string;
  order_number: string;
  amount_cents: number;
  status: 'HELD' | 'COMMITTED' | 'RELEASED';
  expires_at: string | null;
  redeemed_at: string;
}

const GIFT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += GIFT_CODE_ALPHABET[bytes[i] % GIFT_CODE_ALPHABET.length];
  }
  return out;
}

export function generateUniqueGiftCardCode(): string {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = `PA-GIFT-${randomSegment(4)}-${randomSegment(4)}`;
    const existing = db
      .prepare('SELECT id FROM gift_cards WHERE UPPER(code) = ?')
      .get(candidate) as { id: string } | undefined;
    if (!existing) return candidate;
  }
  return `PA-GIFT-${Date.now().toString(36).toUpperCase().slice(-4)}-${randomSegment(4)}`;
}

export function getGiftCardAvailableBalanceCents(cardId: string, nowIso = new Date().toISOString()): number {
  const row = db
    .prepare('SELECT remaining_balance_cents FROM gift_cards WHERE id = ?')
    .get(cardId) as { remaining_balance_cents: number } | undefined;
  if (!row) return 0;
  const held = db
    .prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) as held FROM gift_card_redemptions WHERE gift_card_id = ? AND status = 'HELD' AND (expires_at IS NULL OR expires_at >= ?)"
    )
    .get(cardId, nowIso) as { held: number };
  return Math.max(0, row.remaining_balance_cents - held.held);
}

function mapGiftCardRow(row: DbGiftCardRow): GiftCard {
  return {
    id: row.id,
    code: row.code,
    initialAmountCents: row.initial_amount_cents,
    remainingBalanceCents: row.remaining_balance_cents,
    availableBalanceCents: getGiftCardAvailableBalanceCents(row.id),
    currency: 'NZD',
    purchaserName: row.purchaser_name,
    purchaserEmail: row.purchaser_email,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    message: row.message,
    purchasePaymentMethod: row.purchase_payment_method,
    purchaseStatus: row.purchase_status,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    isActive: row.is_active === 1,
    orderNumber: row.order_number,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commitDirectGiftCardDeductionTx(params: {
  code: string;
  amountCents: number;
  orderId: string;
  orderNumber: string;
  nowIso: string;
}): number {
  const cleanCode = params.code.trim().toUpperCase();
  const gcRow = db
    .prepare('SELECT * FROM gift_cards WHERE UPPER(code) = ?')
    .get(cleanCode) as DbGiftCardRow | undefined;

  if (!gcRow || gcRow.is_active !== 1 || gcRow.purchase_status !== 'ACTIVE') {
    throw new Error(`Gift card "${cleanCode}" is not active.`);
  }
  if (gcRow.expires_at && gcRow.expires_at <= params.nowIso) {
    throw new Error(`Gift card "${cleanCode}" has expired.`);
  }

  const held = db
    .prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) as held FROM gift_card_redemptions WHERE gift_card_id = ? AND status = 'HELD' AND (expires_at IS NULL OR expires_at >= ?)"
    )
    .get(gcRow.id, params.nowIso) as { held: number };
  const available = Math.max(0, gcRow.remaining_balance_cents - held.held);

  if (available < params.amountCents) {
    throw new Error(
      `Gift card "${cleanCode}" has $${(available / 100).toFixed(2)} NZD available, which is less than $${(params.amountCents / 100).toFixed(2)} NZD.`
    );
  }

  const nextRemaining = Math.max(0, gcRow.remaining_balance_cents - params.amountCents);
  const nextStatus: GiftCardPurchaseStatus = nextRemaining <= 0 ? 'REDEEMED' : 'ACTIVE';

  db.prepare(
    'UPDATE gift_cards SET remaining_balance_cents = ?, purchase_status = ?, updated_at = ? WHERE id = ?'
  ).run(nextRemaining, nextStatus, params.nowIso, gcRow.id);

  db.prepare(
    `INSERT INTO gift_card_redemptions (id, gift_card_id, gift_card_code, order_id, order_number, amount_cents, status, expires_at, redeemed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'COMMITTED', NULL, ?)`
  ).run(
    `gcr-${crypto.randomUUID()}`,
    gcRow.id,
    gcRow.code,
    params.orderId,
    params.orderNumber,
    params.amountCents,
    params.nowIso
  );

  return nextRemaining;
}

export function getAllGiftCards(): GiftCard[] {
  const rows = db
    .prepare('SELECT * FROM gift_cards ORDER BY created_at DESC')
    .all() as DbGiftCardRow[];
  return rows.map(mapGiftCardRow);
}

export function getGiftCardsForUser(user: UserProfile): GiftCard[] {
  const rows = db
    .prepare(
      'SELECT * FROM gift_cards WHERE LOWER(purchaser_email) = LOWER(?) OR LOWER(recipient_email) = LOWER(?) ORDER BY created_at DESC'
    )
    .all(user.email, user.email) as DbGiftCardRow[];
  return rows.map(mapGiftCardRow);
}

export function getGiftCardById(id: string): GiftCard | null {
  const row = db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(id) as
    | DbGiftCardRow
    | undefined;
  return row ? mapGiftCardRow(row) : null;
}

export function getGiftCardByCode(code: string): GiftCard | null {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const row = db
    .prepare('SELECT * FROM gift_cards WHERE UPPER(code) = ?')
    .get(clean) as DbGiftCardRow | undefined;
  return row ? mapGiftCardRow(row) : null;
}

export function getGiftCardByPaymentIntentId(paymentIntentId: string): GiftCard | null {
  if (!paymentIntentId.trim()) return null;
  const row = db
    .prepare('SELECT * FROM gift_cards WHERE stripe_payment_intent_id = ?')
    .get(paymentIntentId.trim()) as DbGiftCardRow | undefined;
  return row ? mapGiftCardRow(row) : null;
}

export function getGiftCardRedemptions(giftCardId?: string): GiftCardRedemption[] {
  const rows = (
    giftCardId
      ? db
          .prepare('SELECT * FROM gift_card_redemptions WHERE gift_card_id = ? ORDER BY redeemed_at DESC')
          .all(giftCardId)
      : db.prepare('SELECT * FROM gift_card_redemptions ORDER BY redeemed_at DESC LIMIT 200').all()
  ) as DbGiftCardRedemptionRow[];

  return rows.map((r) => ({
    id: r.id,
    giftCardId: r.gift_card_id,
    giftCardCode: r.gift_card_code,
    orderId: r.order_id,
    orderNumber: r.order_number,
    amountCents: r.amount_cents,
    status: r.status,
    expiresAt: r.expires_at || undefined,
    redeemedAt: r.redeemed_at,
  }));
}

export function validateGiftCardForCheckout(rawCode: string): GiftCardValidationResult {
  releaseExpiredReservations();
  const clean = rawCode.trim().toUpperCase();
  if (!clean) {
    return {
      valid: false,
      code: '',
      remainingBalanceCents: 0,
      initialAmountCents: 0,
      error: 'Please enter a gift card code.',
    };
  }

  const card = getGiftCardByCode(clean);
  if (!card) {
    return {
      valid: false,
      code: clean,
      remainingBalanceCents: 0,
      initialAmountCents: 0,
      error: `Gift card "${clean}" was not found.`,
    };
  }

  if (card.purchaseStatus === 'PENDING') {
    return {
      valid: false,
      code: card.code,
      remainingBalanceCents: 0,
      initialAmountCents: card.initialAmountCents,
      error: `Gift card "${card.code}" is awaiting payment confirmation.`,
    };
  }

  if (!card.isActive || card.purchaseStatus === 'PAUSED') {
    return {
      valid: false,
      code: card.code,
      remainingBalanceCents: 0,
      initialAmountCents: card.initialAmountCents,
      error: `Gift card "${card.code}" is currently paused.`,
    };
  }

  if (card.expiresAt && card.expiresAt <= new Date().toISOString()) {
    return {
      valid: false,
      code: card.code,
      remainingBalanceCents: 0,
      initialAmountCents: card.initialAmountCents,
      error: `Gift card "${card.code}" has expired.`,
    };
  }

  const available = card.availableBalanceCents ?? card.remainingBalanceCents;
  if (available <= 0) {
    return {
      valid: false,
      code: card.code,
      remainingBalanceCents: 0,
      initialAmountCents: card.initialAmountCents,
      error: `Gift card "${card.code}" has a $0.00 NZD remaining balance.`,
    };
  }

  return {
    valid: true,
    code: card.code,
    remainingBalanceCents: available,
    initialAmountCents: card.initialAmountCents,
    recipientName: card.recipientName,
    expiresAt: card.expiresAt,
  };
}

export function createGiftCardRecord(params: {
  amountCents: number;
  code?: string;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  message?: string;
  purchasePaymentMethod: 'STRIPE' | 'CASH_ON_PICKUP' | 'ADMIN_ISSUED';
  purchaseStatus: GiftCardPurchaseStatus;
  stripePaymentIntentId?: string;
  isActive: boolean;
  orderNumber?: string;
  expiresAt?: string;
}): GiftCard {
  const now = new Date().toISOString();
  const id = `gc-${crypto.randomUUID().slice(0, 12)}`;
  const code = params.code?.trim().toUpperCase() || generateUniqueGiftCardCode();
  const orderNumber =
    params.orderNumber?.trim() ||
    `PA-GC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  db.prepare(
    `INSERT INTO gift_cards (
       id, code, initial_amount_cents, remaining_balance_cents, currency,
       purchaser_name, purchaser_email, recipient_name, recipient_email, message,
       purchase_payment_method, purchase_status, stripe_payment_intent_id, is_active,
       order_number, expires_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'NZD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    code,
    Math.round(params.amountCents),
    Math.round(params.amountCents),
    params.purchaserName.trim(),
    params.purchaserEmail.trim().toLowerCase(),
    params.recipientName.trim(),
    params.recipientEmail.trim().toLowerCase(),
    (params.message || '').trim(),
    params.purchasePaymentMethod,
    params.purchaseStatus,
    params.stripePaymentIntentId || '',
    params.isActive ? 1 : 0,
    orderNumber,
    params.expiresAt || null,
    now,
    now
  );

  return getGiftCardById(id)!;
}

export function attachStripePaymentIntentToGiftCard(giftCardId: string, paymentIntentId: string): GiftCard | null {
  const now = new Date().toISOString();
  db.prepare('UPDATE gift_cards SET stripe_payment_intent_id = ?, updated_at = ? WHERE id = ?').run(
    paymentIntentId,
    now,
    giftCardId
  );
  return getGiftCardById(giftCardId);
}

export function activateGiftCardAtomic(params: {
  giftCardId?: string;
  paymentIntentId?: string;
  eventId?: string;
  eventType?: string;
}): { giftCard: GiftCard | null; newlyActivated: boolean } {
  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    if (params.eventId) {
      const seen = db
        .prepare('SELECT event_id FROM stripe_events WHERE event_id = ?')
        .get(params.eventId) as { event_id: string } | undefined;
      if (seen) {
        const existing =
          (params.giftCardId ? getGiftCardById(params.giftCardId) : null) ||
          (params.paymentIntentId ? getGiftCardByPaymentIntentId(params.paymentIntentId) : null);
        return { giftCard: existing, newlyActivated: false };
      }
      db.prepare('INSERT INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)').run(
        params.eventId,
        params.eventType || 'payment_intent.succeeded',
        now
      );
    }

    const row = (
      params.giftCardId
        ? db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(params.giftCardId)
        : params.paymentIntentId
        ? db
            .prepare('SELECT * FROM gift_cards WHERE stripe_payment_intent_id = ?')
            .get(params.paymentIntentId)
        : undefined
    ) as DbGiftCardRow | undefined;

    if (!row) return { giftCard: null, newlyActivated: false };
    const wasPending = row.purchase_status === 'PENDING';

    if (wasPending) {
      db.prepare(
        "UPDATE gift_cards SET purchase_status = 'ACTIVE', is_active = 1, stripe_payment_intent_id = COALESCE(NULLIF(?, ''), stripe_payment_intent_id), updated_at = ? WHERE id = ?"
      ).run(params.paymentIntentId || '', now, row.id);
    }

    return { giftCard: getGiftCardById(row.id), newlyActivated: wasPending };
  });

  return tx();
}

export function updateGiftCardAdmin(
  id: string,
  patch: {
    isActive?: boolean;
    purchaseStatus?: GiftCardPurchaseStatus;
    remainingBalanceCents?: number;
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
    expiresAt?: string | null;
  }
): GiftCard | null {
  const existing = getGiftCardById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextRemaining =
    typeof patch.remainingBalanceCents === 'number' && Number.isFinite(patch.remainingBalanceCents)
      ? Math.max(0, Math.round(patch.remainingBalanceCents))
      : existing.remainingBalanceCents;
  const nextIsActive =
    typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive;
  const nextStatus: GiftCardPurchaseStatus =
    patch.purchaseStatus ||
    (nextRemaining <= 0
      ? 'REDEEMED'
      : !nextIsActive && existing.purchaseStatus === 'ACTIVE'
      ? 'PAUSED'
      : nextIsActive && existing.purchaseStatus === 'PAUSED'
      ? 'ACTIVE'
      : existing.purchaseStatus);

  db.prepare(
    `UPDATE gift_cards SET
       remaining_balance_cents = ?,
       is_active = ?,
       purchase_status = ?,
       recipient_name = ?,
       recipient_email = ?,
       message = ?,
       expires_at = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(
    nextRemaining,
    nextIsActive ? 1 : 0,
    nextStatus,
    patch.recipientName !== undefined ? patch.recipientName.trim() : existing.recipientName,
    patch.recipientEmail !== undefined
      ? patch.recipientEmail.trim().toLowerCase()
      : existing.recipientEmail,
    patch.message !== undefined ? patch.message.trim() : existing.message,
    patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt || null,
    now,
    id
  );

  return getGiftCardById(id);
}

export function deleteGiftCard(id: string): boolean {
  const res = db.prepare('DELETE FROM gift_cards WHERE id = ?').run(id);
  return res.changes > 0;
}
