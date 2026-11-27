import { z } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors: Record<string, string> };

export function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Invalid input provided.';
  return first.message || 'Invalid input provided.';
}

export function extractZodFieldErrors(err: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  input: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    error: formatZodError(parsed.error),
    fieldErrors: extractZodFieldErrors(parsed.error),
  };
}

// --- Shared Primitives ---

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required.')
  .max(254, 'Email address is too long.')
  .email('Please enter a valid email address.');

export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Please enter a valid contact phone number.')
  .max(40, 'Phone number is too long.');

export function isSafeMediaUrlValue(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) return true;
  return false;
}

export const safeMediaUrlSchema = z
  .string()
  .trim()
  .max(4_000_000, 'Image payload is too large.')
  .refine(isSafeMediaUrlValue, {
    message: 'Image URL must start with https://, http://, /, or a safe image data URI.',
  });

export const optionalSafeHttpOrRelativeUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL is too long.')
  .refine(
    (val) => {
      if (!val) return true;
      return val.startsWith('/') || /^https?:\/\//i.test(val);
    },
    { message: 'URL must start with https://, http://, or /.' }
  );

// --- Authentication & Account Schemas ---

export const loginPayloadSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Email address or username is required.')
    .max(254, 'Email or username is too long.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(256, 'Password is too long.'),
});

export const registerPayloadSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(80, 'First name must be 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .max(80, 'Last name must be 80 characters or fewer.')
    .optional()
    .default(''),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(256, 'Password is too long.'),
});

export const registerFormSchema = registerPayloadSchema
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const googleAuthPayloadSchema = z
  .object({
    idToken: z.string().trim().min(1).optional(),
    accessToken: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.idToken || data.accessToken), {
    message: 'Google authentication token is required.',
  });

export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name cannot be empty.')
    .max(80, 'First name must be 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .max(80, 'Last name must be 80 characters or fewer.')
    .optional()
    .default(''),
});

export const passwordUpdatePayloadSchema = z.object({
  currentPassword: z.string().max(256).optional().default(''),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long.')
    .max(256, 'New password is too long.'),
});

export const passwordUpdateFormSchema = passwordUpdatePayloadSchema
  .extend({
    requireCurrent: z.boolean().optional().default(true),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .superRefine((data, ctx) => {
    if (data.requireCurrent && !data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPassword'],
        message: 'Current password is required.',
      });
    }
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmNewPassword'],
        message: 'New passwords do not match.',
      });
    }
  });

// --- Provenance & Authenticity Card Verification ---

export const provenanceVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Please enter a valid Certificate # or Provenance Code.')
    .max(80, 'Code is too long.')
    .transform((v) => v.toUpperCase()),
  buyer: z
    .string()
    .trim()
    .max(160, 'Owner name or email must be 160 characters or fewer.')
    .optional(),
});

export const certificateOwnerCheckSchema = z.object({
  owner: z
    .string()
    .trim()
    .min(2, 'Please enter the buyer name or checkout email to verify ownership.')
    .max(160, 'Owner input is too long.'),
});

// --- Checkout, Shipping & Order Schemas ---

export const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1, 'Invalid product selection.'),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(99, 'Maximum quantity per line is 99.'),
});

export const shippingAddressSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(3, 'Street address is required.')
    .max(200, 'Street address is too long.'),
  line2: z.string().trim().max(200, 'Address line 2 is too long.').optional().default(''),
  city: z.string().trim().min(2, 'City or town is required.').max(100, 'City name is too long.'),
  region: z.string().trim().min(2, 'Region is required.').max(100, 'Region name is too long.'),
  postcode: z
    .string()
    .trim()
    .min(3, 'Postcode is required.')
    .max(20, 'Postcode must be 20 characters or fewer.'),
  country: z
    .string()
    .trim()
    .min(2, 'Destination country is required.')
    .max(100, 'Country name is too long.')
    .default('New Zealand'),
  isRural: z.boolean().optional().default(false),
});

