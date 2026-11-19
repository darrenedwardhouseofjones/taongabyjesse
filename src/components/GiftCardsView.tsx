import React, { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  CreditCard,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  Lock,
  Sparkles,
  MapPin,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  GiftCard,
  GiftCardValidationResult,
  SiteSettings,
  UserProfile,
} from '../types';
import { formatNZD } from '../utils/pricing';
import { apiFetch } from '../utils/api';

interface GiftCardsViewProps {
  settings: SiteSettings;
  currentUser?: UserProfile | null;
  onGiftCardCreated?: (giftCard: GiftCard) => void;
  onApplyGiftCardToCart?: (code: string) => Promise<void> | void;
  onOpenStore?: () => void;
  onOpenPaymentSettings?: () => void;
}

const PRESET_AMOUNTS_CENTS = [5000, 10000, 25000, 50000];

interface StripeGiftCardFormProps {
  giftCard: GiftCard;
  onBack: () => void;
  onConfirmed: (giftCard: GiftCard) => void;
}

const StripeGiftCardForm: React.FC<StripeGiftCardFormProps> = ({
  giftCard,
  onBack,
  onConfirmed,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    try {
      const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (stripeErr) {
        setError(stripeErr.message || 'Card payment could not be authorized.');
        setProcessing(false);
        return;
      }

      if (!paymentIntent) {
        setError('No payment confirmation returned from Stripe.');
        setProcessing(false);
        return;
      }

      const confirmed = await apiFetch<{ giftCard: GiftCard }>('/api/gift-cards/confirm-stripe', {
        method: 'POST',
        body: JSON.stringify({
          giftCardId: giftCard.id,
          paymentIntentId: paymentIntent.id,
        }),
      });

      setProcessing(false);
      onConfirmed(confirmed.giftCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finalize gift card payment.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleConfirm} className="space-y-4">
      <div className="p-4 border border-[#E8E2D6] rounded-xl bg-[#FAF9F6] space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E8E2D6]">
          <span className="font-semibold text-[#18231C] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#1B382B]" />
            Stripe Hosted Card Payment
          </span>
          <span className="font-mono font-bold text-[#1B382B] tabular-nums">
            {formatNZD(giftCard.initialAmountCents)}
          </span>
        </div>

        <PaymentElement onReady={() => setElementReady(true)} options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] flex items-start gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={processing}
          onClick={onBack}
          className="text-xs font-medium text-[#526058] hover:text-[#18231C] cursor-pointer disabled:opacity-50"
        >
          ← Back to Details
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || !elementReady || processing}
          className="px-5 py-2.5 bg-[#1B382B] hover:bg-[#12241B] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-[#7FA892]" />
          <span>
            {processing
              ? 'Issuing Gift Card...'
              : `Pay ${formatNZD(giftCard.initialAmountCents)} & Issue Card`}
          </span>
        </button>
      </div>
    </form>
  );
};

