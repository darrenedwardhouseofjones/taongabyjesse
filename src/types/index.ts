export type StoneVariety = string;

export type DesignMotif = string;

export type PackageSizeCode = 'BAG-S' | 'BAG-M' | 'BOX-1' | 'BOX-2';

export interface Product {
  id: string;
  sku: string;
  title: string;
  slug: string;
  priceCents: number; // GST-inclusive integer cents
  compareAtPriceCents?: number;
  costPriceCents: number;
  weightGrams: number;
  defaultPackageSize: PackageSizeCode;
  quantity: number;
  isUniquePiece: boolean; // 1-of-1 piece requiring reservation
  isMadeToOrder: boolean;
  material: StoneVariety;
  designType: DesignMotif;
  authenticityCode: string; // Ngāi Tahu verification serial code e.g. NT-89210-AR
  originRiver: string; // e.g., Arahura River, West Coast
  permitRef?: string; // DOC permit reference for marine mammal bone if applicable
  isExportRestricted: boolean; // True for whale bone or oversized stones
  description: string;
  spiritualMeaning: string;
  dimensions: string; // e.g. 62mm × 28mm × 8mm
  cordDetails: string; // e.g. Hand-plaited black waxed cord with adjustable slipknot
  carverName: string;
  images: string[];
  featured: boolean;
  published: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedCord?: string;
  reservationExpiresAt?: number; // Unix timestamp
}

export interface CourierService {
  id: string;
  courierId: string;
  name: string; // e.g. "NZ Post Courier - Signature Required"
  requiresSignature: boolean;
  deliveryEstimateDays: string; // e.g. "1-2 business days"
  freeOverAmountCents?: number;
  maxOrderValueCents?: number; // Force signature if above this value
  isActive: boolean;
}

export interface Courier {
  id: string;
  name: string; // "NZ Post" or "Aramex NZ"
  trackingUrlTemplate: string; // https://www.nzpost.co.nz/tools/tracking?track={TRACKING}
  isActive: boolean;
  services: CourierService[];
}

export interface PackageSize {
  code: PackageSizeCode;
  name: string;
  maxWeightGrams: number;
  dimensions: string; // e.g. 210 x 150 x 30 mm
}

export interface CourierRate {
  id: string;
  courierServiceId: string;
  packageSizeCode: PackageSizeCode;
  priceCents: number; // Integer cents
}

export interface ShippingCalculation {
  recommendedPackageSize: PackageSizeCode;
  totalWeightGrams: number;
  availableServices: {
    service: CourierService;
    courierName: string;
    rateCents: number;
    isFree: boolean;
  }[];
}

