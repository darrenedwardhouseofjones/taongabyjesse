import React, { useState } from 'react';
import {
  Search,
  Truck,
  ExternalLink,
  Printer,
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Courier, Order, SiteSettings } from '../types';
import { formatNZD } from '../utils/pricing';
import { generateOrderReceiptPdf } from '../utils/receiptPdf';
import { apiFetch } from '../utils/api';

interface OrderLookupViewProps {
  orders: Order[];
  settings: SiteSettings;
  couriers?: Courier[];
}

const COMPLETED_STATUSES: Order['status'][] = [
  'PAID',
  'PROCESSING',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
];

export function buildCourierTrackingUrl(
  order: Order,
  couriers: Courier[] = []
): string | null {
  if (!order.trackingNumber) return null;
  const matchedCourier = couriers.find(
    (c) => c.name.toLowerCase() === order.courierName.toLowerCase()
  );
  if (matchedCourier?.trackingUrlTemplate) {
    return matchedCourier.trackingUrlTemplate.replace(
      '{TRACKING}',
      encodeURIComponent(order.trackingNumber)
    );
  }
  if (order.courierName.toLowerCase().includes('aramex')) {
    return `https://www.aramex.co.nz/tools/track?tracking_number=${encodeURIComponent(order.trackingNumber)}`;
  }
  return `https://www.nzpost.co.nz/tools/tracking?track=${encodeURIComponent(order.trackingNumber)}`;
}

