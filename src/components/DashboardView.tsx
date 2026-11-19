import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Sparkles,
  User,
  TrendingUp,
  Truck,
  SlidersHorizontal,
  Settings,
  LogOut,
  Download,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Layers,
  Globe,
  CreditCard,
  Heart,
  ShoppingCart,
  Trash2,
  Copy,
  Check,
  FileSearch,
  Gift,
  Lock,
} from 'lucide-react';
import {
  Courier,
  CourierRate,
  CustomCommission,
  CustomInspirationTemplate,
  CustomPricingConfig,
  DiscountRule,
  GalleryItem,
  GiftCard,
  Order,
  PageSeoMetadata,
  PolicySectionKey,
  Product,
  SiteSettings,
  UserProfile,
  WishlistItem,
} from '../types';
import { formatNZD } from '../utils/pricing';
import { generateOrderReceiptPdf } from '../utils/receiptPdf';
import { downloadOrdersCsv } from '../utils/ordersCsv';
import { apiFetch } from '../utils/api';
import { AdminDashboard } from './AdminDashboard';
import { buildCourierTrackingUrl, OrderLookupView } from './OrderLookupView';
import type { DashboardSection } from './Navbar';

interface DashboardViewProps {
  user: UserProfile;
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  orders: Order[];
  products: Product[];
  galleryItems: GalleryItem[];
  wishlist: WishlistItem[];
  giftCards?: GiftCard[];
  couriers: Courier[];
  rates: CourierRate[];
  discounts: DiscountRule[];
  customPricing: CustomPricingConfig;
  commissions: CustomCommission[];
  settings: SiteSettings;
  pageSeoMetadata?: PageSeoMetadata[];
  onUpdateOrder: (updatedOrder: Order) => Promise<Order | void> | void;
  onUpdateRate: (rateId: string, newPriceCents: number) => void;
  onBulkRaiseRates: (percent: number) => void;
  onUpdateCourier: (courier: Courier) => Promise<void>;
  onSaveDiscount: (rule: DiscountRule) => Promise<void>;
  onDeleteDiscount: (code: string) => Promise<void>;
  onCreateAdminGiftCard?: (payload: {
    amountCents: number;
    recipientName: string;
    recipientEmail: string;
    purchaserName?: string;
    purchaserEmail?: string;
    message?: string;
    code?: string;
    sendEmail?: boolean;
  }) => Promise<GiftCard>;
  onUpdateAdminGiftCard?: (
    id: string,
    patch: {
      purchaseStatus?: GiftCard['purchaseStatus'];
      isActive?: boolean;
      remainingBalanceCents?: number;
      recipientName?: string;
      recipientEmail?: string;
      activateAndEmail?: boolean;
    }
  ) => Promise<GiftCard>;
  onDeleteAdminGiftCard?: (id: string) => Promise<void>;
  onAddProduct: (newProduct: Product) => Promise<void> | void;
  onUpdateProduct: (updatedProduct: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onAddGalleryItem: (item: Partial<GalleryItem>) => Promise<void>;
  onDeleteGalleryItem: (id: string) => Promise<void>;
  onAddToCartFromWishlist: (product: Product) => void;
  onRemoveFromWishlist: (itemId: string) => Promise<void>;
  onChooseInspirationFromWishlist: (template: CustomInspirationTemplate) => void;
  onUpdateCustomPricing: (config: CustomPricingConfig) => Promise<void>;
  onUpdateCommission: (
    id: string,
    patch: {
      status?: CustomCommission['status'];
      quoteAmountCents?: number;
      depositAmountCents?: number;
      leadTimeWeeks?: number;
    }
  ) => Promise<void>;
  onSendCommissionMessage: (
    commissionId: string,
    text: string,
    sender: 'customer' | 'carver'
  ) => Promise<void>;
  onAcceptCommissionQuote: (commissionId: string, email: string) => Promise<void>;
  onUpdateSettings: (newSettings: SiteSettings) => Promise<SiteSettings | void> | void;
  onPageSeoChange?: (nextList: PageSeoMetadata[], updatedSettings?: SiteSettings) => void;
  onUpdateProfile: (firstName: string, lastName: string) => Promise<void>;
  onBrowseStore: () => void;
  onBrowseGallery: () => void;
  onOpenGiftCards?: () => void;
  onStartCustom: () => void;
  onOpenPolicies?: (section?: PolicySectionKey) => void;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  activeSection,
  onSelectSection,
  orders,
  products,
  galleryItems,
  wishlist,
  giftCards = [],
  couriers,
  rates,
  discounts,
  customPricing,
  commissions,
  settings,
  pageSeoMetadata = [],
  onUpdateOrder,
  onUpdateRate,
  onBulkRaiseRates,
  onUpdateCourier,
  onSaveDiscount,
  onDeleteDiscount,
  onCreateAdminGiftCard,
  onUpdateAdminGiftCard,
  onDeleteAdminGiftCard,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddGalleryItem,
  onDeleteGalleryItem,
  onAddToCartFromWishlist,
  onRemoveFromWishlist,
  onChooseInspirationFromWishlist,
  onUpdateCustomPricing,
  onUpdateCommission,
  onSendCommissionMessage,
  onAcceptCommissionQuote,
  onUpdateSettings,
  onPageSeoChange,
  onUpdateProfile,
  onBrowseStore,
  onBrowseGallery,
  onOpenGiftCards,
  onStartCustom,
  onOpenPolicies,
  onLogout,
}) => {
  const [downloadedOrderId, setDownloadedOrderId] = useState<string | null>(null);
  const [copiedOrderTrackingId, setCopiedOrderTrackingId] = useState<string | null>(null);
  const [copiedGiftCardId, setCopiedGiftCardId] = useState<string | null>(null);
  const [acceptingCommId, setAcceptingCommId] = useState<string | null>(null);
  const [firstNameInput, setFirstNameInput] = useState(user.firstName);
  const [lastNameInput, setLastNameInput] = useState(user.lastName);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [csvExportNotice, setCsvExportNotice] = useState<string | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isAdmin = user.role === 'ADMIN';

  // Client-scoped orders, gift cards & commissions
  const myOrders = orders.filter(
    (o) =>
      o.userId === user.id ||
      o.customerEmail.toLowerCase() === user.email.toLowerCase()
  );

  const myGiftCards = giftCards.filter(
    (g) =>
      g.purchaserEmail.toLowerCase() === user.email.toLowerCase() ||
      g.recipientEmail.toLowerCase() === user.email.toLowerCase()
  );

  const myCommissions = commissions.filter(
    (c) => c.customerEmail.toLowerCase() === user.email.toLowerCase()
  );

  const unfulfilledCount = orders.filter(
    (o) => o.status === 'PAID' || o.status === 'PROCESSING' || o.status === 'FULFILLING'
  ).length;
  const pendingCommissionsCount = commissions.filter((c) => c.status === 'REQUESTED').length;

  // Guard admin sections if non-admin somehow selects one
  const effectiveSection: DashboardSection =
    !isAdmin && activeSection.startsWith('admin-') ? 'client-orders' : activeSection;

  const handleDownloadPdf = (order: Order) => {
    generateOrderReceiptPdf(order, settings);
    setDownloadedOrderId(order.id);
    setTimeout(() => setDownloadedOrderId(null), 3000);
  };

  const handleAdminExportOrdersCsv = () => {
    if (!isAdmin || orders.length === 0) return;
    const filename = downloadOrdersCsv(orders);
    setCsvExportNotice(`Exported ${orders.length} order${orders.length === 1 ? '' : 's'} to ${filename}`);
    setTimeout(() => setCsvExportNotice(null), 5000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstNameInput.trim()) return;
    setProfileSaving(true);
    try {
      await onUpdateProfile(firstNameInput.trim(), lastNameInput.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPasswordInput.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 font-sans-ui">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT SIDEBAR MENU */}
        <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-[#E8E2D6] shadow-xs overflow-hidden lg:sticky lg:top-24">
          {/* User Identity Card */}
          <div className="p-4 border-b border-[#E8E2D6] bg-[#FAF9F6] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1B382B] to-[#2D5A46] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-[#18231C] truncate">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[11px] text-[#526058] truncate">{user.email}</div>
              <span
                className={`inline-block mt-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-[#1B382B] text-white'
                    : 'bg-[#2D5A46]/15 text-[#2D5A46]'
                }`}
              >
                {isAdmin ? 'Studio Admin' : 'Client Member'}
              </span>
            </div>
          </div>

          <nav className="p-3 space-y-5 text-xs">
            {/* Client Account Navigation */}
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#7D8B82]">
                My Account
              </div>

              <button
                type="button"
                onClick={() => onSelectSection('client-overview')}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-overview'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-orders')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-orders'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Order History</span>
                </span>
                {myOrders.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      effectiveSection === 'client-orders'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E8E2D6] text-[#18231C]'
                    }`}
                  >
                    {myOrders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-tracking')}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-tracking'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span>Order Tracking</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-wishlist')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-wishlist'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 shrink-0" />
                  <span>Saved Wishlist</span>
                </span>
                {wishlist.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      effectiveSection === 'client-wishlist'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E8E2D6] text-[#18231C]'
                    }`}
                  >
                    {wishlist.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-gift-cards')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-gift-cards'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>Gift Cards</span>
                </span>
                {myGiftCards.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      effectiveSection === 'client-gift-cards'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E8E2D6] text-[#18231C]'
                    }`}
                  >
                    {myGiftCards.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-commissions')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-commissions'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Custom Requests</span>
                </span>
                {myCommissions.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      effectiveSection === 'client-commissions'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E8E2D6] text-[#18231C]'
                    }`}
                  >
                    {myCommissions.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectSection('client-profile')}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                  effectiveSection === 'client-profile'
                    ? 'bg-[#1B382B] text-white shadow-xs'
                    : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <span>Profile Settings</span>
              </button>
            </div>

            {/* Admin Section in Left Sidebar (Admin Role Only) */}
            {isAdmin && (
              <div className="space-y-1 pt-3 border-t border-[#E8E2D6]">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#2D5A46] flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin</span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-kpis')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-kpis'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span>KPI & Analytics</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-orders')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-orders'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>Orders & Dispatch</span>
                  </span>
                  {unfulfilledCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C29B38] text-white">
                      {unfulfilledCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-commissions')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-commissions'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Custom Commissions</span>
                  </span>
                  {pendingCommissionsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C29B38] text-white">
                      {pendingCommissionsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-couriers')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-couriers'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  <span>Couriers & Promos</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-catalogue')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-catalogue'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>Stone Inventory</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-settings')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-settings'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Site & Auth Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-payments')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-payments'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Payment Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-seo')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-seo'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>SEO & Open Graph</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('admin-seo-audit')}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer ${
                    effectiveSection === 'admin-seo-audit'
                      ? 'bg-[#1B382B] text-white shadow-xs'
                      : 'text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <FileSearch className="w-4 h-4 shrink-0" />
                  <span>SEO Audit</span>
                </button>
              </div>
            )}

            {/* Sign Out */}
            <div className="pt-3 border-t border-[#E8E2D6]">
              <button
                type="button"
                onClick={onLogout}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 font-medium text-[#A63A2A] hover:bg-[#A63A2A]/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* CLIENT OVERVIEW */}
          {effectiveSection === 'client-overview' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-2 shadow-xs">
                <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                  Kia ora, {user.firstName}
                </span>
                <h1 className="font-display text-2xl font-bold text-[#18231C]">
                  Your Pounamu Atelier Dashboard
                </h1>
                <p className="text-xs text-[#526058]">
                  Track your orders, download official GST & Ngāi Tahu provenance PDF receipts, and follow bespoke carving requests.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => onSelectSection('client-orders')}
                  className="p-5 bg-white rounded-2xl border border-[#E8E2D6] text-left hover:border-[#1B382B] transition-colors cursor-pointer space-y-1"
                >
                  <span className="text-xs text-[#526058]">Total Orders</span>
                  <div className="font-display text-2xl font-bold text-[#1B382B]">
                    {myOrders.length}
                  </div>
                  <span className="text-[11px] font-semibold text-[#2D5A46] inline-flex items-center gap-1">
                    View order history <ArrowRight className="w-3 h-3" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection('client-commissions')}
                  className="p-5 bg-white rounded-2xl border border-[#E8E2D6] text-left hover:border-[#1B382B] transition-colors cursor-pointer space-y-1"
                >
                  <span className="text-xs text-[#526058]">Custom Carving Requests</span>
                  <div className="font-display text-2xl font-bold text-[#18231C]">
                    {myCommissions.length}
                  </div>
                  <span className="text-[11px] font-semibold text-[#2D5A46] inline-flex items-center gap-1">
                    Manage commissions <ArrowRight className="w-3 h-3" />
                  </span>
                </button>

                <div className="p-5 bg-white rounded-2xl border border-[#E8E2D6] space-y-1">
                  <span className="text-xs text-[#526058]">Signed In Via</span>
                  <div className="font-display text-lg font-bold text-[#18231C] capitalize">
                    {user.authProvider === 'google' ? 'Gmail / Google' : 'Email Account'}
                  </div>
                  <span className="text-[11px] text-[#526058] block truncate">{user.email}</span>
                </div>
              </div>

              {myOrders.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-[#18231C]">
                      Most Recent Purchase
                    </h2>
                    <button
                      type="button"
                      onClick={() => onSelectSection('client-orders')}
                      className="text-xs font-semibold text-[#1B382B] hover:underline cursor-pointer"
                    >
                      View all ({myOrders.length})
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-[#18231C]">{myOrders[0].orderNumber}</div>
                      <div className="text-[#526058]">
                        {new Date(myOrders[0].createdAt).toLocaleDateString()} ·{' '}
                        {myOrders[0].items.map((i) => i.title).join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[#1B382B]">
                        {formatNZD(myOrders[0].totalCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(myOrders[0])}
                        className="px-3 py-1.5 bg-[#1B382B] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#7FA892]" />
                        <span>Receipt PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CLIENT ORDER HISTORY */}
          {effectiveSection === 'client-orders' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                      Client Records
                    </span>
                    <h1 className="font-display text-2xl font-bold text-[#18231C]">
                      Order History & Receipts
                    </h1>
                    <p className="text-xs text-[#526058]">
                      All purchases associated with {user.email}. Download PDF tax receipts and verify Ngāi Tahu provenance codes.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleAdminExportOrdersCsv}
                        disabled={orders.length === 0}
                        className="px-4 py-2 border border-[#1B382B]/30 bg-[#FAF9F6] text-[#18231C] text-xs font-semibold rounded-xl hover:bg-[#E8E2D6]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Download all store orders CSV (Order ID, Customer Email, Total, Status, SKUs, GST) for accounting and inventory reporting"
                      >
                        <Download className="w-3.5 h-3.5 text-[#2D5A46]" />
                        <span>Download All Orders CSV ({orders.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onBrowseStore}
                      className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer"
                    >
                      Browse Collection
                    </button>
                  </div>
                </div>
                {isAdmin && csvExportNotice && (
                  <div className="p-2.5 rounded-xl bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                    <span>{csvExportNotice}</span>
                  </div>
                )}
              </div>

              {myOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E2D6] p-12 text-center space-y-3">
                  <Package className="w-8 h-8 text-[#7FA892] mx-auto" />
                  <h2 className="font-display text-lg font-bold text-[#18231C]">
                    No orders found yet
                  </h2>
                  <p className="text-xs text-[#526058] max-w-md mx-auto">
                    When you complete a pounamu purchase using {user.email}, your order tracking and downloadable PDF receipts will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map((order) => {
                    const isCompleted = [
                      'PAID',
                      'PROCESSING',
                      'FULFILLING',
                      'SHIPPED',
                      'DELIVERED',
                    ].includes(order.status);
                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-4 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-base text-[#18231C]">
                                {order.orderNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  order.status === 'SHIPPED' || order.status === 'DELIVERED'
                                    ? 'bg-[#2D5A46] text-white'
                                    : order.status === 'REFUNDED'
                                    ? 'bg-[#A63A2A] text-white'
                                    : order.status === 'PENDING'
                                    ? 'bg-[#7D8B82] text-white'
                                    : 'bg-[#C29B38] text-white'
                                }`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#526058] mt-0.5">
                              Placed on{' '}
                              {new Date(order.createdAt).toLocaleDateString('en-NZ', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}{' '}
                              ·{' '}
                              {order.paymentMethod === 'GIFT_CARD'
                                ? `Gift Card (${order.giftCardCode || 'Digital'}) · ${
                                    order.courierName === 'Studio Pickup'
                                      ? 'Napier Studio Pickup'
                                      : `${order.courierName} (${order.courierServiceName})`
                                  }`
                                : order.paymentMethod === 'CASH_ON_PICKUP'
                                ? `Cash on Pickup (${
                                    order.paymentStatus === 'PAID' || order.status === 'DELIVERED'
                                      ? 'Paid'
                                      : 'Pay on Collection'
                                  }) · Napier Studio`
                                : `Stripe Card · ${order.courierName} (${order.courierServiceName})`}
                              {(order.giftCardAppliedCents || 0) > 0 &&
                                order.paymentMethod !== 'GIFT_CARD' && (
                                  <span>
                                    {' '}
                                    · Gift Card {order.giftCardCode}: -
                                    {formatNZD(order.giftCardAppliedCents || 0)}
                                  </span>
                                )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] text-[#526058]">
                                {order.paymentMethod === 'CASH_ON_PICKUP' &&
                                order.paymentStatus !== 'PAID' &&
                                order.status !== 'DELIVERED'
                                  ? 'Due on Pickup (GST incl.)'
                                  : 'Total (GST incl.)'}
                              </div>
                              <div className="font-display font-bold text-base text-[#1B382B] tabular-nums">
                                {formatNZD(order.totalCents)}
                              </div>
                            </div>

                            {isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(order)}
                                className="px-3.5 py-2 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                {downloadedOrderId === order.id ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA892]" />
                                    <span>Downloaded</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 text-[#7FA892]" />
                                    <span>Receipt PDF</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items in Order */}
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] flex items-center gap-3.5 text-xs"
                            >
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-12 h-12 rounded-lg object-cover border border-[#E8E2D6]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-[#18231C] truncate">{item.title}</div>
                                <div className="text-[11px] text-[#526058]">
                                  {item.material} Pounamu · Code:{' '}
                                  <span className="font-mono font-semibold text-[#2D5A46]">
                                    {item.authenticityCode}
                                  </span>{' '}
                                  · Qty {item.quantity}
                                </div>
                              </div>
                              <div className="font-mono font-bold text-[#1B382B]">
                                {formatNZD(item.priceCents * item.quantity)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {order.orderNotes && (
                          <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-xs text-[#526058]">
                            <span className="font-semibold text-[#18231C]">Order Notes: </span>
                            <span className="whitespace-pre-line">{order.orderNotes}</span>
                          </div>
                        )}

                        {/* Courier Tracking or Studio Pickup Status */}
                        {order.paymentMethod === 'CASH_ON_PICKUP' ? (
                          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-xs text-[#526058] flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-[#18231C]">
                                {order.status === 'DELIVERED'
                                  ? 'Collected from Napier Studio — Cash Payment Settled'
                                  : `Reserved for Napier Studio Pickup — ${formatNZD(order.totalCents)} Due on Collection`}
                              </div>
                              <div>Location: {settings.workshopAddress}</div>
                              {order.pickupNotes && (
                                <div className="text-[11px] text-[#2D5A46]">
                                  Pickup Note: {order.pickupNotes}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : order.trackingNumber ? (() => {
                          const trackUrl = buildCourierTrackingUrl(order, couriers);
                          return (
                            <div className="p-3.5 rounded-xl bg-[#2D5A46]/6 border border-[#2D5A46]/25 flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-[#1B382B]">
                                  <Truck className="w-4 h-4 text-[#2D5A46]" />
                                  <span>
                                    {order.status === 'DELIVERED'
                                      ? `Delivered via ${order.courierName} (${order.courierServiceName})`
                                      : order.status === 'SHIPPED'
                                      ? `Dispatched via ${order.courierName} (${order.courierServiceName})`
                                      : `Courier Allocation — ${order.courierName}`}
                                  </span>
                                  {order.shippedAt && (
                                    <span className="text-[11px] font-normal text-[#526058]">
                                      ·{' '}
                                      {new Date(order.shippedAt).toLocaleDateString('en-NZ', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[#526058]">
                                  <span>Tracking #:</span>
                                  <strong className="font-mono text-[#18231C] tracking-wide">
                                    {order.trackingNumber}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(order.trackingNumber || '');
                                      setCopiedOrderTrackingId(order.id);
                                      setTimeout(() => setCopiedOrderTrackingId(null), 1800);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E8E2D6] text-[10px] font-semibold text-[#18231C] hover:bg-[#FAF9F6] cursor-pointer"
                                  >
                                    {copiedOrderTrackingId === order.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-[#2D5A46]" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-[#526058]" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {trackUrl && (
                                <a
                                  href={trackUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3.5 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>Track Parcel</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-[#7FA892]" />
                                </a>
                              )}
                            </div>
                          );
                        })() : order.status === 'DELIVERED' ? (
                          <div className="p-3 rounded-xl bg-[#2D5A46]/8 border border-[#2D5A46]/25 text-xs text-[#1B382B] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                            <span>
                              Delivered via {order.courierName}
                              {order.deliveredAt
                                ? ` on ${new Date(order.deliveredAt).toLocaleDateString('en-NZ')}`
                                : ''}
                              .
                            </span>
                          </div>
                        ) : order.status === 'SHIPPED' ? (
                          <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-xs text-[#526058] flex items-center gap-2">
                            <Truck className="w-4 h-4 text-[#2D5A46] shrink-0" />
                            <span>
                              Shipped via {order.courierName} — courier tracking number will appear here once updated by the studio.
                            </span>
                          </div>
                        ) : (order.status === 'PAID' ||
                            order.status === 'PROCESSING' ||
                            order.status === 'FULFILLING') ? (
                          <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-xs text-[#526058] flex items-center gap-2">
                            <Truck className="w-4 h-4 text-[#C29B38] shrink-0" />
                            <span>
                              {order.status === 'PROCESSING'
                                ? `Processing in Napier workshop — your ${order.courierName} tracking number will appear here once dispatched.`
                                : `Preparing for dispatch — your ${order.courierName} tracking number will appear here as soon as your parcel is booked.`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CLIENT ORDER TRACKING */}
          {effectiveSection === 'client-tracking' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                    Courier & Dispatch Progress
                  </span>
                  <h1 className="font-display text-2xl font-bold text-[#18231C]">
                    Track Your Orders
                  </h1>
                  <p className="text-xs text-[#526058]">
                    Live dispatch progress and courier tracking links for your pounamu orders, plus reference lookup.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('client-orders')}
                  className="px-4 py-2 border border-[#E8E2D6] text-[#18231C] text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                >
                  View Order History
                </button>
              </div>

              {myOrders.length > 0 && (
                <div className="space-y-4">
                  {myOrders.map((order) => {
                    const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED';
                    const isPreparing =
                      order.status === 'PAID' ||
                      order.status === 'PROCESSING' ||
                      order.status === 'FULFILLING';
                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-base text-[#18231C]">
                                {order.orderNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  isShipped
                                    ? 'bg-[#2D5A46] text-white'
                                    : order.status === 'REFUNDED'
                                    ? 'bg-[#A63A2A] text-white'
                                    : 'bg-[#C29B38] text-white'
                                }`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#526058] mt-0.5">
                              {order.items.map((i) => i.title).join(', ')}
                            </div>
                          </div>

                          {order.trackingNumber && (() => {
                            const trackUrl = buildCourierTrackingUrl(order, couriers);
                            return trackUrl ? (
                              <a
                                href={trackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 hover:bg-[#12241B] transition-colors"
                              >
                                <span>Track on {order.courierName}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#7FA892]" />
                              </a>
                            ) : null;
                          })()}
                        </div>

                        {/* 3-Step Fulfilment Progress */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3.5 rounded-xl bg-[#F7F9F8] border border-[#D8E2DC] space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-[#2D5A46]">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>1. Order Confirmed</span>
                            </div>
                            <p className="text-[11px] text-[#526058]">
                              {order.paymentMethod === 'CASH_ON_PICKUP'
                                ? `Reserved for Cash on Pickup on ${new Date(
                                    order.createdAt
                                  ).toLocaleDateString('en-NZ')}.`
                                : `Payment verified on ${new Date(order.createdAt).toLocaleDateString(
                                    'en-NZ'
                                  )}.`}
                            </p>
                          </div>

                          <div
                            className={`p-3.5 rounded-xl border space-y-1 ${
                              isPreparing || isShipped
                                ? 'bg-[#F7F9F8] border-[#D8E2DC]'
                                : 'bg-[#FAF9F6] border-[#E8E2D6] opacity-60'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1.5 font-bold ${
                                isPreparing || isShipped ? 'text-[#2D5A46]' : 'text-[#526058]'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>2. Blessed &amp; Packed</span>
                            </div>
                            <p className="text-[11px] text-[#526058]">
                              Prepared with provenance certificate in Napier.
                            </p>
                          </div>

                          <div
                            className={`p-3.5 rounded-xl border space-y-1 ${
                              isShipped
                                ? 'bg-[#F7F9F8] border-[#D8E2DC]'
                                : 'bg-[#FAF9F6] border-[#E8E2D6]'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1.5 font-bold ${
                                isShipped ? 'text-[#2D5A46]' : 'text-[#526058]'
                              }`}
                            >
                              <Truck className="w-4 h-4" />
                              <span>
                                {order.paymentMethod === 'CASH_ON_PICKUP'
                                  ? '3. Collected & Paid'
                                  : '3. Courier Dispatched'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#526058]">
                              {order.paymentMethod === 'CASH_ON_PICKUP'
                                ? order.status === 'DELIVERED'
                                  ? 'Collected at Napier studio.'
                                  : `Pay ${formatNZD(order.totalCents)} when collecting in Napier.`
                                : order.trackingNumber
                                ? `Tracking #: ${order.trackingNumber}`
                                : 'Awaiting courier pickup from studio.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Embedded Order Reference Lookup & PDF Receipt */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] overflow-hidden">
                <OrderLookupView orders={orders} settings={settings} couriers={couriers} />
              </div>
            </div>
          )}

          {/* CLIENT SAVED WISHLIST */}
          {effectiveSection === 'client-wishlist' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                    Personal Curation
                  </span>
                  <h1 className="font-display text-2xl font-bold text-[#18231C]">
                    My Saved Wishlist ({wishlist.length})
                  </h1>
                  <p className="text-xs text-[#526058] mt-1">
                    Track pieces you love. If a 1-of-1 carving sells before you order it, you can commission a similar carving directly with Jesse.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onBrowseGallery}
                  className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Explore Gallery</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {wishlist.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E2D6] p-12 text-center space-y-3">
                  <Heart className="w-8 h-8 text-[#A63A2A] mx-auto" />
                  <h2 className="font-display text-lg font-bold text-[#18231C]">
                    Your wishlist is empty
                  </h2>
                  <p className="text-xs text-[#526058] max-w-md mx-auto">
                    Tap the heart icon on any present carving or past archive piece to save it here for later.
                  </p>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={onBrowseStore}
                      className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer"
                    >
                      Browse Storefront
                    </button>
                    <button
                      type="button"
                      onClick={onBrowseGallery}
                      className="px-4 py-2 border border-[#E8E2D6] text-[#18231C] text-xs font-semibold rounded-xl hover:bg-[#FAF9F6] cursor-pointer"
                    >
                      Browse Past &amp; Present Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {wishlist.map((item) => {
                    const matchedProduct = products.find((p) => p.id === item.itemId);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-[#E8E2D6] overflow-hidden flex flex-col justify-between"
                      >
                        <div className="p-4 flex gap-4">
                          <img
                            src={item.image}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-24 h-24 rounded-xl object-cover border border-[#E8E2D6] shrink-0 bg-[#FAF9F6]"
                          />
                          <div className="flex-1 min-w-0 space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span
                                className={`font-semibold ${
                                  item.isAvailableNow ? 'text-[#2D5A46]' : 'text-[#8C6D1F]'
                                }`}
                              >
                                {item.isAvailableNow ? 'Available Now' : 'Sold Archive'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#526058]">{item.material}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#526058]">{item.designType}</span>
                            </div>

                            <h3 className="font-display text-sm font-bold text-[#18231C] truncate">
                              {item.title}
                            </h3>

                            {item.originRiver && (
                              <div className="text-[11px] text-[#526058] truncate">
                                {item.originRiver}
                              </div>
                            )}

                            {item.isAvailableNow && item.priceCents ? (
                              <div className="font-mono font-bold text-sm text-[#1B382B] pt-1">
                                {formatNZD(item.priceCents)}
                              </div>
                            ) : (
                              <div className="text-[11px] font-medium text-[#2D5A46] pt-1">
                                Available as Custom Design Request
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-4 py-3 bg-[#FAF9F6] border-t border-[#E8E2D6] flex items-center justify-between gap-2 text-xs">
                          {item.isAvailableNow && matchedProduct ? (
                            <button
                              type="button"
                              onClick={() => onAddToCartFromWishlist(matchedProduct)}
                              className="px-3.5 py-2 bg-[#1B382B] text-white font-semibold rounded-xl hover:bg-[#12241B] flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 text-[#7FA892]" />
                              <span>Add to Cart</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onChooseInspirationFromWishlist({
                                  sourceId: item.itemId,
                                  title: item.title,
                                  material: item.material,
                                  designType: item.designType,
                                  authenticityCode: item.authenticityCode,
                                  originRiver: item.originRiver,
                                  imageUrl: item.image,
                                })
                              }
                              className="px-3.5 py-2 bg-[#1B382B] text-white font-semibold rounded-xl hover:bg-[#12241B] flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                              <span>Commission Inspired Piece</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void onRemoveFromWishlist(item.itemId)}
                            className="p-2 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Remove from Wishlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CLIENT GIFT CARDS */}
          {effectiveSection === 'client-gift-cards' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                    Digital Studio Vouchers
                  </span>
                  <h1 className="font-display text-2xl font-bold text-[#18231C]">
                    My Gift Cards ({myGiftCards.length})
                  </h1>
                  <p className="text-xs text-[#526058] mt-1">
                    Gift cards purchased by or sent to {user.email}. Copy a code to deduct from your next order at checkout.
                  </p>
                </div>
                {onOpenGiftCards && (
                  <button
                    type="button"
                    onClick={onOpenGiftCards}
                    className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5 text-[#C29B38]" />
                    <span>Buy Digital Gift Card</span>
                  </button>
                )}
              </div>

              {myGiftCards.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E2D6] p-12 text-center space-y-3">
                  <Gift className="w-8 h-8 text-[#2D5A46] mx-auto" />
                  <h2 className="font-display text-lg font-bold text-[#18231C]">
                    No gift cards found for {user.email}
                  </h2>
                  <p className="text-xs text-[#526058] max-w-md mx-auto">
                    Purchase a Pounamu Atelier digital gift card for yourself or someone special, or check a code on our Gift Cards page.
                  </p>
                  {onOpenGiftCards && (
                    <button
                      type="button"
                      onClick={onOpenGiftCards}
                      className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer"
                    >
                      Open Gift Card Studio
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myGiftCards.map((gc) => (
                    <div
                      key={gc.id}
                      className="bg-white rounded-2xl border border-[#E8E2D6] p-5 space-y-4 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[#526058] font-semibold">
                            Digital Gift Card
                          </div>
                          <div className="font-mono font-bold text-base text-[#1B382B] tracking-wider">
                            {gc.code}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            gc.purchaseStatus === 'ACTIVE'
                              ? 'bg-[#2D5A46] text-white'
                              : gc.purchaseStatus === 'PENDING'
                              ? 'bg-[#C29B38] text-white'
                              : 'bg-[#7D8B82] text-white'
                          }`}
                        >
                          {gc.purchaseStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6]">
                        <div>
                          <div className="text-[10px] text-[#526058]">Remaining Balance</div>
                          <div className="font-display text-lg font-bold text-[#1B382B] tabular-nums">
                            {formatNZD(gc.remainingBalanceCents)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#526058]">Original Value</div>
                          <div className="font-mono font-semibold text-[#18231C] tabular-nums">
                            {formatNZD(gc.initialAmountCents)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#526058] space-y-0.5">
                        <div>
                          To: <strong className="text-[#18231C]">{gc.recipientName}</strong> ({gc.recipientEmail})
                        </div>
                        <div>
                          From: <strong className="text-[#18231C]">{gc.purchaserName}</strong> ({gc.purchaserEmail})
                        </div>
                        {gc.message && <div className="italic pt-1">“{gc.message}”</div>}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E8E2D6]">
                        <span className="text-[10px] text-[#526058]">
                          Issued {new Date(gc.createdAt).toLocaleDateString('en-NZ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(gc.code);
                            setCopiedGiftCardId(gc.id);
                            setTimeout(() => setCopiedGiftCardId(null), 1800);
                          }}
                          className="px-3 py-1.5 border border-[#E8E2D6] rounded-lg font-semibold text-[#18231C] hover:bg-[#FAF9F6] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedGiftCardId === gc.id ? (
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLIENT CUSTOM COMMISSIONS */}
          {effectiveSection === 'client-commissions' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                    Bespoke Atelier
                  </span>
                  <h1 className="font-display text-2xl font-bold text-[#18231C]">
                    My Custom Carving Requests
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={onStartCustom}
                  className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                  <span>Start Custom Piece</span>
                </button>
              </div>

              {myCommissions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E2D6] p-12 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-[#C29B38] mx-auto" />
                  <h2 className="font-display text-lg font-bold text-[#18231C]">
                    No custom commissions yet
                  </h2>
                  <p className="text-xs text-[#526058] max-w-md mx-auto">
                    Have Jesse carve a custom heirloom piece tailored to your story, stone variety, and cord style.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myCommissions.map((comm) => {
                    const latestMsg = comm.messages[comm.messages.length - 1];
                    return (
                      <div
                        key={comm.id}
                        className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-[#2D5A46]">
                              {comm.referenceNumber}
                            </span>
                            <h3 className="font-display text-base font-bold text-[#18231C]">
                              {comm.material} {comm.designType} ({comm.pendantSizeMm}mm)
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {comm.quoteAmountCents ? (
                              <span className="font-mono font-bold text-sm text-[#1B382B]">
                                {formatNZD(comm.quoteAmountCents)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#526058]">Awaiting Quote</span>
                            )}
                            <span className="px-2.5 py-1 rounded-full bg-[#1B382B]/10 text-[#1B382B] font-bold text-[10px] uppercase">
                              {comm.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        <p className="text-[#526058]">{comm.specialNotes}</p>
                        <div className="text-[11px] text-[#526058]">
                          Cord: {comm.cordStyle} · Binding: {comm.bindingStyle}
                          {comm.leadTimeWeeks ? ` · Est. Lead Time: ${comm.leadTimeWeeks} weeks` : ''}
                        </div>

                        {latestMsg && (
                          <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-[11px]">
                            <strong className="text-[#18231C]">{latestMsg.senderName}:</strong>{' '}
                            <span className="text-[#526058]">{latestMsg.text}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={onStartCustom}
                            className="text-xs font-semibold text-[#1B382B] hover:underline cursor-pointer"
                          >
                            Open Full Message Thread in Custom Atelier →
                          </button>

                          {comm.status === 'QUOTED' && (
                            <button
                              type="button"
                              disabled={acceptingCommId === comm.id}
                              onClick={async () => {
                                setAcceptingCommId(comm.id);
                                try {
                                  await onAcceptCommissionQuote(comm.id, user.email);
                                } finally {
                                  setAcceptingCommId(null);
                                }
                              }}
                              className="px-3.5 py-1.5 bg-[#1B382B] text-white font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer disabled:opacity-50"
                            >
                              {acceptingCommId === comm.id ? 'Accepting...' : 'Accept Quote'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CLIENT PROFILE SETTINGS */}
          {effectiveSection === 'client-profile' && (
            <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6 max-w-xl shadow-xs">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-[#2D5A46] font-bold">
                  Account Details
                </span>
                <h1 className="font-display text-xl font-bold text-[#18231C]">
                  Profile Settings
                </h1>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C] block">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstNameInput}
                      onChange={(e) => setFirstNameInput(e.target.value)}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C] block">Last Name</label>
                    <input
                      type="text"
                      value={lastNameInput}
                      onChange={(e) => setLastNameInput(e.target.value)}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-[#FAF9F6] text-[#526058]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-4 py-2 bg-[#1B382B] text-white font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                  {profileSaved && (
                    <span className="text-[#2D5A46] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Updated in SQLite
                    </span>
                  )}
                </div>
              </form>

              <div className="pt-6 border-t border-[#E8E2D6] space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#2D5A46]" />
                  <div>
                    <h2 className="font-display text-base font-bold text-[#18231C]">
                      Update Password
                    </h2>
                    <p className="text-[11px] text-[#526058]">
                      Change your SQLite login password (minimum 8 characters). Recommended after initial deployment.
                    </p>
                  </div>
                </div>

                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs font-medium">
                    {passwordError}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#18231C] block">Current Password</label>
                    <input
                      type="password"
                      required={user.authProvider === 'email'}
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-[#18231C] block">New Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-[#18231C] block">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmNewPasswordInput}
                        onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="px-4 py-2 bg-[#1B382B] text-white font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </button>
                    {passwordSaved && (
                      <span className="text-[#2D5A46] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Password updated in SQLite
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADMIN SECTIONS (Controlled by Left Sidebar) */}
          {isAdmin && effectiveSection.startsWith('admin-') && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#E8E2D6] px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#2D5A46] font-bold">
                    Admin Operations
                  </div>
                  <h1 className="font-display text-xl font-bold text-[#18231C]">
                    {effectiveSection === 'admin-kpis' && 'KPI & Studio Analytics'}
                    {effectiveSection === 'admin-orders' && 'Orders & Courier Dispatch'}
                    {effectiveSection === 'admin-commissions' && 'Custom Commissions & Builder Pricing'}
                    {effectiveSection === 'admin-couriers' && 'Courier Rates, Promos & Gift Cards'}
                    {effectiveSection === 'admin-catalogue' && 'Stone Inventory & Provenance'}
                    {effectiveSection === 'admin-settings' && 'Site, Branding & Auth Settings'}
                    {effectiveSection === 'admin-payments' && 'Payment Modes, Cash on Pickup & Stripe'}
                    {effectiveSection === 'admin-seo' && 'Global SEO & Open Graph Meta Tags'}
                    {effectiveSection === 'admin-seo-audit' && 'Sitemap & Per-Page SEO Audit'}
                  </h1>
                </div>
              </div>

              <AdminDashboard
                orders={orders}
                products={products}
                galleryItems={galleryItems}
                giftCards={giftCards}
                couriers={couriers}
                rates={rates}
                discounts={discounts}
                customPricing={customPricing}
                commissions={commissions}
                settings={settings}
                pageSeoMetadata={pageSeoMetadata}
                onUpdateOrder={onUpdateOrder}
                onUpdateRate={onUpdateRate}
                onBulkRaiseRates={onBulkRaiseRates}
                onUpdateCourier={onUpdateCourier}
                onSaveDiscount={onSaveDiscount}
                onDeleteDiscount={onDeleteDiscount}
                onCreateAdminGiftCard={onCreateAdminGiftCard}
                onUpdateAdminGiftCard={onUpdateAdminGiftCard}
                onDeleteAdminGiftCard={onDeleteAdminGiftCard}
                onAddProduct={onAddProduct}
                onUpdateProduct={onUpdateProduct}
                onDeleteProduct={onDeleteProduct}
                onAddGalleryItem={onAddGalleryItem}
                onDeleteGalleryItem={onDeleteGalleryItem}
                onUpdateCustomPricing={onUpdateCustomPricing}
                onUpdateCommission={onUpdateCommission}
                onSendCommissionMessage={onSendCommissionMessage}
                onUpdateSettings={onUpdateSettings}
                onPageSeoChange={onPageSeoChange}
                onOpenPolicies={onOpenPolicies}
                isAdmin={isAdmin}
                embeddedSection={
                  effectiveSection.replace('admin-', '') as
                    | 'kpis'
                    | 'orders'
                    | 'commissions'
                    | 'couriers'
                    | 'catalogue'
                    | 'settings'
                    | 'payments'
                    | 'seo'
                    | 'seo-audit'
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
