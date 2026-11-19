import type {
  CartItem,
  CourierRate,
  CourierService,
  CustomPricingConfig,
  DesignMotif,
  DiscountRule,
  PackageSize,
  PackageSizeCode,
  PaymentMethod,
  StoneVariety,
} from '../types/index.ts';

export const PACKAGE_SIZES: Record<PackageSizeCode, PackageSize> = {
  'BAG-S': {
    code: 'BAG-S',
    name: 'Small Padded Courier Bag (Pendant)',
    maxWeightGrams: 500,
    dimensions: '190 × 260 mm',
  },
  'BAG-M': {
    code: 'BAG-M',
    name: 'Medium Padded Bag (Multiple Taonga)',
    maxWeightGrams: 1500,
    dimensions: '250 × 325 mm',
  },
  'BOX-1': {
    code: 'BOX-1',
    name: 'Rigid Gift Box (Single Large Taonga / Mere)',
    maxWeightGrams: 3000,
    dimensions: '310 × 225 × 100 mm',
  },
  'BOX-2': {
    code: 'BOX-2',
    name: 'Heavy Duty Sculptural Box',
    maxWeightGrams: 10000,
    dimensions: '420 × 350 × 200 mm',
  },
};

const PACKAGE_SIZE_ORDER: PackageSizeCode[] = ['BAG-S', 'BAG-M', 'BOX-1', 'BOX-2'];

/**
 * Calculates optimal packaging size based on largest item and cumulative weight.
 * Default rule: largest size in cart wins; steps up if aggregate weight exceeds threshold.
 */
export function determinePackageSize(items: CartItem[]): PackageSizeCode {
  if (items.length === 0) return 'BAG-S';

  let highestIndex = 0;
  let totalWeightGrams = 0;

  for (const item of items) {
    totalWeightGrams += item.product.weightGrams * item.quantity;
    const itemSizeIndex = PACKAGE_SIZE_ORDER.indexOf(item.product.defaultPackageSize);
    if (itemSizeIndex > highestIndex) {
      highestIndex = itemSizeIndex;
    }
  }

  while (highestIndex < PACKAGE_SIZE_ORDER.length - 1) {
    const currentSize = PACKAGE_SIZE_ORDER[highestIndex];
    if (totalWeightGrams > PACKAGE_SIZES[currentSize].maxWeightGrams) {
      highestIndex++;
    } else {
      break;
    }
  }

  return PACKAGE_SIZE_ORDER[highestIndex];
}

export interface PriceCartParams {
  items: CartItem[];
  selectedServiceId?: string;
  services: CourierService[];
  rates: CourierRate[];
  discounts?: DiscountRule[];
  discountCode?: string;
  giftCardCode?: string;
  giftCardBalanceCents?: number;
  paymentMethod?: PaymentMethod;
}

export interface PriceCartResult {
  itemsTotalCents: number;
  discountCents: number;
  shippingCents: number;
  subtotalCents: number;
  preGiftCardTotalCents: number;
  giftCardCode?: string;
  giftCardAppliedCents: number;
  gstCents: number; // 15% NZ GST included in order value
  totalCents: number;
  packageSize: PackageSizeCode;
  selectedService?: CourierService;
  appliedDiscount?: DiscountRule;
  discountError?: string;
  estimatedStripeFeeCents: number;
  estimatedNetReceivedCents: number;
}

/**
 * Authoritative priceCart() calculation.
 * Reads rates & active discounts passed from SQLite. All prices in integer cents, NZ GST 15% inclusive.
 */