export const OrderLookupView: React.FC<OrderLookupViewProps> = ({
  orders,
  settings,
  couriers = [],
}) => {
  const activeSettings = settings;
  const [query, setQuery] = useState('');
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return;
    setIsSearching(true);
    const localMatch = orders.find(
      (o) =>
        o.orderNumber.toUpperCase() === cleanQuery ||
        o.customerEmail.toUpperCase() === cleanQuery
    );
    if (localMatch) {
      setMatchedOrder(localMatch);
      setSearched(true);
      setPdfDownloaded(false);
      setIsSearching(false);
      return;
    }

    try {
      const res = await apiFetch<{ order: Order | null }>(
        `/api/orders/lookup?q=${encodeURIComponent(query.trim())}`
      );
      setMatchedOrder(res.order);
    } catch {
      setMatchedOrder(null);
    }
    setSearched(true);
    setPdfDownloaded(false);
    setIsSearching(false);
  };

  const handleDownloadPdf = () => {
    if (!matchedOrder) return;
    generateOrderReceiptPdf(matchedOrder, activeSettings);
    setPdfDownloaded(true);
    setTimeout(() => setPdfDownloaded(false), 3000);
  };

  const isCompletedPurchase = matchedOrder
    ? COMPLETED_STATUSES.includes(matchedOrder.status)
    : false;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="text-center space-y-3">
        <span className="text-xs uppercase tracking-[0.25em] font-sans-ui text-[#2D5A46] font-semibold">
          Kimi Ota · Customer Order & Courier Tracking
        </span>
        <h1 className="font-display text-3xl font-bold text-[#18231C]">
          Order Lookup & Tracking
        </h1>
        <p className="text-xs sm:text-sm text-[#526058] max-w-lg mx-auto">
          Enter your order reference number or checkout email address to view courier tracking details, taonga provenance, and your digital tax receipt.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto pt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order # (e.g. PA-2026-...) or Email..."
            className="flex-1 p-2.5 border border-[#E8E2D6] rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#1B382B]"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2.5 bg-[#1B382B] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5 text-[#7FA892]" />
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </form>
      </div>

      {searched && (
        <div>
          {matchedOrder ? (
            <div className="bg-white rounded-2xl border border-[#E8E2D6] overflow-hidden shadow-sm space-y-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg text-[#18231C]">
                      {matchedOrder.orderNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        matchedOrder.status === 'SHIPPED' || matchedOrder.status === 'DELIVERED'
                          ? 'bg-[#2D5A46] text-white'
                          : matchedOrder.status === 'REFUNDED'
                          ? 'bg-[#A63A2A] text-white'
                          : matchedOrder.status === 'PENDING'
                          ? 'bg-[#7D8B82] text-white'
                          : 'bg-[#C29B38] text-white'
                      }`}
                    >
                      {matchedOrder.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#526058]">
                    Ordered by {matchedOrder.customerName} on{' '}
                    {new Date(matchedOrder.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-[#526058]">
                    {matchedOrder.paymentMethod === 'CASH_ON_PICKUP' &&
                    matchedOrder.paymentStatus !== 'PAID' &&
                    matchedOrder.status !== 'DELIVERED'
                      ? 'Due on Studio Pickup (15% GST incl.):'
                      : 'Total Paid (15% GST incl.):'}
                  </div>
                  <div className="font-display text-lg font-bold text-[#1B382B] tabular-nums">
                    {formatNZD(matchedOrder.totalCents)}
                  </div>
                </div>
              </div>

              {/* Courier Tracking or Studio Pickup Status Bar */}
              <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-[#1B382B]" />
                  <div className="text-xs">
                    <div className="font-semibold text-[#18231C]">
                      {matchedOrder.courierName === 'Studio Pickup' || matchedOrder.paymentMethod === 'CASH_ON_PICKUP'
                        ? `Studio Pickup — ${activeSettings.workshopAddress}`
                        : `${matchedOrder.courierName}: ${matchedOrder.courierServiceName}`}
                    </div>
                    {matchedOrder.courierName === 'Studio Pickup' || matchedOrder.paymentMethod === 'CASH_ON_PICKUP' ? (
                      <div className="text-[#526058]">
                        {matchedOrder.paymentStatus === 'PAID' || matchedOrder.status === 'DELIVERED'
                          ? 'Collected & Settled at Napier studio.'
                          : `Reserved for studio pickup (${formatNZD(
                              matchedOrder.totalCents
                            )} due on collection).`}
                      </div>
                    ) : matchedOrder.trackingNumber ? (
                      <div className="font-mono text-[#2D5A46] font-bold">
                        Tracking #: {matchedOrder.trackingNumber}
                      </div>
                    ) : (
                      <div className="text-[#526058]">
                        Currently being blessed and packed by Jesse in Napier.
                      </div>
                    )}
                  </div>
                </div>

                {matchedOrder.courierName !== 'Studio Pickup' &&
                  matchedOrder.paymentMethod !== 'CASH_ON_PICKUP' &&
                  matchedOrder.trackingNumber &&
                  (() => {
                    const trackUrl = buildCourierTrackingUrl(matchedOrder, couriers);
                    return trackUrl ? (
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-[#1B382B] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-[#12241B]"
                      >
                        <span>Track on {matchedOrder.courierName}</span>
                        <ExternalLink className="w-3 h-3 text-[#7FA892]" />
                      </a>
                    ) : null;
                  })()}
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-[#18231C]">
                  Carved Taonga Included in this Order
                </h3>
                <div className="space-y-2">
                  {matchedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-[#E8E2D6] flex items-center gap-4 text-xs"
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-14 h-14 object-cover rounded-lg border border-[#E8E2D6]"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-[#18231C]">{item.title}</div>
                        <div className="text-[11px] text-[#526058]">
                          {item.material} Pounamu · Authenticity Code:{' '}
                          <span className="font-mono text-[#2D5A46] font-semibold">
                            {item.authenticityCode}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#526058]">
                          Origin: {item.originRiver} · Hand-Carved by Jesse
                        </div>
                      </div>
                      <div className="font-mono font-bold text-[#1B382B]">
                        {formatNZD(item.priceCents * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital Tax Receipt & PDF Download Section */}
              <section
                aria-label="Digital Receipt"
                className="rounded-2xl border border-[#D8E2DC] bg-[#F7F9F8] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1B382B]/10 text-[#1B382B] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-[#18231C]">
                          Digital Tax Receipt & Provenance Record
                        </h3>
                        {isCompletedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2D5A46] bg-[#2D5A46]/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {matchedOrder.paymentMethod === 'CASH_ON_PICKUP' &&
                            matchedOrder.paymentStatus !== 'PAID' &&
                            matchedOrder.status !== 'DELIVERED'
                              ? 'Reserved · Pay on Pickup'
                              : 'Payment Verified'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#526058] mt-0.5">
                        Issued by {activeSettings.siteName} · NZ GST Reg #{activeSettings.gstNumber} ·{' '}
                        {matchedOrder.paymentMethod === 'GIFT_CARD' ? (
                          <span>
                            Mode: Digital Gift Card{' '}
                            {matchedOrder.giftCardCode ? `(${matchedOrder.giftCardCode})` : ''}
                          </span>
                        ) : matchedOrder.paymentMethod === 'CASH_ON_PICKUP' ? (
                          <span>Mode: Cash on Pickup (Napier Studio)</span>
                        ) : (
                          <>
                            Payment Ref:{' '}
                            <span className="font-mono text-[#18231C]">
                              {matchedOrder.stripePaymentIntentId}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 border border-[#E8E2D6] bg-white text-xs font-semibold rounded-xl text-[#526058] hover:text-[#18231C] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                    {isCompletedPurchase ? (
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="px-4 py-2 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                      >
                        {pdfDownloaded ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA892]" />
                            <span>Receipt PDF Downloaded</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-[#7FA892]" />
                            <span>Download Receipt (PDF)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#526058] italic px-2">
                        PDF receipt available once payment is completed.
                      </span>
                    )}
                  </div>
                </div>

                {/* Receipt Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white rounded-xl border border-[#E8E2D6] p-3.5 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-[#526058]">
                      {matchedOrder.courierName === 'Studio Pickup' ||
                      matchedOrder.paymentMethod === 'CASH_ON_PICKUP'
                        ? 'Customer & Studio Pickup Details'
                        : 'Delivery & Billing Details'}
                    </div>
                    <div className="font-semibold text-[#18231C]">{matchedOrder.customerName}</div>
                    <div className="text-[#526058]">{matchedOrder.customerEmail}</div>
                    {matchedOrder.courierName === 'Studio Pickup' ||
                    matchedOrder.paymentMethod === 'CASH_ON_PICKUP' ? (
                      <div className="text-[#526058] pt-1 space-y-0.5">
                        <div>Studio Pickup: {activeSettings.workshopAddress}</div>
                        {matchedOrder.pickupNotes && (
                          <div className="text-[#2D5A46]">Notes: {matchedOrder.pickupNotes}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[#526058] pt-1">
                        {matchedOrder.shippingAddress.line1}
                        {matchedOrder.shippingAddress.line2
                          ? `, ${matchedOrder.shippingAddress.line2}`
                          : ''}
                        <br />
                        {matchedOrder.shippingAddress.city}, {matchedOrder.shippingAddress.region}{' '}
                        {matchedOrder.shippingAddress.postcode}, {matchedOrder.shippingAddress.country}
                      </div>
                    )}
                    {matchedOrder.orderNotes && (
                      <div className="pt-1.5 mt-1.5 border-t border-[#E8E2D6] text-[11px] text-[#18231C]">
                        <span className="font-semibold">Order Notes: </span>
                        <span className="text-[#526058] whitespace-pre-line">
                          {matchedOrder.orderNotes}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-[#E8E2D6] p-3.5 space-y-1.5 tabular-nums">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-[#526058]">
                      Payment & GST Summary
                    </div>
                    <div className="flex justify-between text-[#526058]">
                      <span>Subtotal (GST incl.)</span>
                      <span className="text-[#18231C] font-medium">
                        {formatNZD(matchedOrder.subtotalCents)}
                      </span>
                    </div>
                    {matchedOrder.discountCents > 0 && (
                      <div className="flex justify-between text-[#2D5A46]">
                        <span>
                          Discount{matchedOrder.discountCode ? ` (${matchedOrder.discountCode})` : ''}
                        </span>
                        <span>-{formatNZD(matchedOrder.discountCents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#526058]">
                      <span>
                        {matchedOrder.courierName === 'Studio Pickup' ||
                        matchedOrder.paymentMethod === 'CASH_ON_PICKUP'
                          ? 'Studio Collection'
                          : `Courier Shipping (${matchedOrder.packageSizeCode})`}
                      </span>
                      <span className="text-[#18231C] font-medium">
                        {matchedOrder.courierName === 'Studio Pickup' ||
                        matchedOrder.paymentMethod === 'CASH_ON_PICKUP'
                          ? 'FREE (Studio Pickup)'
                          : matchedOrder.shippingCents === 0
                          ? 'FREE'
                          : formatNZD(matchedOrder.shippingCents)}
                      </span>
                    </div>
                    {(matchedOrder.giftCardAppliedCents || 0) > 0 && (
                      <div className="flex justify-between text-[#2D5A46] font-medium">
                        <span>
                          Gift Card
                          {matchedOrder.giftCardCode ? ` (${matchedOrder.giftCardCode})` : ''}
                        </span>
                        <span>-{formatNZD(matchedOrder.giftCardAppliedCents || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#526058]">
                      <span>Includes 15% NZ GST</span>
                      <span>{formatNZD(matchedOrder.gstCents)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-[#E8E2D6] font-display font-bold text-sm text-[#1B382B]">
                      <span>
                        {matchedOrder.paymentMethod === 'CASH_ON_PICKUP' &&
                        matchedOrder.paymentStatus !== 'PAID' &&
                        matchedOrder.status !== 'DELIVERED'
                          ? 'Total Due on Pickup (NZD)'
                          : 'Total Paid (NZD)'}
                      </span>
                      <span>{formatNZD(matchedOrder.totalCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#526058]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2D5A46] shrink-0" />
                  <span>
                    Your PDF receipt permanently records each piece’s Ngāi Tahu traceability code and river origin for insurance and family heirloom records.
                  </span>
                </div>
              </section>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#526058] bg-white rounded-2xl border border-[#E8E2D6]">
              No order found matching your query. Please check your reference digits.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

