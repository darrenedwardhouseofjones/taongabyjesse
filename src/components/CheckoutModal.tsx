import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Truck,
  AlertCircle,
  Settings,
  Banknote,
  MapPin,
  Gift,
  Check,
} from 'lucide-react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  CartItem,
  CourierRate,
  CourierService,
  DiscountRule,
  Order,
  OrderEmailLog,
  PackageSizeCode,
  PaymentMethod,
  Product,
  SiteSettings,
  UserProfile,
} from '../types';
import { formatNZD, priceCart } from '../utils/pricing';
import { apiFetch } from '../utils/api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
  selectedService?: CourierService;
  courierName: string;
  allServices?: CourierService[];
  rates?: CourierRate[];
  discounts?: DiscountRule[];
  packageSize: PackageSizeCode;
  paymentMethod?: PaymentMethod;
  onSelectPaymentMethod?: (mode: PaymentMethod) => void;
  discountCode?: string;
  giftCardCode?: string;
  giftCardBalanceCents?: number;
  giftCardError?: string | null;
  isValidatingGiftCard?: boolean;
  onApplyGiftCard?: (code: string) => Promise<void> | void;
  onClearGiftCard?: () => void;
  currentUser?: UserProfile | null;
  confirmationEmailLog?: OrderEmailLog | null;
  sendingConfirmationEmail?: boolean;
  onOrderComplete: (newOrder: Order, updatedProducts?: Product[]) => void;
  onOpenPaymentSettings?: () => void;
  settings: SiteSettings;
}

interface CreatePaymentIntentResponse {
  order: Order;
  clientSecret: string;
  publishableKey: string;
  pricing: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    gstCents: number;
    totalCents: number;
  };
}