export const createPaymentIntentSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Your cart is empty.'),
  customerName: z
    .string()
    .trim()
    .min(2, 'Full name is required.')
    .max(120, 'Full name is too long.'),
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  shippingAddress: shippingAddressSchema,
  selectedServiceId: z.string().trim().max(100).optional(),
  discountCode: z.string().trim().max(60).optional(),
  giftCardCode: z.string().trim().max(60).optional(),
  orderNotes: z.string().trim().max(1000, 'Order notes cannot exceed 1000 characters.').optional(),
  previousOrderId: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

export const cashOnPickupCheckoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Your cart is empty.'),
  customerName: z
    .string()
    .trim()
    .min(2, 'Full name is required for studio pickup.')
    .max(120, 'Full name is too long.'),
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  pickupNotes: z.string().trim().max(500, 'Pickup notes cannot exceed 500 characters.').optional(),
  orderNotes: z.string().trim().max(1000, 'Order notes cannot exceed 1000 characters.').optional(),
  discountCode: z.string().trim().max(60).optional(),
  giftCardCode: z.string().trim().max(60).optional(),
});

export const giftCardCheckoutCompleteSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1, 'Your cart is empty.'),
    customerName: z
      .string()
      .trim()
      .min(2, 'Full name is required.')
      .max(120, 'Full name is too long.'),
    customerEmail: emailSchema,
    customerPhone: phoneSchema,
    fulfillmentMode: z.enum(['courier', 'pickup']).default('courier'),
    shippingAddress: shippingAddressSchema.optional(),
    pickupNotes: z.string().trim().max(500).optional(),
    orderNotes: z.string().trim().max(1000).optional(),
    selectedServiceId: z.string().trim().max(100).optional(),
    discountCode: z.string().trim().max(60).optional(),
    giftCardCode: z.string().trim().min(4, 'A valid gift card code is required.').max(60),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentMode === 'courier' && !data.shippingAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shippingAddress'],
        message: 'Complete shipping address is required for courier dispatch.',
      });
    }
  });

export const orderLookupQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Please enter your order reference number or checkout email.')
    .max(120, 'Search query is too long.'),
  email: emailSchema.optional(),
});

export const orderVerifyEmailSchema = z.object({
  email: emailSchema,
});

export const orderTrackingUpdateSchema = z.object({
  trackingNumber: z
    .string()
    .trim()
    .min(3, 'Please enter a valid courier tracking number.')
    .max(120, 'Tracking number is too long.'),
  actualCourierCostCents: z.coerce
    .number()
    .finite()
    .min(0, 'Courier cost cannot be negative.')
    .max(500_000, 'Courier cost exceeds allowed limit.')
    .optional(),
  courierName: z.string().trim().max(120).optional(),
  courierServiceName: z.string().trim().max(160).optional(),
  status: z
    .enum(['PENDING', 'PAID', 'PROCESSING', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'REFUNDED'])
    .optional(),
});

export const orderRefundSchema = z.object({
  amountCents: z.coerce
    .number()
    .int('Refund amount must be in whole cents.')
    .min(50, 'Minimum refund amount is $0.50 NZD.')
    .max(5_000_000)
    .optional(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).default('requested_by_customer'),
});

// --- Digital Gift Cards ---

export const giftCardValidateQuerySchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Please enter a valid gift card code.')
    .max(60, 'Gift card code is too long.')
    .transform((v) => v.toUpperCase()),
});

export const giftCardPurchaseSchema = z.object({
  amountCents: z.coerce
    .number()
    .int('Gift card value must be whole cents.')
    .min(2000, 'Gift card amount must be at least $20.00 NZD.')
    .max(200000, 'Gift card amount cannot exceed $2,000.00 NZD.'),
  purchaserName: z
    .string()
    .trim()
    .min(2, 'Your name is required.')
    .max(120, 'Purchaser name is too long.'),
  purchaserEmail: emailSchema,
  recipientName: z
    .string()
    .trim()
    .min(2, 'Recipient name is required.')
    .max(120, 'Recipient name is too long.'),
  recipientEmail: emailSchema,
  message: z
    .string()
    .trim()
    .max(280, 'Personal message must be 280 characters or fewer.')
    .optional()
    .default(''),
});