export const GiftCardsView: React.FC<GiftCardsViewProps> = ({
  settings,
  currentUser,
  onGiftCardCreated,
  onApplyGiftCardToCart,
  onOpenStore,
  onOpenPaymentSettings,
}) => {
  const stripeEnabled = settings.stripeEnabled ?? true;
  const cashOnPickupEnabled = settings.cashOnPickupEnabled ?? true;

  // Purchase Configuration State
  const [selectedPresetCents, setSelectedPresetCents] = useState<number | 'custom'>(10000);
  const [customNzd, setCustomNzd] = useState('150');
  const [paymentMode, setPaymentMode] = useState<'STRIPE' | 'CASH_ON_PICKUP'>(
    stripeEnabled ? 'STRIPE' : 'CASH_ON_PICKUP'
  );
  const [purchaserName, setPurchaserName] = useState(
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : ''
  );
  const [purchaserEmail, setPurchaserEmail] = useState(currentUser?.email || '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      setPurchaserName((prev) => prev || `${currentUser.firstName} ${currentUser.lastName}`.trim());
      setPurchaserEmail((prev) => prev || currentUser.email);
    }
  }, [currentUser]);

  // Checkout / Issuance State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stripeNotConfigured, setStripeNotConfigured] = useState(false);
  const [stripeSession, setStripeSession] = useState<{
    giftCard: GiftCard;
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [issuedGiftCard, setIssuedGiftCard] = useState<GiftCard | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);

  // Balance Checker State
  const [lookupCode, setLookupCode] = useState('');
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balanceResult, setBalanceResult] = useState<GiftCardValidationResult | null>(null);

  const amountCents = useMemo(() => {
    if (selectedPresetCents !== 'custom') return selectedPresetCents;
    const parsed = Math.round((parseFloat(customNzd) || 0) * 100);
    return parsed;
  }, [selectedPresetCents, customNzd]);

  const stripePromise: Promise<Stripe | null> | null = useMemo(() => {
    if (!stripeSession?.publishableKey) return null;
    return loadStripe(stripeSession.publishableKey);
  }, [stripeSession?.publishableKey]);

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStripeNotConfigured(false);

    if (amountCents < 2000 || amountCents > 200000) {
      setFormError('Gift card value must be between $20.00 NZD and $2,000.00 NZD.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amountCents,
        purchaserName: purchaserName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        recipientName: recipientName.trim() || purchaserName.trim(),
        recipientEmail: recipientEmail.trim() || purchaserEmail.trim(),
        message: message.trim(),
      };

      if (paymentMode === 'CASH_ON_PICKUP') {
        const res = await apiFetch<{ giftCard: GiftCard }>('/api/gift-cards/purchase-pickup', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setIssuedGiftCard(res.giftCard);
        onGiftCardCreated?.(res.giftCard);
      } else {
        const res = await apiFetch<{
          giftCard: GiftCard;
          clientSecret: string;
          publishableKey: string;
        }>('/api/gift-cards/purchase-stripe', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStripeSession(res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start gift card purchase.';
      setFormError(msg);
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('stripe')) {
        setStripeNotConfigured(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = lookupCode.trim().toUpperCase();
    if (!code) return;
    setCheckingBalance(true);
    try {
      const res = await apiFetch<GiftCardValidationResult>(
        `/api/gift-cards/validate?code=${encodeURIComponent(code)}`
      );
      setBalanceResult(res);
    } catch (err) {
      setBalanceResult({
        valid: false,
        code,
        remainingBalanceCents: 0,
        initialAmountCents: 0,
        error: err instanceof Error ? err.message : 'Unable to validate gift card.',
      });
    } finally {
      setCheckingBalance(false);
    }
  };

  const resetBuilder = () => {
    setIssuedGiftCard(null);
    setStripeSession(null);
    setFormError(null);
    setStripeNotConfigured(false);
    setRecipientName('');
    setRecipientEmail('');
    setMessage('');
  };

  const previewCard = issuedGiftCard || stripeSession?.giftCard || null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-12 font-sans-ui">
      {/* Editorial Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8E2D6] pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[11px] uppercase tracking-[0.22em] text-[#2D5A46] font-bold block">
            Tuku Taonga · Digital Studio Voucher
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C]">
            Atelier Digital Gift Cards
          </h1>
          <p className="text-xs sm:text-sm text-[#526058] leading-relaxed">
            Gift a hand-carved New Zealand greenstone heirloom or bespoke carving session with Jesse. Valid across all studio pendants, custom commissions, and courier shipping — never expires.
          </p>
        </div>
        {onOpenStore && (
          <button
            type="button"
            onClick={onOpenStore}
            className="px-4 py-2 border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-xs font-semibold text-[#18231C] rounded-xl inline-flex items-center gap-1.5 self-start cursor-pointer"
          >
            <span>Browse Collection</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#1B382B]" />
          </button>
        )}
      </div>

      {/* Main Split Grid: Card Preview + Purchase / Issuance Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Tactile Gift Card Visual Preview & Trust Details */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-[#12241B] text-[#FAF9F6] p-7 border border-[#1B382B] shadow-lg space-y-6 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#7FA892] font-semibold">
                  {settings.siteName}
                </div>
                <div className="font-display text-lg font-bold text-white mt-0.5">
                  Digital Taonga Gift Card
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#1B382B] border border-[#7FA892]/30 flex items-center justify-center text-[#C29B38]">
                <Gift className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-[#7FA892]">
                Gift Card Value
              </div>
              <div className="font-display text-4xl font-bold text-white tabular-nums">
                {formatNZD(
                  previewCard ? previewCard.remainingBalanceCents : Math.max(0, amountCents)
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/15 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#7FA892]">For Recipient:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {previewCard?.recipientName || recipientName.trim() || 'Beloved Recipient'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#7FA892]">From:</span>
                <span className="text-[#E8E2D6] truncate max-w-[200px]">
                  {previewCard?.purchaserName || purchaserName.trim() || 'Atelier Patron'}
                </span>
              </div>
              {(previewCard?.message || message.trim()) && (
                <div className="pt-2 text-[11px] italic font-serif-body text-[#E8E2D6] border-t border-white/10">
                  “{previewCard?.message || message.trim()}”
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#7FA892]">Code:</span>
              <span className="px-2.5 py-1 rounded bg-[#1B382B] border border-white/15 text-[#C29B38] tracking-wider font-bold">
                {issuedGiftCard ? issuedGiftCard.code : 'PA-GIFT-XXXX-XXXX'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-5 space-y-3 text-xs text-[#526058]">
            <div className="font-display font-bold text-sm text-[#18231C] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2D5A46]" />
              <span>How Digital Gift Cards Work</span>
            </div>
            <ul className="space-y-2 leading-relaxed">
              <li>
                1. Choose any value from <strong>$20 to $2,000 NZD</strong> and personalize your dedication.
              </li>
              <li>
                2. Pay instantly via <strong>Stripe</strong> (emailed immediately with unique code) or reserve for <strong>Cash on Pickup</strong> in Napier.
              </li>
              <li>
                3. Enter the <code className="font-mono text-[#1B382B]">PA-GIFT-...</code> code in the cart drawer or checkout modal to deduct from any order, partially or in full.
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Interactive Form / Stripe Payment / Issued Receipt */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E8E2D6] p-6 sm:p-7 space-y-6">
          {issuedGiftCard ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2D5A46] text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-[#18231C]">
                    {issuedGiftCard.purchaseStatus === 'ACTIVE'
                      ? 'Digital Gift Card Issued!'
                      : 'Gift Card Reserved — Cash on Pickup'}
                  </h2>
                  <p className="text-xs text-[#526058]">
                    {issuedGiftCard.purchaseStatus === 'ACTIVE'
                      ? `Active immediately and logged for ${issuedGiftCard.recipientEmail}.`
                      : `Reserved in SQLite (${formatNZD(issuedGiftCard.initialAmountCents)}). Bring cash NZD to ${settings.workshopAddress} so Jesse can activate the code.`}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#526058] font-semibold">
                    Unique Gift Card Code
                  </div>
                  <div className="font-mono text-lg font-bold text-[#1B382B] tracking-wider">
                    {issuedGiftCard.code}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(issuedGiftCard.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3.5 py-2 border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-xs font-semibold text-[#18231C] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#2D5A46]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>

                  {issuedGiftCard.purchaseStatus === 'ACTIVE' && onApplyGiftCardToCart && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onApplyGiftCardToCart(issuedGiftCard.code);
                        setAppliedToast(true);
                        setTimeout(() => setAppliedToast(false), 2500);
                      }}
                      className="px-4 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      {appliedToast ? 'Applied to Cart' : 'Apply to Cart'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF9F6] p-4 rounded-xl border border-[#E8E2D6]">
                <div>
                  <span className="text-[#526058] block">Balance</span>
                  <strong className="font-mono text-[#18231C] tabular-nums">
                    {formatNZD(issuedGiftCard.remainingBalanceCents)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#526058] block">Status</span>
                  <strong className="text-[#1B382B]">{issuedGiftCard.purchaseStatus}</strong>
                </div>
                <div>
                  <span className="text-[#526058] block">Recipient</span>
                  <strong className="text-[#18231C]">
                    {issuedGiftCard.recipientName} ({issuedGiftCard.recipientEmail})
                  </strong>
                </div>
                <div>
                  <span className="text-[#526058] block">Payment Mode</span>
                  <strong className="text-[#18231C]">
                    {issuedGiftCard.purchasePaymentMethod === 'CASH_ON_PICKUP'
                      ? 'Cash on Pickup'
                      : 'Stripe Card'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={resetBuilder}
                  className="text-xs font-semibold text-[#1B382B] hover:underline cursor-pointer"
                >
                  Purchase Another Gift Card →
                </button>
                {onOpenStore && (
                  <button
                    type="button"
                    onClick={onOpenStore}
                    className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer"
                  >
                    Shop Collection
                  </button>
                )}
              </div>
            </div>
          ) : stripeSession && stripePromise ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-[#18231C]">
                  2. Authorize Payment for {stripeSession.giftCard.recipientName}
                </h2>
                <p className="text-xs text-[#526058]">
                  Complete payment securely via Stripe. Your digital gift card code is generated immediately upon authorization.
                </p>
              </div>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: stripeSession.clientSecret,
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
                <StripeGiftCardForm
                  giftCard={stripeSession.giftCard}
                  onBack={() => setStripeSession(null)}
                  onConfirmed={(confirmed) => {
                    setStripeSession(null);
                    setIssuedGiftCard(confirmed);
                    onGiftCardCreated?.(confirmed);
                  }}
                />
              </Elements>
            </div>
          ) : (
            <form onSubmit={handlePurchaseSubmit} className="space-y-5 text-xs">
              {formError && (
                <div className="p-3.5 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] space-y-2">
                  <div className="flex items-start gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                  {stripeNotConfigured &&
                    currentUser?.role === 'ADMIN' &&
                    onOpenPaymentSettings && (
                      <button
                        type="button"
                        onClick={onOpenPaymentSettings}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B382B] text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Open Payment Settings</span>
                      </button>
                    )}
                </div>
              )}

              {/* 1. Amount Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-[#18231C] block">
                  1. Select Gift Card Amount (NZD, incl. GST) *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PRESET_AMOUNTS_CENTS.map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setSelectedPresetCents(cents)}
                      className={`py-2.5 px-3 rounded-xl border font-mono font-bold transition-colors cursor-pointer tabular-nums ${
                        selectedPresetCents === cents
                          ? 'bg-[#1B382B] text-white border-[#1B382B]'
                          : 'bg-[#FAF9F6] text-[#18231C] border-[#E8E2D6] hover:border-[#1B382B]'
                      }`}
                    >
                      ${(cents / 100).toFixed(0)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetCents('custom')}
                    className={`py-2.5 px-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
                      selectedPresetCents === 'custom'
                        ? 'bg-[#1B382B] text-white border-[#1B382B]'
                        : 'bg-[#FAF9F6] text-[#18231C] border-[#E8E2D6] hover:border-[#1B382B]'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {selectedPresetCents === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-mono font-bold text-[#18231C]">$ NZD</span>
                    <input
                      type="number"
                      min="20"
                      max="2000"
                      step="1"
                      required
                      value={customNzd}
                      onChange={(e) => setCustomNzd(e.target.value)}
                      className="w-36 p-2 border border-[#E8E2D6] rounded-lg font-mono focus:outline-none focus:border-[#1B382B]"
                    />
                    <span className="text-[11px] text-[#526058]">($20 – $2,000 NZD)</span>
                  </div>
                )}
              </div>

              {/* 2. Sender & Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={purchaserName}
                    onChange={(e) => setPurchaserName(e.target.value)}
                    placeholder="Sender full name"
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Your Email *</label>
                  <input
                    type="email"
                    required
                    value={purchaserEmail}
                    onChange={(e) => setPurchaserEmail(e.target.value)}
                    placeholder="you@example.co.nz"
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Who is this taonga gift for?"
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.co.nz"
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">
                  Personal Message / Blessing (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={280}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Kia kaha, aroha nui — wishing you strength and warmth on your new chapter."
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {/* 3. Payment Method */}
              <div className="space-y-2">
                <label className="font-semibold text-[#18231C] block">
                  2. Purchase Payment Method *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!stripeEnabled}
                    onClick={() => {
                      setPaymentMode('STRIPE');
                      setFormError(null);
                      setStripeNotConfigured(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-45 ${
                      paymentMode === 'STRIPE'
                        ? 'border-[#1B382B] bg-[#F7F9F8] ring-1 ring-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white hover:border-[#1B382B]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[#18231C]">
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#1B382B]" />
                        Stripe Card
                      </span>
                      <span className="text-[10px] font-mono text-[#2D5A46]">Instant Code</span>
                    </div>
                    <p className="text-[11px] text-[#526058] mt-1">
                      Activated immediately and emailed to the recipient upon authorization.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={!cashOnPickupEnabled}
                    onClick={() => {
                      setPaymentMode('CASH_ON_PICKUP');
                      setFormError(null);
                      setStripeNotConfigured(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-45 ${
                      paymentMode === 'CASH_ON_PICKUP'
                        ? 'border-[#1B382B] bg-[#F7F9F8] ring-1 ring-[#1B382B]'
                        : 'border-[#E8E2D6] bg-white hover:border-[#1B382B]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[#18231C]">
                      <span className="flex items-center gap-1.5">
                        <Banknote className="w-4 h-4 text-[#1B382B]" />
                        Cash on Pickup
                      </span>
                      <span className="text-[10px] font-mono text-[#2D5A46]">Napier Studio</span>
                    </div>
                    <p className="text-[11px] text-[#526058] mt-1">
                      Reserve gift card now and pay cash in Napier to activate the code.
                    </p>
                  </button>
                </div>

                {paymentMode === 'CASH_ON_PICKUP' && (
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-[11px] text-[#526058] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#2D5A46] shrink-0" />
                    <span>
                      Studio Pickup: <strong>{settings.workshopAddress}</strong> — Jesse will activate &amp; email the gift card code once cash is collected.
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-5 bg-[#1B382B] hover:bg-[#12241B] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#C29B38]" />
                <span>
                  {submitting
                    ? 'Preparing Gift Card...'
                    : paymentMode === 'CASH_ON_PICKUP'
                    ? `Reserve Cash on Pickup Gift Card (${formatNZD(amountCents)})`
                    : `Continue to Stripe Payment (${formatNZD(amountCents)})`}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Balance Checker Card */}
      <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 sm:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[#18231C]">
              Check Gift Card Balance &amp; Apply to Checkout
            </h2>
            <p className="text-xs text-[#526058]">
              Enter a <code className="font-mono text-[#1B382B]">PA-GIFT-XXXX-XXXX</code> code to verify remaining NZD balance and status.
            </p>
          </div>

          <form onSubmit={handleCheckBalance} className="flex gap-2 w-full md:w-auto md:min-w-[360px]">
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
              placeholder="PA-GIFT-XXXX-XXXX"
              className="flex-1 p-2.5 border border-[#E8E2D6] rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#1B382B]"
            />
            <button
              type="submit"
              disabled={checkingBalance}
              className="px-4 py-2.5 bg-[#1B382B] hover:bg-[#12241B] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5 text-[#7FA892]" />
              <span>{checkingBalance ? 'Checking...' : 'Check'}</span>
            </button>
          </form>
        </div>

        {balanceResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-4 ${
              balanceResult.valid
                ? 'bg-[#F7F9F8] border-[#2D5A46]/30 text-[#18231C]'
                : 'bg-[#A63A2A]/5 border-[#A63A2A]/30 text-[#A63A2A]'
            }`}
          >
            {balanceResult.valid ? (
              <>
                <div className="space-y-0.5">
                  <div className="font-mono font-bold text-sm text-[#1B382B]">
                    {balanceResult.code} · ACTIVE
                  </div>
                  <div className="text-[#526058]">
                    Recipient: <strong>{balanceResult.recipientName || 'Atelier Patron'}</strong> · Original Value:{' '}
                    {formatNZD(balanceResult.initialAmountCents || 0)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[#526058]">
                      Available Balance
                    </div>
                    <div className="font-display text-xl font-bold text-[#1B382B] tabular-nums">
                      {formatNZD(balanceResult.remainingBalanceCents || 0)}
                    </div>
                  </div>
                  {onApplyGiftCardToCart && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onApplyGiftCardToCart(balanceResult.code);
                        onOpenStore?.();
                      }}
                      className="px-4 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white font-semibold rounded-xl cursor-pointer"
                    >
                      Apply &amp; Shop
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{balanceResult.error || 'Gift card could not be verified.'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