export function priceCart({
  items,
  selectedServiceId,
  services,
  rates,
  discounts = [],
  discountCode,
  giftCardCode,
  giftCardBalanceCents = 0,
  paymentMethod = 'STRIPE',
}: PriceCartParams): PriceCartResult {
  const itemsTotalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0
  );

  const packageSize = determinePackageSize(items);
  const isPickup = paymentMethod === 'CASH_ON_PICKUP';

  // Find active service
  const selectedService = isPickup
    ? undefined
    : services.find((s) => s.id === selectedServiceId) || services[0];

  // Lookup rate for package size and service (studio pickup has $0 courier shipping)
  let shippingCents = 0;
  if (!isPickup && selectedService) {
    const rateRecord = rates.find(
      (r) => r.courierServiceId === selectedService.id && r.packageSizeCode === packageSize
    );
    shippingCents = rateRecord ? rateRecord.priceCents : 0;

    if (
      selectedService.freeOverAmountCents &&
      selectedService.freeOverAmountCents > 0 &&
      itemsTotalCents >= selectedService.freeOverAmountCents
    ) {
      shippingCents = 0;
    }
  }

  // Evaluate discount from SQLite discount table
  let discountCents = 0;
  let appliedDiscount: DiscountRule | undefined;
  let discountError: string | undefined;

  const trimmedCode = discountCode?.trim().toUpperCase();
  if (trimmedCode) {
    const rule = discounts.find(
      (d) => d.isActive && d.code.trim().toUpperCase() === trimmedCode
    );
    if (!rule) {
      discountError = `Promo code "${trimmedCode}" is not active or was not found.`;
    } else if (rule.minSpendCents && itemsTotalCents < rule.minSpendCents) {
      discountError = `Code "${rule.code}" requires a minimum spend of ${formatNZD(rule.minSpendCents)}.`;
    } else {
      appliedDiscount = rule;
      if (rule.type === 'PERCENTAGE') {
        discountCents = Math.round((itemsTotalCents * rule.value) / 100);
      } else if (rule.type === 'FIXED') {
        discountCents = Math.min(rule.value, itemsTotalCents);
      } else if (rule.type === 'FREE_SHIPPING') {
        shippingCents = 0;
      }
    }
  }

  const subtotalCents = Math.max(0, itemsTotalCents - discountCents);
  const preGiftCardTotalCents = subtotalCents + shippingCents;

  // In New Zealand, prices are GST-inclusive at 15% (Pre-GiftCard Order Total × 3 / 23).
  const gstCents = Math.round((preGiftCardTotalCents * 3) / 23);

  const normalizedGiftCode = giftCardCode?.trim().toUpperCase() || '';
  const giftCardAppliedCents =
    normalizedGiftCode && giftCardBalanceCents > 0
      ? Math.min(Math.round(giftCardBalanceCents), preGiftCardTotalCents)
      : 0;

  const totalCents = Math.max(0, preGiftCardTotalCents - giftCardAppliedCents);

  // Stripe NZ standard processing fee: 2.7% + 30 cents on remaining Stripe balance
  const estimatedStripeFeeCents =
    paymentMethod === 'STRIPE' && totalCents > 0 ? Math.round(totalCents * 0.027 + 30) : 0;
  const estimatedNetReceivedCents = Math.max(0, totalCents - estimatedStripeFeeCents);

  return {
    itemsTotalCents,
    discountCents,
    shippingCents,
    subtotalCents,
    preGiftCardTotalCents,
    giftCardCode: giftCardAppliedCents > 0 ? normalizedGiftCode : undefined,
    giftCardAppliedCents,
    gstCents,
    totalCents,
    packageSize,
    selectedService,
    appliedDiscount,
    discountError,
    estimatedStripeFeeCents,
    estimatedNetReceivedCents,
  };
}

export function calculateCustomPieceCents(
  config: CustomPricingConfig,
  params: {
    material: StoneVariety;
    design: DesignMotif;
    sizeMm: number;
    includePauaEye: boolean;
    includeHardwoodBox: boolean;
  }
): number {
  const stoneMatch = config.stoneOptions?.find(
    (s) => s.name.toLowerCase() === params.material.toLowerCase()
  );
  const base = stoneMatch
    ? stoneMatch.baseCents
    : (config.materialBaseCents?.[params.material] ?? 28000);

  const designMatch = config.designOptions?.find(
    (d) =>
      d.name.toLowerCase() === params.design.toLowerCase() ||
      d.label.toLowerCase() === params.design.toLowerCase()
  );
  const designMult = designMatch
    ? designMatch.multiplier
    : (config.designMultiplier?.[params.design] ?? 1.0);

  const sizeMatch = config.sizeOptions?.find((sz) => sz.mm === params.sizeMm);
  const sizeMult = sizeMatch
    ? sizeMatch.multiplier
    : params.sizeMm <= 50
    ? config.sizeMultiplier.small45
    : params.sizeMm >= 80
    ? config.sizeMultiplier.large85
    : config.sizeMultiplier.medium65;

  const pauaCost = params.includePauaEye ? config.pauaEyeCents : 0;
  const boxCost = params.includeHardwoodBox ? config.hardwoodBoxCents : 0;
  return Math.round(base * designMult * sizeMult + pauaCost + boxCost);
}

export function formatNZD(cents: number): string {
  return `$${(cents / 100).toFixed(2)} NZD`;
}