export const giftCardConfirmStripeSchema = z.object({
  giftCardId: z.string().trim().min(1, 'Gift card ID is required.'),
  paymentIntentId: z.string().trim().min(1, 'Stripe PaymentIntent ID is required.'),
});

export const giftCardConfirmPayPalSchema = z.object({
  giftCardId: z.string().trim().min(1, 'Gift card ID is required.'),
  paypalOrderId: z.string().trim().min(1, 'PayPal Order ID is required.'),
});

export const adminGiftCardCreateSchema = z.object({
  amountCents: z.coerce
    .number()
    .int()
    .min(500, 'Gift card value must be at least $5.00 NZD.')
    .max(500000, 'Gift card value cannot exceed $5,000.00 NZD.'),
  recipientName: z.string().trim().min(2, 'Recipient name is required.').max(120),
  recipientEmail: emailSchema,
  purchaserName: z.string().trim().max(120).optional(),
  purchaserEmail: emailSchema.optional(),
  code: z
    .string()
    .trim()
    .max(40, 'Custom code is too long.')
    .regex(/^[A-Z0-9-]*$/i, 'Custom code may only use letters, numbers, and hyphens.')
    .optional(),
  message: z.string().trim().max(280).optional(),
  expiresAt: z.string().trim().max(64).optional(),
  sendEmail: z.boolean().optional().default(true),
});

// --- Custom Atelier & Commissions ---

export const commissionCreateSchema = z.object({
  id: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(60).optional(),
  customerName: z
    .string()
    .trim()
    .min(2, 'Full name is required.')
    .max(120, 'Name is too long.'),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().max(40, 'Phone number is too long.').optional().default(''),
  material: z.string().trim().min(1, 'Please choose a stone material.').max(100),
  designType: z.string().trim().min(1, 'Please choose a design motif.').max(100),
  pendantSizeMm: z.coerce
    .number()
    .finite()
    .min(20, 'Minimum carving size is 20mm.')
    .max(250, 'Maximum carving size is 250mm.')
    .default(65),
  cordStyle: z.string().trim().max(160).optional().default('Traditional 4-Plait Black Waxed Cord'),
  bindingStyle: z
    .string()
    .trim()
    .max(160)
    .optional()
    .default('Traditional Cross-Lash with Bone Toggle'),
  specialNotes: z.string().trim().max(3000, 'Notes cannot exceed 3000 characters.').optional().default(''),
  budgetRange: z.string().trim().max(100).optional(),
  referenceImageUrl: safeMediaUrlSchema.optional(),
  mode: z.enum(['configurator', 'direct-quote']).optional(),
  includePauaEye: z.boolean().optional(),
  includeHardwoodBox: z.boolean().optional(),
  status: z.string().optional(),
  quoteAmountCents: z.number().nonnegative().optional(),
  depositAmountCents: z.number().nonnegative().optional(),
  leadTimeWeeks: z.number().int().positive().max(52).optional(),
  messages: z.array(z.any()).optional(),
  createdAt: z.string().optional(),
});

export const commissionDirectQuoteFormSchema = z.object({
  customerName: z.string().trim().min(2, 'Please provide your full name.').max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().max(40).optional().default(''),
  specialNotes: z
    .string()
    .trim()
    .min(10, 'Please describe your design idea and carving notes (minimum 10 characters).')
    .max(3000),
  rightsConfirmed: z.literal(true, {
    error: 'Please confirm you have the right to request this custom carving before submitting.',
  }),
});

export const commissionLookupSchema = z.object({
  ref: z
    .string()
    .trim()
    .min(3, 'Commission reference number is required (e.g. CC-2026-...).')
    .max(80)
    .transform((v) => v.toUpperCase()),
  email: emailSchema,
});

