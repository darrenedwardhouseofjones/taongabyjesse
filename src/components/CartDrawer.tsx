import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingCart,
  Trash2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Truck,
  Check,
  CreditCard,
  Banknote,
  MapPin,
  Gift,
} from 'lucide-react';
import {
  CartItem,
  Courier,
  CourierRate,
  DiscountRule,
  PaymentMethod,
  SiteSettings,
} from '../types';
import { formatNZD, priceCart } from '../utils/pricing';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  couriers: Courier[];
  rates: CourierRate[];
  discounts: DiscountRule[];
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  paymentMethod: PaymentMethod;
  onSelectPaymentMethod: (mode: PaymentMethod) => void;
  settings: SiteSettings;
  discountCode: string;
  onApplyDiscount: (code: string) => void;
  giftCardCode?: string;
  giftCardBalanceCents?: number;
  giftCardError?: string | null;
  isValidatingGiftCard?: boolean;
  onApplyGiftCard?: (code: string) => Promise<void> | void;
  onClearGiftCard?: () => void;
  onOpenGiftCards?: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onUpdateQuantity,
  couriers,
  rates,
  discounts,
  selectedServiceId,
  onSelectService,
  paymentMethod,
  onSelectPaymentMethod,
  settings,
  discountCode,
  onApplyDiscount,
  giftCardCode = '',
  giftCardBalanceCents = 0,
  giftCardError = null,
  isValidatingGiftCard = false,
  onApplyGiftCard,
  onClearGiftCard,
  onOpenGiftCards,
  onProceedToCheckout,
}) => {
  const [promoInput, setPromoInput] = useState(discountCode);
  const [giftCardInput, setGiftCardInput] = useState(giftCardCode);

  useEffect(() => {
    setPromoInput(discountCode);
  }, [discountCode]);

  useEffect(() => {
    setGiftCardInput(giftCardCode);
  }, [giftCardCode]);

  // Flatten active courier services
  const allServices = couriers
    .filter((c) => c.isActive)
    .flatMap((c) => c.services.filter((s) => s.isActive));

  const stripeEnabled = settings.stripeEnabled ?? true;
  const cashOnPickupEnabled = settings.cashOnPickupEnabled ?? true;
  const isCashOnPickup = paymentMethod === 'CASH_ON_PICKUP';

  // Compute authoritative prices from SQLite rates, discounts & gift card balance
  const priceSummary = priceCart({
    items,
    selectedServiceId,
    services: allServices,
    rates,
    discounts,
    discountCode,
    giftCardCode,
    giftCardBalanceCents,
    paymentMethod,
  });

  const fullyCoveredByGiftCard =
    priceSummary.totalCents === 0 && priceSummary.giftCardAppliedCents > 0;

  // Unique piece reservation timer (15 minutes from addition)
  const [timeLeftSec, setTimeLeftSec] = useState<number>(900); // 15 mins default
  const hasUniquePiece = items.some((i) => i.product.isUniquePiece);

  useEffect(() => {
    if (!hasUniquePiece || items.length === 0) return;

    const interval = setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [hasUniquePiece, items.length]);

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Frosted Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#111C16]/50 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer content */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white/95 backdrop-blur-2xl border-l border-white/60 flex flex-col shadow-2xl">
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#E8E2D6] flex items-center justify-between bg-[#FAF9F6]/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B382B] text-[#7FA892] flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#18231C]">
                  Your Cart
                </h2>
                <span className="text-[10px] text-[#526058] uppercase tracking-wider block">
                  Sacred Heirlooms (Kete)
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#526058] hover:text-[#18231C] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 15-Minute Reservation Notification for Unique Stones */}
          {hasUniquePiece && (
            <div className="bg-[#12241B] text-white px-5 py-2.5 text-xs flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C29B38] animate-pulse" />
                <span>Unique 1-of-1 piece reserved in cart:</span>
              </div>
              <span className="font-mono font-bold text-[#C29B38] tabular-nums">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mx-auto shadow-sm">
                  <ShoppingCart className="w-7 h-7 text-[#526058]" />
                </div>
                <div className="font-display text-base font-semibold text-[#18231C]">
                  Your cart is currently empty
                </div>
                <p className="text-xs text-[#526058] max-w-xs mx-auto">
                  Explore our handcrafted collection of authentic New Zealand greenstone pendants hand-carved by Jesse.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-4 p-4 rounded-2xl glass-card relative border border-white"
                >
                  <img
                    src={item.product.images[0]}
                    alt={item.product.title}
                    className="w-18 h-18 object-cover rounded-xl border border-white shadow-xs shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-display text-xs font-bold text-[#18231C] truncate">
                      {item.product.title}
                    </h4>
                    <div className="text-[11px] text-[#526058]">
                      {item.product.material} Greenstone · {item.product.designType}
                    </div>
                    <div className="text-[10px] text-[#2D5A46] font-mono font-semibold">
                      Ngāi Tahu Code: {item.product.authenticityCode}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-display font-bold text-xs text-[#1B382B] tabular-nums">
                        {formatNZD(item.product.priceCents * item.quantity)}
                      </span>
                      {item.product.isUniquePiece ? (
                        <span className="text-[10px] text-[#C29B38] font-bold">
                          Unique 1-of-1 Piece
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            onClick={() =>
                              onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))
                            }
                            className="w-6 h-6 rounded-lg border border-[#E8E2D6] bg-white text-[#18231C] flex items-center justify-center hover:bg-[#FAF9F6] cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs px-1.5">{item.quantity}</span>
                          <button
                            disabled={!item.product.isMadeToOrder && item.quantity >= item.product.quantity}
                            onClick={() =>
                              onUpdateQuantity(
                                item.product.id,
                                item.product.isMadeToOrder
                                  ? item.quantity + 1
                                  : Math.min(item.product.quantity, item.quantity + 1)
                              )
                            }
                            className="w-6 h-6 rounded-lg border border-[#E8E2D6] bg-white text-[#18231C] flex items-center justify-center hover:bg-[#FAF9F6] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="text-[#526058] hover:text-red-600 transition-colors self-start p-1 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Payment & Delivery Selection & Calculations */}
          {items.length > 0 && (
            <div className="p-6 border-t border-[#E8E2D6] bg-white/90 backdrop-blur-md space-y-4">
              {/* Payment Mode Switcher */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#18231C] block">
                  Payment Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-[11px]">
                  <button
                    type="button"
                    disabled={!stripeEnabled}
                    onClick={() => onSelectPaymentMethod('STRIPE')}
                    className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                      !isCashOnPickup
                        ? 'bg-[#1B382B] text-white shadow-xs'
                        : 'text-[#526058] hover:text-[#18231C]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span>Stripe (Card)</span>
                  </button>
                  <button
                    type="button"
                    disabled={!cashOnPickupEnabled}
                    onClick={() => onSelectPaymentMethod('CASH_ON_PICKUP')}
                    className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                      isCashOnPickup
                        ? 'bg-[#1B382B] text-white shadow-xs'
                        : 'text-[#526058] hover:text-[#18231C]'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 shrink-0" />
                    <span>Cash on Pickup</span>
                  </button>
                </div>
              </div>

              {/* Courier Service Picker or Studio Collection Summary */}
              {isCashOnPickup ? (
                <div className="p-3 rounded-xl border border-[#2D5A46]/25 bg-[#F7F9F8] flex items-start gap-2.5 text-xs">
                  <MapPin className="w-4 h-4 text-[#2D5A46] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[#18231C]">
                      Napier Studio Collection ($0.00 shipping)
                    </div>
                    <div className="text-[11px] text-[#526058]">
                      {settings.workshopAddress} — pay in cash (NZD) upon pickup.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#18231C] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#1B382B]" />
                      Insured Courier Delivery (Parcel: {priceSummary.packageSize})
                    </span>
                    <span className="text-[10px] text-[#526058]">Direct to door</span>
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => onSelectService(e.target.value)}
                    className="w-full text-xs p-3 border border-[#E8E2D6] rounded-xl bg-white text-[#18231C] focus:outline-none focus:border-[#1B382B]"
                  >
                    {allServices.map((service) => {
                      const courier = couriers.find((c) => c.id === service.courierId);
                      const rate = rates.find(
                        (r) =>
                          r.courierServiceId === service.id &&
                          r.packageSizeCode === priceSummary.packageSize
                      );
                      const cost =
                        service.freeOverAmountCents &&
                        priceSummary.itemsTotalCents >= service.freeOverAmountCents
                          ? 'FREE'
                          : rate
                          ? formatNZD(rate.priceCents)
                          : '$9.50 NZD';

                      return (
                        <option key={service.id} value={service.id}>
                          {courier?.name}: {service.name} ({cost})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Promo code */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo code..."
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="flex-1 text-xs p-2.5 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B] font-mono uppercase"
                />
                {discountCode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPromoInput('');
                      onApplyDiscount('');
                    }}
                    className="px-4 py-2 bg-[#FAF9F6] border border-[#E8E2D6] hover:bg-[#E8E2D6] text-xs font-semibold rounded-xl text-[#526058] cursor-pointer"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onApplyDiscount(promoInput.trim())}
                    className="px-4 py-2 bg-[#FAF9F6] border border-[#E8E2D6] hover:bg-[#E8E2D6] text-xs font-semibold rounded-xl text-[#18231C] cursor-pointer"
                  >
                    Apply
                  </button>
                )}
              </div>
              {priceSummary.appliedDiscount && (
                <div className="text-[11px] text-[#2D5A46] flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>{priceSummary.appliedDiscount.description}</span>
                </div>
              )}
              {priceSummary.discountError && (
                <div className="text-[11px] text-[#A63A2A] font-medium">
                  {priceSummary.discountError}
                </div>
              )}

              {/* Digital Gift Card Redemption */}
              {onApplyGiftCard && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#526058]">
                    <span className="font-semibold text-[#18231C] flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#1B382B]" />
                      Digital Gift Card
                    </span>
                    {onOpenGiftCards && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenGiftCards();
                        }}
                        className="text-[#1B382B] font-semibold hover:underline cursor-pointer"
                      >
                        Buy or check balance →
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="PA-GIFT-XXXX-XXXX"
                      value={giftCardInput}
                      onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                      className="flex-1 text-xs p-2.5 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B] font-mono uppercase"
                    />
                    {giftCardCode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGiftCardInput('');
                          onClearGiftCard?.();
                        }}
                        className="px-4 py-2 bg-[#FAF9F6] border border-[#E8E2D6] hover:bg-[#E8E2D6] text-xs font-semibold rounded-xl text-[#526058] cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isValidatingGiftCard || !giftCardInput.trim()}
                        onClick={() => void onApplyGiftCard(giftCardInput.trim())}
                        className="px-4 py-2 bg-[#FAF9F6] border border-[#E8E2D6] hover:bg-[#E8E2D6] disabled:opacity-50 text-xs font-semibold rounded-xl text-[#18231C] cursor-pointer"
                      >
                        {isValidatingGiftCard ? 'Checking...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {giftCardCode && giftCardBalanceCents > 0 && (
                    <div className="text-[11px] text-[#2D5A46] flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        Gift card {giftCardCode} applied (Balance: {formatNZD(giftCardBalanceCents)})
                      </span>
                    </div>
                  )}
                  {giftCardError && (
                    <div className="text-[11px] text-[#A63A2A] font-medium">
                      {giftCardError}
                    </div>
                  )}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs text-[#526058] pt-2 border-t border-[#E8E2D6]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-[#18231C]">
                    {formatNZD(priceSummary.itemsTotalCents)}
                  </span>
                </div>
                {priceSummary.discountCents > 0 && (
                  <div className="flex justify-between text-[#2D5A46]">
                    <span>Discount:</span>
                    <span className="font-mono">
                      -{formatNZD(priceSummary.discountCents)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{isCashOnPickup ? 'Studio Collection:' : 'Tracked Courier:'}</span>
                  <span className="font-mono text-[#18231C]">
                    {priceSummary.shippingCents === 0 ? (
                      <strong className="text-[#2D5A46]">
                        {isCashOnPickup ? 'FREE (Pickup)' : 'FREE'}
                      </strong>
                    ) : (
                      formatNZD(priceSummary.shippingCents)
                    )}
                  </span>
                </div>
                {priceSummary.giftCardAppliedCents > 0 && (
                  <div className="flex justify-between text-[#2D5A46] font-medium">
                    <span>Gift Card ({giftCardCode}):</span>
                    <span className="font-mono">
                      -{formatNZD(priceSummary.giftCardAppliedCents)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-[#526058]/80">
                  <span>Includes 15% NZ GST:</span>
                  <span className="font-mono">{formatNZD(priceSummary.gstCents)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#18231C] pt-2 border-t border-[#E8E2D6]">
                  <span className="font-display">
                    {fullyCoveredByGiftCard
                      ? 'Remaining Due (NZD):'
                      : isCashOnPickup
                      ? 'Due on Pickup (NZD):'
                      : 'Total to Pay (NZD):'}
                  </span>
                  <span className="font-display text-[#1B382B] text-base tabular-nums">
                    {formatNZD(priceSummary.totalCents)}
                  </span>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                type="button"
                disabled={!fullyCoveredByGiftCard && !stripeEnabled && !cashOnPickupEnabled}
                onClick={onProceedToCheckout}
                className="w-full py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
              >
                <span>
                  {fullyCoveredByGiftCard
                    ? 'Complete Order with Gift Card ($0.00 Due)'
                    : isCashOnPickup
                    ? 'Proceed to Cash on Pickup Checkout'
                    : 'Proceed to Stripe Secure Checkout'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#7FA892]" />
              </button>

              <div className="text-[10px] text-center text-[#526058] flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2D5A46]" />
                <span>
                  {fullyCoveredByGiftCard
                    ? '100% covered by your Pounamu Atelier digital gift card'
                    : isCashOnPickup
                    ? 'Pay in NZD cash upon collection at our Napier studio'
                    : 'PCI-DSS SAQ A Certified · 256-bit Encrypted Card Processing'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