export interface CustomCommissionMessage {
  id: string;
  sender: 'customer' | 'carver';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface CustomCommission {
  id: string;
  referenceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  material: StoneVariety;
  designType: DesignMotif;
  pendantSizeMm: number;
  cordStyle: string;
  bindingStyle: string;
  specialNotes: string;
  budgetRange: string;
  referenceImageUrl?: string;
  status:
    | 'REQUESTED'
    | 'QUOTED'
    | 'ACCEPTED'
    | 'DEPOSIT_PAID'
    | 'IN_PRODUCTION'
    | 'QUALITY_CHECK'
    | 'READY'
    | 'SHIPPED';
  quoteAmountCents?: number;
  depositAmountCents?: number;
  leadTimeWeeks?: number;
  messages: CustomCommissionMessage[];
  createdAt: string;
}

export interface OrderItemSnapshot {
  productId: string;
  title: string;
  sku: string;
  priceCents: number;
  material: StoneVariety;
  authenticityCode: string;
  originRiver: string;
  quantity: number;
  image: string;
}

export type PaymentMethod = 'STRIPE' | 'CASH_ON_PICKUP' | 'GIFT_CARD';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'PAY_ON_PICKUP' | 'REFUNDED';

export type GiftCardPurchaseStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REDEEMED';

export interface GiftCard {
  id: string;
  code: string;
  initialAmountCents: number;
  remainingBalanceCents: number;
  availableBalanceCents?: number;
  currency: 'NZD';
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  purchasePaymentMethod: 'STRIPE' | 'CASH_ON_PICKUP' | 'ADMIN_ISSUED';
  purchaseStatus: GiftCardPurchaseStatus;
  stripePaymentIntentId: string;
  isActive: boolean;
  orderNumber: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardRedemption {
  id: string;
  giftCardId: string;
  giftCardCode: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
  status: 'HELD' | 'COMMITTED' | 'RELEASED';
  expiresAt?: string;
  redeemedAt: string;
}

export interface GiftCardValidationResult {
  valid: boolean;
  code: string;
  remainingBalanceCents: number;
  initialAmountCents: number;
  recipientName?: string;
  expiresAt?: string;
  error?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postcode: string;
    country: string;
    isRural: boolean;
  };
  items: OrderItemSnapshot[];
  courierName: string;
  courierServiceName: string;
  packageSizeCode: PackageSizeCode;
  shippingCents: number;
  subtotalCents: number;
  discountCents: number;
  discountCode?: string;
  giftCardCode?: string;
  giftCardAppliedCents?: number;
  gstCents: number; // 15% GST included
  totalCents: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  pickupNotes?: string;
  orderNotes?: string;
  stripePaymentIntentId: string;
  stripeFeeCents: number;
  netCents: number;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'FULFILLING' | 'SHIPPED' | 'DELIVERED' | 'REFUNDED';
  trackingNumber?: string;
  actualCourierCostCents?: number;
  refundedAmountCents?: number;
  stripeRefundId?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export type OrderEmailTemplate =
  | 'order_confirmation'
  | 'order_status_paid'
  | 'order_status_processing'
  | 'order_status_fulfilling'
  | 'order_status_shipped'
  | 'order_status_delivered'
  | 'order_status_refunded'
  | 'order_status_pending'
  | 'gift_card_issued';

export interface OrderEmailLog {
  id: string;
  orderId: string;
  orderNumber: string;
  template: OrderEmailTemplate;
  recipientEmail: string;
  registeredUserId?: string;
  subject: string;
  provider: 'resend' | 'smtp' | 'outbox';
  providerMessageId?: string;
  status: 'SENT' | 'LOGGED_NO_PROVIDER' | 'FAILED';
  errorMessage?: string;
  sentAt: string;
}

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  authProvider: 'email' | 'google';
  createdAt: string;
}

export type PolicySectionKey = 'terms' | 'privacy' | 'shipping' | 'custom' | 'authenticity';

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  announcementBanner: string;
  announcementEnabled: boolean;
  gstNumber: string; // NZ GST registration
  workshopAddress: string;
  contactEmail: string;
  contactPhone: string;
  primaryColor: string;
  accentColor: string;
  authenticityPolicyText: string;
  termsAndConditionsText: string;
  privacyPolicyText: string;
  shippingAndReturnsPolicyText: string;
  customCommissionsPolicyText: string;
  legalNoticeUpdatedAt?: string;
  returnPolicyDays: number;
  allowEmailRegistration: boolean;
  allowGmailOAuth: boolean;
  googleClientId?: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl?: string;
  ogSiteName?: string;
  twitterCardType: 'summary_large_image' | 'summary';
  canonicalUrl?: string;
  allowSearchIndexing: boolean;
  stripeEnabled: boolean;
  stripeMode: 'test' | 'live';
  stripePublishableKey?: string;
  stripeStatementDescriptor?: string;
  cashOnPickupEnabled?: boolean;
  cashOnPickupInstructions?: string;
}

export interface PageSeoMetadata {
  pageKey: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  updatedAt: string;
}

export interface DiscountRule {
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  value: number; // Percentage (e.g. 10) or integer cents (e.g. 2500)
  minSpendCents?: number;
  description: string;
  isActive: boolean;
}

export interface CustomStoneOption {
  name: string;
  description: string;
  baseCents: number;
}

export interface CustomDesignOption {
  name: string;
  label: string;
  meaning: string;
  multiplier: number;
  previewImageUrl?: string;
}

export interface CustomSizeOption {
  mm: number;
  label: string;
  multiplier: number;
}

export interface CustomPricingConfig {
  materialBaseCents: Record<string, number>;
  designMultiplier: Record<string, number>;
  sizeMultiplier: {
    small45: number;
    medium65: number;
    large85: number;
  };
  stoneOptions?: CustomStoneOption[];
  designOptions?: CustomDesignOption[];
  sizeOptions?: CustomSizeOption[];
  pauaEyeCents: number;
  hardwoodBoxCents: number;
  cordOptions: string[];
  bindingOptions: string[];
}

export interface AdminPaymentSettingsView {
  stripeEnabled: boolean;
  stripeMode: 'test' | 'live';
  stripePublishableKey: string;
  stripeStatementDescriptor: string;
  cashOnPickupEnabled: boolean;
  cashOnPickupInstructions: string;
  hasSecretKey: boolean;
  secretKeyMasked: string;
  hasWebhookSecret: boolean;
  webhookSecretMasked: string;
  secretSource: 'database' | 'env' | 'none';
  webhookSource: 'database' | 'env' | 'none';
}

export interface GalleryItem {
  id: string;
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  originRiver: string;
  authenticityCode: string;
  dimensions: string;
  description: string;
  storyNote?: string;
  imageUrl: string;
  carvedYear: string;
  originalPriceCents?: number;
  carverName: string;
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  itemId: string;
  itemKind: 'product' | 'gallery';
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  priceCents?: number;
  image: string;
  authenticityCode?: string;
  originRiver?: string;
  isAvailableNow: boolean;
  createdAt: string;
}

export interface CustomInspirationTemplate {
  sourceId: string;
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  authenticityCode?: string;
  originRiver?: string;
  imageUrl?: string;
}