export const commissionMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Message text cannot be empty.')
    .max(2000, 'Message cannot exceed 2000 characters.'),
  sender: z.enum(['customer', 'carver']).optional(),
  customerEmail: z.string().trim().max(254).optional(),
  email: z.string().trim().max(254).optional(),
});

export const commissionAdminUpdateSchema = z.object({
  status: z.enum([
    'REQUESTED',
    'QUOTED',
    'ACCEPTED',
    'DEPOSIT_PAID',
    'IN_PRODUCTION',
    'QUALITY_CHECK',
    'READY',
    'SHIPPED',
  ]),
  quoteAmountCents: z.coerce.number().int().min(0).max(5_000_000).optional(),
  depositAmountCents: z.coerce.number().int().min(0).max(5_000_000).optional(),
  leadTimeWeeks: z.coerce.number().int().min(1, 'Lead time must be at least 1 week.').max(52).optional(),
});

// --- Catalogue, Gallery, Wishlist, Courier & Admin Schemas ---

export const productPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(60).optional().default(''),
  title: z.string().trim().min(2, 'Taonga title must be at least 2 characters.').max(160),
  slug: z.string().trim().max(200).optional(),
  priceCents: z.coerce
    .number()
    .int('Price must be integer cents.')
    .min(100, 'Price must be at least $1.00 NZD.')
    .max(10_000_000),
  compareAtPriceCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  costPriceCents: z.coerce.number().int().min(0, 'Cost price cannot be negative.').max(10_000_000),
  weightGrams: z.coerce.number().int().min(1, 'Weight must be at least 1g.').max(50_000),
  defaultPackageSize: z.enum(['BAG-S', 'BAG-M', 'BOX-1', 'BOX-2']),
  quantity: z.coerce.number().int().min(0, 'Stock quantity cannot be negative.').max(10_000),
  isUniquePiece: z.boolean(),
  isMadeToOrder: z.boolean(),
  material: z.string().trim().min(1, 'Stone material is required.').max(100),
  designType: z.string().trim().min(1, 'Design motif is required.').max(100),
  authenticityCode: z.string().trim().max(80).optional().default(''),
  originRiver: z.string().trim().min(2, 'Origin river is required.').max(160),
  permitRef: z.string().trim().max(120).optional(),
  isExportRestricted: z.boolean(),
  description: z.string().trim().max(4000).optional().default(''),
  spiritualMeaning: z.string().trim().max(2000).optional().default(''),
  dimensions: z.string().trim().max(120).optional().default(''),
  cordDetails: z.string().trim().max(200).optional().default(''),
  carverName: z.string().trim().min(1).max(100).optional().default('Jesse'),
  images: z.array(safeMediaUrlSchema).min(1, 'At least one product image URL is required.'),
  featured: z.boolean().optional().default(true),
  published: z.boolean().optional().default(true),
});

export const bulkProductImportSchema = z.object({
  mode: z.enum(['upsert', 'create_only']).default('upsert'),
  products: z
    .array(productPayloadSchema)
    .min(1, 'CSV import must contain at least 1 valid product row.')
    .max(500, 'Maximum 500 products per CSV import batch.'),
});

export const galleryItemSchema = z.object({
  id: z.string().trim().max(120).optional(),
  title: z.string().trim().min(2, 'Gallery piece title is required.').max(160),
  material: z.string().trim().min(1, 'Stone material is required.').max(100),
  designType: z.string().trim().min(1, 'Design motif is required.').max(100),
  originRiver: z.string().trim().max(160).optional(),
  authenticityCode: z.string().trim().max(80).optional(),
  dimensions: z.string().trim().max(120).optional(),
  description: z.string().trim().max(3000).optional(),
  storyNote: z.string().trim().max(2000).optional(),
  imageUrl: safeMediaUrlSchema.optional(),
  carvedYear: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v !== undefined && v !== null ? String(v).trim() : '')),
  originalPriceCents: z.coerce.number().int().min(0).optional(),
  carverName: z.string().trim().max(100).optional(),
  createdAt: z.string().optional(),
});