interface StripePaymentFormProps {
  order: Order;
  totalCents: number;
  stripeMode: 'test' | 'live';
  onBack: () => void;
  onPaid: (confirmedOrder: Order, updatedProducts?: Product[]) => void;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  order,
  totalCents,
  stripeMode,
  onBack,
  onPaid,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        setPaymentError(error.message || 'Payment could not be authorized.');
        setIsProcessing(false);
        return;
      }

      if (!paymentIntent) {
        setPaymentError('No payment confirmation returned from Stripe.');
        setIsProcessing(false);
        return;
      }

      // Sync authoritative order status & atomic stock decrement on the server
      let finalRes = await apiFetch<{
        status: Order['status'];
        order: Order;
        products?: Product[];
      }>('/api/checkout/confirm-status', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
        }),
      });

      // Brief poll fallback in case Stripe webhook is finalizing concurrently
      if (finalRes.status === 'PENDING') {
        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 900));
          const poll = await apiFetch<{ status: Order['status']; order: Order }>(
            `/api/orders/${order.id}/status`
          );
          if (poll.status !== 'PENDING') {
            finalRes = { ...finalRes, status: poll.status, order: poll.order };
            break;
          }
        }
      }

      setIsProcessing(false);
      onPaid(finalRes.order, finalRes.products);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Unable to complete Stripe payment.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 sm:p-5 border border-[#E8E2D6] rounded-xl bg-white space-y-4">
        <div className="flex items-center justify-between text-[#526058] pb-2 border-b border-[#E8E2D6]">
          <span className="font-semibold text-[#18231C] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#1B382B]" />
            Stripe Payment Element (Card, Apple Pay, Google Pay)
          </span>
          <span
            className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
              stripeMode === 'live'
                ? 'bg-[#2D5A46]/15 text-[#2D5A46]'
                : 'bg-[#C29B38]/15 text-[#9A7820]'
            }`}
          >
            {stripeMode === 'live' ? 'Live Mode' : 'Test Mode'}
          </span>
        </div>

        <PaymentElement
          onReady={() => setElementReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {paymentError && (
        <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] flex items-start gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{paymentError}</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onBack}
          className="text-[#526058] hover:text-[#18231C] cursor-pointer disabled:opacity-50"
        >
          ← Back to Details
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || !elementReady || isProcessing}
          className="px-6 py-3 bg-[#1B382B] hover:bg-[#12241B] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-md"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Authorizing with Stripe...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-[#7FA892]" />
              <span>Authorize & Pay {formatNZD(totalCents)}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  subtotalCents,
  discountCents,
  shippingCents,
  gstCents,
  totalCents,
  selectedService,
  courierName,
  allServices = [],
  rates = [],
  discounts = [],
  packageSize,
  paymentMethod = 'STRIPE',
  onSelectPaymentMethod,
  discountCode,
  giftCardCode = '',
  giftCardBalanceCents = 0,
  giftCardError = null,
  isValidatingGiftCard = false,
  onApplyGiftCard,
  onClearGiftCard,
  currentUser,
  confirmationEmailLog = null,
  sendingConfirmationEmail = false,
  onOrderComplete,
  onOpenPaymentSettings,
  settings,
}) => {
  const [step, setStep] = useState<'details' | 'payment' | 'confirmed'>('details');
  const [localPaymentMethod, setLocalPaymentMethod] = useState<PaymentMethod>(paymentMethod);
  const [fulfillmentWhenCoveredByGiftCard, setFulfillmentWhenCoveredByGiftCard] = useState<
    'courier' | 'pickup'
  >('courier');
  const [giftCardInput, setGiftCardInput] = useState(giftCardCode);

  useEffect(() => {
    setLocalPaymentMethod(paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    setGiftCardInput(giftCardCode);
  }, [giftCardCode]);

  const stripeEnabled = settings.stripeEnabled ?? true;
  const cashOnPickupEnabled = settings.cashOnPickupEnabled ?? true;
  const activePaymentMethod: PaymentMethod =
    localPaymentMethod === 'CASH_ON_PICKUP' && cashOnPickupEnabled
      ? 'CASH_ON_PICKUP'
      : stripeEnabled
      ? 'STRIPE'
      : cashOnPickupEnabled
      ? 'CASH_ON_PICKUP'
      : 'STRIPE';

  const handleSelectMode = (mode: PaymentMethod) => {
    setLocalPaymentMethod(mode);
    onSelectPaymentMethod?.(mode);
    setInitError(null);
    setStripeNotConfigured(false);
  };

  // Customer Details Form State (pre-filled only from authenticated profile)
  const [fullName, setFullName] = useState(
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : ''
  );
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('New Zealand');
  const [isRural, setIsRural] = useState(false);
  const [pickupNotes, setPickupNotes] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // PaymentIntent & Order State
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [stripeNotConfigured, setStripeNotConfigured] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Sync customer name/email when user logs in or out
  useEffect(() => {
    if (currentUser) {
      setFullName(`${currentUser.firstName} ${currentUser.lastName}`.trim());
      setEmail(currentUser.email);
    } else {
      setFullName('');
      setEmail('');
    }
  }, [currentUser]);

  // Reset modal checkout session cleanly whenever closed/reopened without completion
  useEffect(() => {
    if (isOpen && step === 'confirmed' && items.length > 0) {
      setStep('details');
      setCompletedOrder(null);
      setPendingOrder(null);
      setClientSecret(null);
      setInitError(null);
      setStripeNotConfigured(false);
      setOrderNotes('');
      setPickupNotes('');
      setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
  }, [isOpen, items.length]);

  const stripePromise: Promise<Stripe | null> | null = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const livePricing = useMemo(() => {
    const effectiveMode: PaymentMethod =
      localPaymentMethod === 'CASH_ON_PICKUP' ||
      (giftCardCode &&
        giftCardBalanceCents > 0 &&
        fulfillmentWhenCoveredByGiftCard === 'pickup')
        ? 'CASH_ON_PICKUP'
        : activePaymentMethod;

    if (allServices.length > 0 || rates.length > 0) {
      return priceCart({
        items,
        selectedServiceId: selectedService?.id,
        services: allServices,
        rates,
        discounts,
        discountCode,
        giftCardCode,
        giftCardBalanceCents,
        paymentMethod: effectiveMode,
      });
    }
    const isCash = effectiveMode === 'CASH_ON_PICKUP';
    const effectiveShipping = isCash ? 0 : shippingCents;
    const preGiftCardTotal = subtotalCents + effectiveShipping;
    const appliedGiftCard =
      giftCardCode && giftCardBalanceCents > 0
        ? Math.min(giftCardBalanceCents, preGiftCardTotal)
        : 0;
    const effectiveTotal = Math.max(0, preGiftCardTotal - appliedGiftCard);
    const effectiveGst = Math.round((preGiftCardTotal * 3) / 23);
    return {
      subtotalCents,
      discountCents,
      shippingCents: effectiveShipping,
      preGiftCardTotalCents: preGiftCardTotal,
      giftCardAppliedCents: appliedGiftCard,
      gstCents: effectiveGst,
      totalCents: effectiveTotal,
    };
  }, [
    allServices,
    rates,
    discounts,
    discountCode,
    giftCardCode,
    giftCardBalanceCents,
    items,
    selectedService?.id,
    activePaymentMethod,
    localPaymentMethod,
    fulfillmentWhenCoveredByGiftCard,
    subtotalCents,
    discountCents,
    shippingCents,
  ]);

  if (!isOpen) return null;

  const isFullyCoveredByGiftCard =
    livePricing.totalCents === 0 && (livePricing.giftCardAppliedCents ?? 0) > 0;
  const isPickupSelected = isFullyCoveredByGiftCard
    ? fulfillmentWhenCoveredByGiftCard === 'pickup'
    : activePaymentMethod === 'CASH_ON_PICKUP';
  const isCashOnPickup = !isFullyCoveredByGiftCard && activePaymentMethod === 'CASH_ON_PICKUP';

  const hasExportRestrictedItem = items.some(
    (i) => i.product.isExportRestricted || i.product.material === 'Whale Bone'
  );
  const exportBlocked =
    !isPickupSelected &&
    hasExportRestrictedItem &&
    country.trim().toLowerCase() !== 'new zealand';

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exportBlocked) {
      setInitError(
        'Whale bone / DOC-restricted pieces cannot be shipped outside New Zealand.'
      );
      return;
    }

    setInitializingPayment(true);
    setInitError(null);
    setStripeNotConfigured(false);

    try {
      if (isFullyCoveredByGiftCard) {
        const res = await apiFetch<{
          order: Order;
          products?: Product[];
        }>('/api/checkout/gift-card-complete', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
            })),
            customerName: fullName,
            customerEmail: email,
            customerPhone: phone,
            fulfillmentMode: fulfillmentWhenCoveredByGiftCard,
            shippingAddress:
              fulfillmentWhenCoveredByGiftCard === 'courier'
                ? {
                    line1: addressLine1,
                    line2: addressLine2,
                    city,
                    region,
                    postcode,
                    country,
                    isRural,
                  }
                : undefined,
            pickupNotes,
            orderNotes: orderNotes.trim() || undefined,
            selectedServiceId: selectedService?.id,
            discountCode,
            giftCardCode,
          }),
        });
        setCompletedOrder(res.order);
        setStep('confirmed');
        onOrderComplete(res.order, res.products);
        return;
      }

      if (isCashOnPickup) {
        const res = await apiFetch<{
          order: Order;
          products?: Product[];
        }>('/api/checkout/cash-on-pickup', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
            })),
            customerName: fullName,
            customerEmail: email,
            customerPhone: phone,
            pickupNotes,
            orderNotes: orderNotes.trim() || undefined,
            discountCode,
            giftCardCode: giftCardCode || undefined,
          }),
        });
        setCompletedOrder(res.order);
        setStep('confirmed');
        onOrderComplete(res.order, res.products);
        return;
      }

      const res = await apiFetch<CreatePaymentIntentResponse>(
        '/api/checkout/create-payment-intent',
        {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
            })),
            customerName: fullName,
            customerEmail: email,
            customerPhone: phone,
            shippingAddress: {
              line1: addressLine1,
              line2: addressLine2,
              city,
              region,
              postcode,
              country,
              isRural,
            },
            orderNotes: orderNotes.trim() || undefined,
            selectedServiceId: selectedService?.id,
            discountCode,
            giftCardCode: giftCardCode || undefined,
            previousOrderId: pendingOrder?.id,
            idempotencyKey,
          }),
        }
      );

      setPendingOrder(res.order);
      setClientSecret(res.clientSecret);
      setPublishableKey(res.publishableKey);
      setStep('payment');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not initialize secure checkout.';
      setInitError(msg);
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('stripe keys')) {
        setStripeNotConfigured(true);
      }
    } finally {
      setInitializingPayment(false);
    }
  };

  const displaySubtotal = pendingOrder?.subtotalCents ?? livePricing.subtotalCents;
  const displayShipping = pendingOrder?.shippingCents ?? livePricing.shippingCents;
  const displayGst = pendingOrder?.gstCents ?? livePricing.gstCents;
  const displayGiftCardApplied =
    pendingOrder?.giftCardAppliedCents ?? livePricing.giftCardAppliedCents ?? 0;
  const displayTotal = pendingOrder?.totalCents ?? livePricing.totalCents;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111C16]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E2D6] max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-5 bg-[#FAF9F6] border-b border-[#E8E2D6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isFullyCoveredByGiftCard && step === 'details' ? (
              <Gift className="w-4 h-4 text-[#1B382B]" />
            ) : isCashOnPickup && step === 'details' ? (
              <Banknote className="w-4 h-4 text-[#1B382B]" />
            ) : (
              <Lock className="w-4 h-4 text-[#1B382B]" />
            )}
            <span className="font-display text-base font-bold text-[#18231C]">
              {step === 'details' &&
                (isFullyCoveredByGiftCard
                  ? '1. Gift Card Redemption & Delivery Details'
                  : isCashOnPickup
                  ? '1. Payment Mode & Napier Studio Pickup Details'
                  : '1. Payment Mode & Shipping Details')}
              {step === 'payment' && '2. Stripe SAQ A Secure Card Payment'}
              {step === 'confirmed' &&
                (completedOrder?.paymentMethod === 'GIFT_CARD'
                  ? 'Order Paid in Full by Digital Gift Card'
                  : completedOrder?.paymentMethod === 'CASH_ON_PICKUP'
                  ? 'Pickup Order Confirmed — Pay Cash on Collection'
                  : 'Order Confirmed & Blessed')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#526058] hover:text-[#18231C] rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: DETAILS */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="p-6 space-y-4 text-xs font-sans-ui">
            {initError && (
              <div className="p-3.5 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] space-y-2">
                <div className="flex items-start gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{initError}</span>
                </div>
                {stripeNotConfigured &&
                  currentUser?.role === 'ADMIN' &&
                  onOpenPaymentSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPaymentSettings();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B382B] text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Open Payment Settings</span>
                    </button>
                  )}
              </div>
            )}

            {/* Digital Gift Card Redemption Box */}
            {onApplyGiftCard && (
              <div className="p-3.5 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#18231C] flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#1B382B]" />
                    Digital Gift Card Code
                  </span>
                  {(livePricing.giftCardAppliedCents ?? 0) > 0 && (
                    <span className="font-mono font-bold text-[#2D5A46] tabular-nums">
                      Applied: -{formatNZD(livePricing.giftCardAppliedCents ?? 0)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="PA-GIFT-XXXX-XXXX"
                    value={giftCardInput}
                    onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                    className="flex-1 p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono uppercase focus:outline-none focus:border-[#1B382B]"
                  />
                  {giftCardCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGiftCardInput('');
                        onClearGiftCard?.();
                      }}
                      className="px-3.5 py-2 border border-[#E8E2D6] bg-white hover:bg-[#E8E2D6] rounded-lg font-semibold text-[#526058] cursor-pointer"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isValidatingGiftCard || !giftCardInput.trim()}
                      onClick={() => void onApplyGiftCard(giftCardInput.trim())}
                      className="px-4 py-2 bg-[#1B382B] text-white rounded-lg font-semibold hover:bg-[#12241B] disabled:opacity-50 cursor-pointer"
                    >
                      {isValidatingGiftCard ? 'Checking...' : 'Apply'}
                    </button>
                  )}
                </div>
                {giftCardCode && giftCardBalanceCents > 0 && (
                  <div className="text-[11px] text-[#2D5A46] flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {giftCardCode} verified — Remaining Balance: {formatNZD(giftCardBalanceCents)}
                    </span>
                  </div>
                )}
                {giftCardError && (
                  <div className="text-[11px] text-[#A63A2A] font-medium">{giftCardError}</div>
                )}
              </div>
            )}

            {/* Payment Mode Selection OR 100% Gift Card Coverage Fulfilment */}
            {isFullyCoveredByGiftCard ? (
              <div className="p-4 rounded-xl border border-[#2D5A46]/40 bg-[#F7F9F8] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-[#1B382B]">
                    <Gift className="w-4 h-4 text-[#2D5A46]" />
                    <span>100% Covered by Digital Gift Card ({giftCardCode})</span>
                  </div>
                  <span className="font-mono font-bold text-[#1B382B] tabular-nums">$0.00 NZD Due</span>
                </div>
                <p className="text-[11px] text-[#526058]">
                  No card or cash payment is required. Choose whether you would like tracked courier dispatch or collection in Napier:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFulfillmentWhenCoveredByGiftCard('courier')}
                    className={`p-2.5 rounded-lg border text-left font-semibold cursor-pointer ${
                      fulfillmentWhenCoveredByGiftCard === 'courier'
                        ? 'border-[#1B382B] bg-white text-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white/60 text-[#526058]'
                    }`}
                  >
                    Tracked Courier Dispatch ({courierName})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillmentWhenCoveredByGiftCard('pickup')}
                    className={`p-2.5 rounded-lg border text-left font-semibold cursor-pointer ${
                      fulfillmentWhenCoveredByGiftCard === 'pickup'
                        ? 'border-[#1B382B] bg-white text-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white/60 text-[#526058]'
                    }`}
                  >
                    Napier Studio Pickup ($0)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-semibold text-[#18231C]">Select Payment Mode *</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!stripeEnabled}
                    onClick={() => handleSelectMode('STRIPE')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      !isCashOnPickup
                        ? 'border-[#1B382B] bg-[#F7F9F8] ring-1 ring-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white hover:border-[#1B382B]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#18231C] flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#1B382B]" />
                        Stripe Card / Wallet
                      </span>
                      <span className="text-[10px] font-mono text-[#2D5A46]">
                        {stripeEnabled ? 'Instant' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526058] mt-1">
                      Pay online via Visa, Mastercard, Apple Pay or Google Pay with tracked courier dispatch.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={!cashOnPickupEnabled}
                    onClick={() => handleSelectMode('CASH_ON_PICKUP')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      isCashOnPickup
                        ? 'border-[#1B382B] bg-[#F7F9F8] ring-1 ring-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white hover:border-[#1B382B]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#18231C] flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-[#1B382B]" />
                        Cash on Pickup
                      </span>
                      <span className="text-[10px] font-mono text-[#2D5A46]">
                        {cashOnPickupEnabled ? '$0 Shipping' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526058] mt-1">
                      Reserve online and pay cash (NZD) directly when collecting from our Napier studio.
                    </p>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full recipient name"
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.co.nz"
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                />
              </div>
            </div>

            {isPickupSelected ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Mobile Number (For Pickup SMS) *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+64 21 ..."
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Preferred Collection Day / Notes (Optional)</label>
                    <input
                      type="text"
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      placeholder="e.g. Friday afternoon around 2pm"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                </div>

                {/* Pickup Location & Remaining Total */}
                <div className="p-4 rounded-xl border border-[#2D5A46]/30 bg-[#F7F9F8] space-y-2">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#2D5A46] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-[#18231C]">
                        Studio Pickup Address: {settings.workshopAddress}
                      </div>
                      <p className="text-[11px] text-[#526058] leading-relaxed">
                        {isFullyCoveredByGiftCard
                          ? 'Your gift card settles this order in full. Collect at no charge in Napier.'
                          : settings.cashOnPickupInstructions ||
                            'Pay in cash (NZD) when collecting your carved taonga in person from Jesse.'}
                      </p>
                    </div>
                  </div>
                  {(livePricing.giftCardAppliedCents ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-[#2D5A46] pt-1">
                      <span>Gift Card ({giftCardCode}):</span>
                      <span className="font-mono font-bold tabular-nums">
                        -{formatNZD(livePricing.giftCardAppliedCents ?? 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#D8E2DC]">
                    <span className="font-semibold text-[#18231C]">
                      {isFullyCoveredByGiftCard
                        ? 'Remaining Amount Due:'
                        : 'Amount Due on Collection (incl. 15% GST, $0 shipping):'}
                    </span>
                    <span className="font-mono font-bold text-sm text-[#1B382B] tabular-nums">
                      {formatNZD(livePricing.totalCents)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Mobile (For Courier SMS) *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+64 21 ..."
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Destination Country *</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white focus:outline-none focus:border-[#1B382B]"
                    >
                      <option value="New Zealand">New Zealand</option>
                      <option value="Australia">Australia</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                    </select>
                  </div>
                </div>

                {exportBlocked && (
                  <div className="p-3 rounded-xl bg-[#C29B38]/15 border border-[#C29B38]/40 text-[#7A5E14] font-medium">
                    Your cart includes a DOC-protected or Whale Bone taonga, which can only be shipped within New Zealand.
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C]">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="House number and street"
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C]">Apartment / Unit / Suite (Optional)</label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">City / Suburb *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Napier"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Region *</label>
                    <input
                      type="text"
                      required
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Hawke's Bay"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C]">Postcode *</label>
                    <input
                      type="text"
                      required
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      placeholder="4110"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#526058] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRural}
                    onChange={(e) => setIsRural(e.target.checked)}
                    className="rounded border-[#E8E2D6] text-[#1B382B]"
                  />
                  <span>Rural Delivery (RD) address</span>
                </label>

                {/* Courier summary banner */}
                <div className="p-3 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#1B382B]" />
                    <span className="font-medium text-[#18231C]">
                      {courierName} ({selectedService?.name}) · Parcel {packageSize}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#1B382B]">
                    {livePricing.shippingCents === 0 ? 'FREE' : formatNZD(livePricing.shippingCents)}
                  </span>
                </div>
              </>
            )}

            {/* Order Notes (Delivery instructions or carving requests — all payment & fulfilment modes) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="checkout-order-notes"
                  className="font-semibold text-[#18231C]"
                >
                  Order Notes (Optional)
                </label>
                <span className="text-[10px] text-[#7D8B82] font-mono tabular-nums">
                  {orderNotes.length}/1000
                </span>
              </div>
              <textarea
                id="checkout-order-notes"
                rows={3}
                maxLength={1000}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Special delivery instructions (e.g. gate code, safe drop location), gift enclosure note, cord length preference, or carving requests for Jesse..."
                className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white text-xs text-[#18231C] placeholder:text-[#7D8B82] focus:outline-none focus:border-[#1B382B] resize-y"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#E8E2D6] text-[#526058] rounded-lg hover:bg-[#FAF9F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  initializingPayment ||
                  exportBlocked ||
                  (!isFullyCoveredByGiftCard && !stripeEnabled && !cashOnPickupEnabled)
                }
                className="px-6 py-2.5 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {initializingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {isFullyCoveredByGiftCard
                        ? 'Completing Gift Card Order...'
                        : isCashOnPickup
                        ? 'Confirming Studio Pickup...'
                        : 'Reserving & Preparing Stripe...'}
                    </span>
                  </>
                ) : (
                  <span>
                    {isFullyCoveredByGiftCard
                      ? 'Complete Gift Card Order ($0.00 NZD Due)'
                      : isCashOnPickup
                      ? `Confirm Cash on Pickup Order (${formatNZD(livePricing.totalCents)})`
                      : `Continue to Stripe Payment (${formatNZD(livePricing.totalCents)})`}
                  </span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REAL STRIPE HOSTED PAYMENT ELEMENT (SAQ A) */}
        {step === 'payment' && pendingOrder && clientSecret && stripePromise && (
          <div className="p-6 space-y-5 text-xs font-sans-ui">
            {/* SAQ A Trust Banner */}
            <div className="p-3.5 bg-[#2D5A46]/10 border border-[#2D5A46]/30 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#2D5A46] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-[#1B382B]">
                  PCI SAQ A Hosted Payment Security · Order {pendingOrder.orderNumber}
                </div>
                <div className="text-[11px] text-[#526058]">
                  Card inputs are rendered inside Stripe’s encrypted iframe. No card numbers touch our servers, and stone stock is held exclusively for 15 minutes.
                </div>
              </div>
            </div>

            {/* Total summary (authoritative server calculation) */}
            <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-mono">
                  {formatNZD(displaySubtotal + (pendingOrder.discountCents ?? discountCents))}
                </span>
              </div>
              {(pendingOrder.discountCents ?? discountCents) > 0 && (
                <div className="flex justify-between text-[#2D5A46]">
                  <span>Discount:</span>
                  <span className="font-mono">
                    -{formatNZD(pendingOrder.discountCents ?? discountCents)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Insured Courier ({pendingOrder.courierName}):</span>
                <span className="font-mono">
                  {displayShipping === 0 ? 'FREE' : formatNZD(displayShipping)}
                </span>
              </div>
              {displayGiftCardApplied > 0 && (
                <div className="flex justify-between text-[#2D5A46] font-medium">
                  <span>Gift Card ({pendingOrder.giftCardCode || giftCardCode}):</span>
                  <span className="font-mono">-{formatNZD(displayGiftCardApplied)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-[#526058]">
                <span>GST (15% included):</span>
                <span className="font-mono">{formatNZD(displayGst)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#1B382B] pt-2 border-t border-[#E8E2D6]">
                <span>Authoritative Charge Total:</span>
                <span className="tabular-nums font-mono">{formatNZD(displayTotal)}</span>
              </div>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#1B382B',
                    colorBackground: '#FAF9F6',
                    colorText: '#18231C',
                    borderRadius: '10px',
                  },
                },
              }}
            >
              <StripePaymentForm
                order={pendingOrder}
                totalCents={displayTotal}
                stripeMode={settings.stripeMode || 'test'}
                onBack={() => {
                  setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
                  setStep('details');
                }}
                onPaid={(confirmedOrder, updatedProducts) => {
                  setCompletedOrder(confirmedOrder);
                  setStep('confirmed');
                  onOrderComplete(confirmedOrder, updatedProducts);
                }}
              />
            </Elements>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMATION & TAX INVOICE */}
        {step === 'confirmed' && completedOrder && (
          <div className="p-6 space-y-6 font-sans-ui text-xs">
            <div className="text-center space-y-2 py-4">
              <div className="w-12 h-12 bg-[#2D5A46] text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#18231C]">
                Tēnā koe, {completedOrder.customerName}!
              </h2>
              <p className="text-xs text-[#526058] max-w-md mx-auto">
                {completedOrder.paymentMethod === 'GIFT_CARD' ? (
                  <>
                    Your sacred taonga order has been settled in full using Digital Gift Card{' '}
                    <strong>{completedOrder.giftCardCode}</strong>. A confirmation &amp; provenance receipt has been sent to{' '}
                    <strong>
                      {confirmationEmailLog?.recipientEmail || currentUser?.email || completedOrder.customerEmail}
                    </strong>.
                  </>
                ) : completedOrder.paymentMethod === 'CASH_ON_PICKUP' ? (
                  <>
                    Your sacred taonga has been reserved for studio collection. Bring{' '}
                    <strong>{formatNZD(completedOrder.totalCents)}</strong> cash in NZD when picking up from{' '}
                    <strong>{settings.workshopAddress}</strong>. Confirmation sent to{' '}
                    <strong>
                      {confirmationEmailLog?.recipientEmail || currentUser?.email || completedOrder.customerEmail}
                    </strong>.
                  </>
                ) : (
                  <>
                    Your sacred taonga has been reserved and your Stripe payment is confirmed. A tax invoice and provenance record have been prepared for{' '}
                    <strong>
                      {confirmationEmailLog?.recipientEmail || currentUser?.email || completedOrder.customerEmail}
                    </strong>.
                  </>
                )}
              </p>
              <div className="max-w-md mx-auto mt-2 px-3.5 py-2 rounded-xl bg-[#F7F9F8] border border-[#2D5A46]/20 text-[11px] text-[#2D5A46] font-medium">
                {sendingConfirmationEmail
                  ? 'Sending automated order confirmation email...'
                  : confirmationEmailLog?.status === 'SENT'
                  ? `Order confirmation email sent to ${confirmationEmailLog.recipientEmail}.`
                  : confirmationEmailLog
                  ? `Order confirmation recorded for ${confirmationEmailLog.recipientEmail} (configure RESEND_API_KEY or SMTP_HOST to send external mail).`
                  : `Confirmation email queued for ${currentUser?.email || completedOrder.customerEmail}.`}
              </div>
            </div>

            {/* Official Tax Invoice / Packing Slip Display */}
            <div className="p-5 border border-[#E8E2D6] rounded-xl bg-white space-y-4">
              <div className="flex justify-between items-start border-b border-[#E8E2D6] pb-3">
                <div>
                  <div className="font-display font-bold text-base text-[#18231C]">
                    {settings.siteName.toUpperCase()}{' '}
                    {completedOrder.paymentMethod === 'CASH_ON_PICKUP'
                      ? 'PICKUP ORDER SLIP'
                      : 'TAX INVOICE'}
                  </div>
                  <div className="text-[11px] text-[#526058]">GST Reg: {settings.gstNumber}</div>
                  <div className="text-[11px] text-[#526058]">{settings.workshopAddress}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-[#1B382B]">
                    {completedOrder.orderNumber}
                  </div>
                  <div className="text-[10px] text-[#526058]">
                    {new Date(completedOrder.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] font-mono text-[#7D8B82]">
                    {completedOrder.paymentMethod === 'GIFT_CARD'
                      ? `Gift Card (${completedOrder.giftCardCode})`
                      : completedOrder.paymentMethod === 'CASH_ON_PICKUP'
                      ? 'Cash on Pickup'
                      : completedOrder.stripePaymentIntentId}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="font-bold text-[#18231C]">Carved Taonga Snapshot:</div>
                {completedOrder.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF9F6] rounded-lg border border-[#E8E2D6] flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-[#18231C]">
                        {item.title} {item.quantity > 1 ? `× ${item.quantity}` : ''}
                      </div>
                      <div className="text-[10px] text-[#2D5A46] font-mono">
                        Ngāi Tahu Code: {item.authenticityCode} ({item.originRiver})
                      </div>
                      <div className="text-[10px] text-[#526058]">
                        Carved by Jesse · {item.material} Pounamu
                      </div>
                    </div>
                    <div className="font-mono font-bold text-[#1B382B]">
                      {formatNZD(item.priceCents * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logistics */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D6] text-[11px]">
                <div>
                  {completedOrder.courierName === 'Studio Pickup' ||
                  completedOrder.paymentMethod === 'CASH_ON_PICKUP' ? (
                    <>
                      <div className="font-semibold text-[#18231C]">Studio Pickup Location:</div>
                      <div className="text-[#526058]">{settings.workshopAddress}</div>
                      {completedOrder.pickupNotes && (
                        <div className="text-[#526058] mt-0.5">
                          Note: {completedOrder.pickupNotes}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-[#18231C]">Delivery Address:</div>
                      <div className="text-[#526058]">{completedOrder.shippingAddress.line1}</div>
                      {completedOrder.shippingAddress.line2 && (
                        <div className="text-[#526058]">{completedOrder.shippingAddress.line2}</div>
                      )}
                      <div className="text-[#526058]">
                        {completedOrder.shippingAddress.city},{' '}
                        {completedOrder.shippingAddress.postcode}
                      </div>
                      <div className="text-[#526058]">{completedOrder.shippingAddress.country}</div>
                    </>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-[#18231C]">Payment &amp; Fulfillment:</div>
                  <div className="text-[#526058]">
                    {completedOrder.paymentMethod === 'GIFT_CARD'
                      ? completedOrder.courierName === 'Studio Pickup'
                        ? 'Paid by Gift Card · Napier Studio Pickup'
                        : `Paid by Gift Card · ${completedOrder.courierName} (${completedOrder.courierServiceName})`
                      : completedOrder.paymentMethod === 'CASH_ON_PICKUP'
                      ? 'Cash on Pickup (Pay in NZD on collection)'
                      : `${completedOrder.courierName} (${completedOrder.courierServiceName})`}
                  </div>
                  <div className="text-[#2D5A46] font-semibold">
                    Status: {completedOrder.status}
                  </div>
                </div>
              </div>

              {completedOrder.orderNotes && (
                <div className="p-3 bg-[#FAF9F6] border border-[#E8E2D6] rounded-lg text-[11px] text-[#526058]">
                  <span className="font-semibold text-[#18231C]">Order Notes: </span>
                  <span className="whitespace-pre-line">{completedOrder.orderNotes}</span>
                </div>
              )}

              {/* Financial Totals */}
              <div className="pt-2 border-t border-[#E8E2D6] space-y-1 text-right text-xs">
                <div>Subtotal: {formatNZD(completedOrder.subtotalCents)}</div>
                {completedOrder.discountCents > 0 && (
                  <div className="text-[#2D5A46]">
                    Discount{completedOrder.discountCode ? ` (${completedOrder.discountCode})` : ''}:{' '}
                    -{formatNZD(completedOrder.discountCents)}
                  </div>
                )}
                <div>
                  Shipping:{' '}
                  {completedOrder.courierName === 'Studio Pickup' ||
                  completedOrder.paymentMethod === 'CASH_ON_PICKUP'
                    ? 'FREE (Studio Pickup)'
                    : completedOrder.shippingCents === 0
                    ? 'FREE'
                    : formatNZD(completedOrder.shippingCents)}
                </div>
                {(completedOrder.giftCardAppliedCents || 0) > 0 && (
                  <div className="text-[#2D5A46] font-semibold">
                    Gift Card ({completedOrder.giftCardCode}): -
                    {formatNZD(completedOrder.giftCardAppliedCents || 0)}
                  </div>
                )}
                <div className="text-[#526058]">
                  Includes 15% NZ GST: {formatNZD(completedOrder.gstCents)}
                </div>
                <div className="font-bold text-[#1B382B] text-sm">
                  {completedOrder.paymentMethod === 'CASH_ON_PICKUP' &&
                  completedOrder.paymentStatus !== 'PAID'
                    ? 'Total Due on Pickup'
                    : 'Total Charged'}
                  : {formatNZD(completedOrder.totalCents)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 border border-[#E8E2D6] text-[#526058] hover:text-[#18231C] rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Packing Slip & Invoice</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] cursor-pointer"
              >
                Close & Return to Atelier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