export const discountRuleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Promo code must be at least 2 characters.')
      .max(40, 'Promo code is too long.')
      .regex(/^[A-Z0-9_-]+$/i, 'Promo code may only contain letters, numbers, underscores, or hyphens.')
      .transform((v) => v.toUpperCase()),
    type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']),
    value: z.coerce.number().int().min(0, 'Discount value cannot be negative.'),
    minSpendCents: z.coerce.number().int().min(0).optional(),
    description: z.string().trim().max(240).optional().default(''),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENTAGE' && (data.value < 1 || data.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage discount must be between 1% and 100%.',
      });
    }
    if (data.type === 'FIXED' && data.value < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Fixed discount must be at least $1.00 NZD.',
      });
    }
  });

export const wishlistPayloadSchema = z.object({
  itemId: z.string().trim().min(1, 'Item ID is required.').max(120),
  itemKind: z.enum(['product', 'gallery']).default('product'),
  title: z.string().trim().min(1, 'Title is required.').max(160),
  material: z.string().trim().min(1, 'Material is required.').max(100),
  designType: z.string().trim().min(1, 'Design type is required.').max(100),
  priceCents: z.coerce.number().int().min(0).optional(),
  image: safeMediaUrlSchema.optional().default(''),
  authenticityCode: z.string().trim().max(80).optional(),
  originRiver: z.string().trim().max(160).optional(),
});

export const courierRatePatchSchema = z.object({
  priceCents: z.coerce
    .number()
    .int('Rate must be in whole cents.')
    .min(0, 'Courier rate cannot be negative.')
    .max(500_000, 'Courier rate exceeds limit.'),
});

export const bulkRaiseRatesSchema = z.object({
  percent: z.coerce
    .number()
    .finite()
    .min(-90, 'Decrease cannot exceed -90%.')
    .max(500, 'Increase cannot exceed +500%.'),
});

export const paymentSettingsSchema = z
  .object({
    stripeEnabled: z.boolean().optional(),
    stripeMode: z.enum(['test', 'live']).optional(),
    stripePublishableKey: z.string().trim().max(240).optional(),
    stripeStatementDescriptor: z.string().trim().max(22, 'Statement descriptor max 22 characters.').optional(),
    stripeSecretKey: z.string().trim().max(240).optional(),
    stripeWebhookSecret: z.string().trim().max(240).optional(),
    paypalEnabled: z.boolean().optional(),
    paypalMode: z.enum(['sandbox', 'live']).optional(),
    paypalClientId: z.string().trim().max(240).optional(),
    paypalClientSecret: z.string().trim().max(240).optional(),
    paypalWebhookId: z.string().trim().max(240).optional(),
    cashOnPickupEnabled: z.boolean().optional(),
    cashOnPickupInstructions: z.string().trim().max(600).optional(),
    clearSecretKey: z.boolean().optional(),
    clearWebhookSecret: z.boolean().optional(),
    clearPaypalSecret: z.boolean().optional(),
    clearPaypalWebhookId: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.stripePublishableKey &&
      !data.stripePublishableKey.startsWith('pk_')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stripePublishableKey'],
        message: 'Stripe Publishable Key must start with pk_test_ or pk_live_.',
      });
    }
    if (data.stripeSecretKey && !data.stripeSecretKey.startsWith('sk_') && !data.stripeSecretKey.startsWith('rk_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stripeSecretKey'],
        message: 'Stripe Secret Key must start with sk_test_ or sk_live_.',
      });
    }
    if (data.stripeWebhookSecret && !data.stripeWebhookSecret.startsWith('whsec_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stripeWebhookSecret'],
        message: 'Stripe Webhook Secret must start with whsec_.',
      });
    }
    if (data.paypalClientId && data.paypalClientId.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paypalClientId'],
        message: 'PayPal Client ID appears too short.',
      });
    }
    if (data.paypalClientSecret && data.paypalClientSecret.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paypalClientSecret'],
        message: 'PayPal Client Secret appears too short.',
      });
    }
  });

export const policiesSettingsSchema = z.object({
  termsAndConditionsText: z.string().trim().min(10, 'Terms & Conditions cannot be empty.'),
  privacyPolicyText: z.string().trim().min(10, 'Privacy Policy cannot be empty.'),
  shippingAndReturnsPolicyText: z.string().trim().min(10, 'Shipping & Returns policy cannot be empty.'),
  customCommissionsPolicyText: z.string().trim().min(10, 'Custom Commissions policy cannot be empty.'),
  authenticityPolicyText: z.string().trim().min(10, 'Authenticity notice cannot be empty.'),
  returnPolicyDays: z.coerce.number().int().min(0, 'Return window cannot be negative.').max(365),
});

export const seoSettingsSchema = z.object({
  seoTitle: z.string().trim().min(1, 'Homepage SEO title is required.').max(120),
  seoDescription: z.string().trim().max(320),
  seoKeywords: z.string().trim().max(400),
  ogTitle: z.string().trim().max(120),
  ogDescription: z.string().trim().max(320),
  ogImageUrl: safeMediaUrlSchema.optional(),
  ogSiteName: z.string().trim().max(120).optional(),
  twitterCardType: z.enum(['summary_large_image', 'summary']),
  canonicalUrl: optionalSafeHttpOrRelativeUrlSchema.optional(),
  allowSearchIndexing: z.boolean(),
});

export const pageSeoAuditEntrySchema = z.object({
  pageKey: z.string().trim().min(1, 'Page key is required.').max(80),
  seoTitle: z.string().trim().max(120),
  metaDescription: z.string().trim().max(320),
  keywords: z.string().trim().max(400),
});

export const loginServerPayloadSchema = z
  .object({
    email: z.string().trim().max(254).optional(),
    username: z.string().trim().max(254).optional(),
    password: z.string().min(1, 'Password is required.').max(256),
  })
  .refine((data) => Boolean((data.email || data.username || '').trim()), {
    message: 'Email or username is required.',
    path: ['email'],
  });

export const confirmStripeStatusSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required.').max(120),
  paymentIntentId: z.string().trim().min(1, 'paymentIntentId is required.').max(200),
});

export const paypalCaptureOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required.').max(120),
  paypalOrderId: z.string().trim().min(1, 'paypalOrderId is required.').max(200),
});

export const paypalCancelOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId is required.').max(120),
  paypalOrderId: z.string().trim().max(200).optional(),
});

export const courierUpdateSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Courier name is required.').max(120),
  trackingUrlTemplate: z.string().trim().max(400).optional().default(''),
  isActive: z.boolean(),
  services: z.array(
    z.object({
      id: z.string().trim().min(1),
      courierId: z.string().trim().min(1),
      name: z.string().trim().min(1, 'Service name is required.').max(160),
      requiresSignature: z.boolean(),
      deliveryEstimateDays: z.string().trim().max(100),
      freeOverAmountCents: z.coerce.number().int().min(0).optional(),
      maxOrderValueCents: z.coerce.number().int().min(0).optional(),
      isActive: z.boolean(),
    })
  ),
});

export const customPricingConfigSchema = z.object({
  materialBaseCents: z.record(z.string(), z.coerce.number().int().min(0)),
  designMultiplier: z.record(z.string(), z.coerce.number().finite().min(0.1).max(20)),
  sizeMultiplier: z.object({
    small45: z.coerce.number().finite().min(0.1).max(20),
    medium65: z.coerce.number().finite().min(0.1).max(20),
    large85: z.coerce.number().finite().min(0.1).max(20),
  }),
  stoneOptions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(400),
        baseCents: z.coerce.number().int().min(0).max(5_000_000),
      })
    )
    .optional(),
  designOptions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        label: z.string().trim().min(1).max(120),
        meaning: z.string().trim().max(400),
        multiplier: z.coerce.number().finite().min(0.1).max(20),
        previewImageUrl: safeMediaUrlSchema.optional(),
      })
    )
    .optional(),
  sizeOptions: z
    .array(
      z.object({
        mm: z.coerce.number().int().min(15).max(300),
        label: z.string().trim().min(1).max(120),
        multiplier: z.coerce.number().finite().min(0.1).max(20),
      })
    )
    .optional(),
  pauaEyeCents: z.coerce.number().int().min(0).max(500_000),
  hardwoodBoxCents: z.coerce.number().int().min(0).max(500_000),
  cordOptions: z.array(z.string().trim().min(1).max(160)),
  bindingOptions: z.array(z.string().trim().min(1).max(160)),
});

export const SOCIAL_PLATFORM_VALUES = [
  'FACEBOOK',
  'INSTAGRAM',
  'YOUTUBE',
  'RUMBLE',
  'X',
  'TIKTOK',
  'PINTEREST',
  'LINKEDIN',
  'THREADS',
  'DISCORD',
  'WHATSAPP',
  'WEBSITE',
] as const;

export const socialPlatformSchema = z.enum(SOCIAL_PLATFORM_VALUES);

export const safeSocialHttpUrlSchema = z
  .string()
  .trim()
  .min(1, 'Please enter a social media URL.')
  .max(2048, 'Social URL is too long.')
  .refine(
    (val) => {
      if (!/^https?:\/\//i.test(val)) return false;
      try {
        const parsed = new URL(val);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid web URL starting with https:// or http://.' }
  );

export const socialLinkSchema = z.object({
  id: z.string().trim().min(1).max(120),
  platform: socialPlatformSchema,
  url: safeSocialHttpUrlSchema,
  label: z.string().trim().max(80).optional(),
});

export const siteSettingsUpdateSchema = z
  .object({
    siteName: z.string().trim().min(1, 'Studio name is required.').max(120),
    tagline: z.string().trim().max(240),
    logoUrl: safeMediaUrlSchema.optional(),
    faviconUrl: safeMediaUrlSchema.optional(),
    announcementBanner: z.string().trim().max(400),
    announcementEnabled: z.boolean(),
    gstNumber: z.string().trim().max(60),
    workshopAddress: z.string().trim().min(2, 'Workshop address is required.').max(240),
    contactEmail: emailSchema,
    contactPhone: z.string().trim().max(40),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Primary colour must be a valid 6-digit hex code.'),
    accentColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Accent colour must be a valid 6-digit hex code.'),
    authenticityPolicyText: z.string().trim().min(1),
    termsAndConditionsText: z.string().trim().min(1),
    privacyPolicyText: z.string().trim().min(1),
    shippingAndReturnsPolicyText: z.string().trim().min(1),
    customCommissionsPolicyText: z.string().trim().min(1),
    returnPolicyDays: z.coerce.number().int().min(0).max(365),
    allowEmailRegistration: z.boolean(),
    allowGmailOAuth: z.boolean(),
    googleClientId: z.string().trim().max(240).optional(),
    seoTitle: z.string().trim().min(1).max(120),
    seoDescription: z.string().trim().max(320),
    seoKeywords: z.string().trim().max(400).optional(),
    ogTitle: z.string().trim().max(120),
    ogDescription: z.string().trim().max(320),
    ogImageUrl: safeMediaUrlSchema.optional(),
    ogSiteName: z.string().trim().max(120).optional(),
    twitterCardType: z.enum(['summary_large_image', 'summary']),
    canonicalUrl: optionalSafeHttpOrRelativeUrlSchema.optional(),
    allowSearchIndexing: z.boolean(),
    stripeEnabled: z.boolean(),
    stripeMode: z.enum(['test', 'live']),
    stripePublishableKey: z.string().trim().max(240).optional(),
    stripeStatementDescriptor: z.string().trim().max(22).optional(),
    paypalEnabled: z.boolean().optional(),
    paypalMode: z.enum(['sandbox', 'live']).optional(),
    paypalClientId: z.string().trim().max(240).optional(),
    cashOnPickupEnabled: z.boolean().optional(),
    cashOnPickupInstructions: z.string().trim().max(600).optional(),
    socialLinks: z.array(socialLinkSchema).max(24, 'Maximum 24 social links allowed.').optional(),
  })
  .passthrough();

export const adminGiftCardPatchSchema = z.object({
  isActive: z.boolean().optional(),
  purchaseStatus: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'REDEEMED']).optional(),
  remainingBalanceCents: z.coerce.number().int().min(0).max(500_000).optional(),
  recipientName: z.string().trim().min(1).max(120).optional(),
  recipientEmail: emailSchema.optional(),
  message: z.string().trim().max(280).optional(),
  expiresAt: z.string().trim().max(64).nullable().optional(),
  activateAndEmail: z.boolean().optional(),
});

export const orderPatchAdminSchema = z
  .object({
    status: z
      .enum(['PENDING', 'PAID', 'PROCESSING', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'REFUNDED'])
      .optional(),
    paymentStatus: z.enum(['UNPAID', 'PAID', 'PAY_ON_PICKUP', 'REFUNDED']).optional(),
    trackingNumber: z.string().trim().max(120).optional(),
    actualCourierCostCents: z.coerce.number().finite().min(0).max(500_000).optional(),
    shippedAt: z.string().optional(),
    deliveredAt: z.string().optional(),
  })
  .passthrough();

export const commissionAcceptSchema = z.object({
  email: z.string().trim().max(254).optional(),
});

export const commissionStatusUpdateSchema = z.object({
  status: z.enum([
    'REQUESTED',
    'QUOTED',
    'ACCEPTED',
    'DEPOSIT_PAID',
    'IN_PRODUCTION',
    'QUALITY_CHECK',
    'READY',
    'SHIPPED',
  ]),
});

// --- Express GET Route Query Schemas ---

export const provenanceLookupRouteQuerySchema = z.object({
  code: z.string().trim().max(120, 'Code is too long.').optional(),
  cert: z.string().trim().max(120, 'Certificate code is too long.').optional(),
  buyer: z.string().trim().max(160, 'Buyer query is too long.').optional(),
});

export const orderLookupRouteQuerySchema = z.object({
  q: z.string().trim().max(160, 'Search query is too long.').optional(),
  email: z.string().trim().max(254, 'Email is too long.').optional(),
});

export const giftCardValidateRouteQuerySchema = z.object({
  code: z.string().trim().max(80, 'Gift card code is too long.').optional(),
});

export const commissionLookupRouteQuerySchema = z.object({
  ref: z.string().trim().max(80, 'Reference code is too long.').optional(),
  email: z.string().trim().max(254, 'Email is too long.').optional(),
});

// --- AI Search & Agentic Commerce Schemas ---

export const agentCatalogQuerySchema = z.object({
  q: z.string().trim().max(160, 'Search query is too long.').optional(),
  material: z.string().trim().max(80, 'Material filter is too long.').optional(),
  design: z.string().trim().max(80, 'Design filter is too long.').optional(),
  inStock: z
    .enum(['true', 'false', '1', '0'])
    .optional(),
  maxPriceNzd: z.coerce
    .number()
    .finite()
    .min(0, 'Maximum price cannot be negative.')
    .max(100_000, 'Maximum price exceeds limit.')
    .optional(),
  limit: z.coerce
    .number()
    .int('Limit must be a whole number.')
    .min(1, 'Limit must be at least 1.')
    .max(100, 'Limit cannot exceed 100.')
    .optional()
    .default(50),
});

export const agentCartCreateSchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, 'At least one product item is required.')
    .max(25, 'Agent cart cannot exceed 25 line items.'),
  discountCode: z.string().trim().max(60, 'Promo code is too long.').optional(),
  selectedServiceId: z.string().trim().max(100, 'Courier service ID is too long.').optional(),
  paymentMethod: z.enum(['STRIPE', 'PAYPAL', 'CASH_ON_PICKUP']).optional().default('STRIPE'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters.').optional(),
});
