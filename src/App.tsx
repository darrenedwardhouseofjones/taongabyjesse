/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, AppTab, DashboardSection } from './components/Navbar';
import { StorefrontView } from './components/StorefrontView';
import { GalleryView, WishlistToggleInput } from './components/GalleryView';
import { StoryView } from './components/StoryView';
import { CustomAtelier, CreateCommissionPayload } from './components/CustomAtelier';
import { ProvenanceView } from './components/ProvenanceView';
import { GiftCardsView } from './components/GiftCardsView';
import { OrderLookupView } from './components/OrderLookupView';
import { PoliciesView } from './components/PoliciesView';
import { DashboardView } from './components/DashboardView';
import { AuthModal } from './components/AuthModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { Footer } from './components/Footer';

import { DEFAULT_CUSTOM_PRICING, DEFAULT_SITE_SETTINGS } from './utils/defaults';
import {
  CartItem,
  Courier,
  CourierRate,
  CustomCommission,
  CustomInspirationTemplate,
  CustomPricingConfig,
  DiscountRule,
  GalleryItem,
  GiftCard,
  GiftCardValidationResult,
  Order,
  PageSeoMetadata,
  PaymentMethod,
  PolicySectionKey,
  Product,
  SiteSettings,
  UserProfile,
  WishlistItem,
} from './types';
import { priceCart } from './utils/pricing';
import { apiFetch, setSessionToken } from './utils/api';
import { applySiteSeoToHead } from './utils/seo';
import { useOrderCompleteEmailHook } from './utils/orderComplete';

interface BootstrapResponse {
  user: UserProfile | null;
  settings: SiteSettings;
  products: Product[];
  galleryItems: GalleryItem[];
  couriers: Courier[];
  rates: CourierRate[];
  discounts: DiscountRule[];
  customPricing: CustomPricingConfig;
  orders: Order[];
  commissions: CustomCommission[];
  wishlist: WishlistItem[];
  giftCards?: GiftCard[];
  pageSeoMetadata?: PageSeoMetadata[];
}

const PUBLIC_TABS: AppTab[] = [
  'store',
  'gallery',
  'story',
  'custom',
  'provenance',
  'gift-cards',
  'orders',
  'policies',
];

const POLICY_SECTIONS: PolicySectionKey[] = [
  'terms',
  'privacy',
  'shipping',
  'custom',
  'authenticity',
];

function getInitialUrlParams(): {
  tab: AppTab;
  productId: string | null;
  pieceId: string | null;
  policySection: PolicySectionKey;
} {
  if (typeof window === 'undefined') {
    return { tab: 'store', productId: null, pieceId: null, policySection: 'terms' };
  }
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get('tab') as AppTab | null;
  const productId = params.get('product');
  const pieceId = params.get('piece');
  const rawDoc = params.get('doc') as PolicySectionKey | null;
  let tab: AppTab = rawTab && PUBLIC_TABS.includes(rawTab) ? rawTab : 'store';
  if (!rawTab && pieceId) tab = 'gallery';
  const policySection: PolicySectionKey =
    rawDoc && POLICY_SECTIONS.includes(rawDoc) ? rawDoc : 'terms';
  return { tab, productId, pieceId, policySection };
}

export default function App() {
  const initialUrl = getInitialUrlParams();
  const [currentTab, setCurrentTab] = useState<AppTab>(initialUrl.tab);
  const [policySection, setPolicySection] = useState<PolicySectionKey>(initialUrl.policySection);
  const [initialProductId, setInitialProductId] = useState<string | null>(initialUrl.productId);
  const [initialPieceId, setInitialPieceId] = useState<string | null>(initialUrl.pieceId);
  const [dashboardSection, setDashboardSection] = useState<DashboardSection>('client-orders');

  // Bootstrap status
  const [bootstrapStatus, setBootstrapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Auth & User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [authPromptNote, setAuthPromptNote] = useState<string | null>(null);
  const [pendingWishlistItem, setPendingWishlistItem] = useState<WishlistToggleInput | null>(null);
  const [openWishlistAfterAuth, setOpenWishlistAfterAuth] = useState<boolean>(false);
  const [wishlistToast, setWishlistToast] = useState<string | null>(null);

  // Core Atelier Data State (hydrated exclusively from SQLite via /api/bootstrap)
  const [products, setProducts] = useState<Product[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [inspirationTemplate, setInspirationTemplate] = useState<CustomInspirationTemplate | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [rates, setRates] = useState<CourierRate[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [customPricing, setCustomPricing] = useState<CustomPricingConfig>(DEFAULT_CUSTOM_PRICING);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<CustomCommission[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [pageSeoMetadata, setPageSeoMetadata] = useState<PageSeoMetadata[]>([]);

  // Cart & Commerce State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('nzpost-sig');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('STRIPE');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    code: string;
    remainingBalanceCents: number;
  } | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [validatingGiftCard, setValidatingGiftCard] = useState<boolean>(false);
  const {
    confirmationEmailLog,
    sendingConfirmationEmail,
    runOrderCompleteHook,
    resetConfirmationEmailLog,
  } = useOrderCompleteEmailHook();

  const showWishlistNotice = useCallback((message: string) => {
    setWishlistToast(message);
    setTimeout(() => {
      setWishlistToast((current) => (current === message ? null : current));
    }, 3200);
  }, []);

  const loadBootstrap = useCallback(async (syncDashboardSection = true) => {
    try {
      setBootstrapError(null);
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap');
      setSettings(data.settings);
      setProducts(data.products);
      setGalleryItems(data.galleryItems || []);
      setCouriers(data.couriers);
      setRates(data.rates);
      setDiscounts(data.discounts);
      setCustomPricing(data.customPricing);
      setPageSeoMetadata(data.pageSeoMetadata || []);
      setCurrentUser(data.user);

      const activeServices = data.couriers
        .filter((c) => c.isActive)
        .flatMap((c) => c.services.filter((s) => s.isActive));
      if (activeServices.length > 0) {
        setSelectedServiceId((prev) =>
          activeServices.some((s) => s.id === prev) ? prev : activeServices[0].id
        );
      }

      if (data.user) {
        setOrders(data.orders);
        setCommissions(data.commissions);
        setWishlist(data.wishlist || []);
        setGiftCards(data.giftCards || []);
        if (syncDashboardSection) {
          setDashboardSection(
            data.user.role === 'ADMIN' ? 'admin-kpis' : 'client-orders'
          );
        }
      } else {
        setOrders([]);
        setCommissions([]);
        setWishlist([]);
        setGiftCards([]);
      }
      setBootstrapStatus('ready');
    } catch (err) {
      setBootstrapError(
        err instanceof Error ? err.message : 'Unable to connect to the atelier database.'
      );
      setBootstrapStatus('error');
    }
  }, []);

  // Load initial state & authenticated user from Express + SQLite
  useEffect(() => {
    void loadBootstrap(true);
  }, [loadBootstrap]);

  // Dynamic Favicon, Document Title, SEO Meta Tags & Open Graph Synchronization
  useEffect(() => {
    applySiteSeoToHead(settings, pageSeoMetadata);
  }, [settings, pageSeoMetadata, currentTab]);

  // Keep selected payment method valid if admin disables one mode
  useEffect(() => {
    const stripeOn = settings.stripeEnabled ?? true;
    const cashOn = settings.cashOnPickupEnabled ?? true;
    if (selectedPaymentMethod === 'STRIPE' && !stripeOn && cashOn) {
      setSelectedPaymentMethod('CASH_ON_PICKUP');
    } else if (selectedPaymentMethod === 'CASH_ON_PICKUP' && !cashOn && stripeOn) {
      setSelectedPaymentMethod('STRIPE');
    }
  }, [settings.stripeEnabled, settings.cashOnPickupEnabled, selectedPaymentMethod]);

  // Auth Handlers
  const handleAuthSuccess = async (payload: {
    user: UserProfile;
    token: string;
    orders: Order[];
    commissions: CustomCommission[];
    wishlist?: WishlistItem[];
    giftCards?: GiftCard[];
  }) => {
    setCurrentUser(payload.user);
    setOrders(payload.orders);
    setCommissions(payload.commissions);
    let nextWishlist = payload.wishlist || [];
    setWishlist(nextWishlist);
    if (payload.giftCards) {
      setGiftCards(payload.giftCards);
    }

    const queuedWishlist = pendingWishlistItem;
    const goToWishlist = openWishlistAfterAuth;

    setPendingWishlistItem(null);
    setOpenWishlistAfterAuth(false);
    setAuthPromptNote(null);
    setAuthInitialMode('login');

    if (queuedWishlist) {
      try {
        const res = await apiFetch<{ wishlist: WishlistItem[]; added?: boolean }>('/api/wishlist', {
          method: 'POST',
          body: JSON.stringify(queuedWishlist),
        });
        nextWishlist = res.wishlist;
        setWishlist(res.wishlist);
        showWishlistNotice(`Saved "${queuedWishlist.title}" to your wishlist.`);
      } catch {
        // Ignore if saving pending wishlist failed
      }
    }

    if (goToWishlist) {
      setDashboardSection('client-wishlist');
      setCurrentTab('dashboard');
    } else if (!queuedWishlist) {
      setDashboardSection(payload.user.role === 'ADMIN' ? 'admin-kpis' : 'client-orders');
      setCurrentTab('dashboard');
    }

    void loadBootstrap(false);
  };

  const handleCloseAuth = () => {
    setIsAuthOpen(false);
    setPendingWishlistItem(null);
    setOpenWishlistAfterAuth(false);
    setAuthPromptNote(null);
    setAuthInitialMode('login');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setSessionToken(null);
    setCurrentUser(null);
    setOrders([]);
    setCommissions([]);
    setWishlist([]);
    setGiftCards([]);
    setPendingWishlistItem(null);
    setOpenWishlistAfterAuth(false);
    if (currentTab === 'dashboard') {
      setCurrentTab('store');
    }
    void loadBootstrap(false);
  };

  const handleOpenDashboard = (section?: DashboardSection) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    if (section) {
      setDashboardSection(section);
    } else {
      setDashboardSection(currentUser.role === 'ADMIN' ? 'admin-kpis' : 'client-orders');
    }
    setCurrentTab('dashboard');
  };

  const handleNavigate = (tab: AppTab, nextPolicySection?: PolicySectionKey) => {
    if (tab === 'dashboard') {
      if (!currentUser) {
        setIsAuthOpen(true);
        return;
      }
      setCurrentTab('dashboard');
      return;
    }
    if (tab === 'orders') {
      if (currentUser) {
        setDashboardSection('client-tracking');
        setCurrentTab('dashboard');
      } else {
        setCurrentTab('orders');
      }
      return;
    }
    if (tab === 'policies') {
      if (nextPolicySection) {
        setPolicySection(nextPolicySection);
      }
      setCurrentTab('policies');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentTab(tab);
  };

  const handleUpdateProfile = async (firstName: string, lastName: string) => {
    const res = await apiFetch<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ firstName, lastName }),
    });
    setCurrentUser(res.user);
  };

  // Cart Handlers
  const handleAddToCart = (product: Product) => {
    if (!product.isMadeToOrder && product.quantity <= 0) {
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (product.isUniquePiece) {
          return prev;
        }
        if (!product.isMadeToOrder && existing.quantity >= product.quantity) {
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          reservationExpiresAt: Date.now() + 15 * 60 * 1000,
        },
      ];
    });
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    const safeRequested = Math.max(1, Math.floor(quantity));
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const maxQty = item.product.isMadeToOrder
          ? safeRequested
          : Math.max(1, item.product.quantity);
        return {
          ...item,
          quantity: Math.min(safeRequested, maxQty),
        };
      })
    );
  };

  // Authoritative Pricing calculation from SQLite couriers, rates & discounts
  const allServices = couriers
    .filter((c) => c.isActive)
    .flatMap((c) => c.services.filter((s) => s.isActive));

  const priceSummary = priceCart({
    items: cartItems,
    selectedServiceId,
    services: allServices,
    rates,
    discountCode,
    discounts,
    giftCardCode: appliedGiftCard?.code,
    giftCardBalanceCents: appliedGiftCard?.remainingBalanceCents ?? 0,
    paymentMethod: selectedPaymentMethod,
  });

  const handleApplyGiftCard = async (rawCode: string) => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) {
      setAppliedGiftCard(null);
      setGiftCardError(null);
      return;
    }
    setValidatingGiftCard(true);
    setGiftCardError(null);
    try {
      const res = await apiFetch<GiftCardValidationResult>(
        `/api/gift-cards/validate?code=${encodeURIComponent(cleanCode)}`
      );
      if (res.valid && (res.remainingBalanceCents ?? 0) > 0) {
        setAppliedGiftCard({
          code: res.code,
          remainingBalanceCents: res.remainingBalanceCents ?? 0,
        });
        setGiftCardError(null);
      } else {
        setAppliedGiftCard(null);
        setGiftCardError(res.error || 'Gift card is not valid or has $0 balance.');
      }
    } catch (err) {
      setAppliedGiftCard(null);
      setGiftCardError(err instanceof Error ? err.message : 'Unable to validate gift card.');
    } finally {
      setValidatingGiftCard(false);
    }
  };

  const handleClearGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardError(null);
  };

  const selectedService = allServices.find((s) => s.id === selectedServiceId) || allServices[0];
  const selectedCourier = couriers.find((c) => c.id === selectedService?.courierId);

  // Admin Courier & Rate Updaters (persisted to SQLite)
  const handleUpdateCourier = async (updatedCourier: Courier) => {
    const res = await apiFetch<{ couriers: Courier[] }>(`/api/couriers/${updatedCourier.id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedCourier),
    });
    setCouriers(res.couriers);
    const activeServices = res.couriers
      .filter((c) => c.isActive)
      .flatMap((c) => c.services.filter((s) => s.isActive));
    if (activeServices.length > 0 && !activeServices.some((s) => s.id === selectedServiceId)) {
      setSelectedServiceId(activeServices[0].id);
    }
  };

  const handleUpdateRate = (rateId: string, newPriceCents: number) => {
    setRates((prev) =>
      prev.map((r) => (r.id === rateId ? { ...r, priceCents: newPriceCents } : r))
    );
    void apiFetch<{ rates: CourierRate[] }>(`/api/rates/${rateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ priceCents: newPriceCents }),
    }).then((res) => setRates(res.rates));
  };

  const handleBulkRaiseRates = (percent: number) => {
    setRates((prev) =>
      prev.map((r) => ({
        ...r,
        priceCents: Math.round(r.priceCents * (1 + percent / 100)),
      }))
    );
    void apiFetch<{ rates: CourierRate[] }>('/api/rates/bulk-raise', {
      method: 'POST',
      body: JSON.stringify({ percent }),
    }).then((res) => setRates(res.rates));
  };

  // Admin Discount CRUD
  const handleSaveDiscount = async (rule: DiscountRule) => {
    const res = await apiFetch<{ discounts: DiscountRule[] }>('/api/discounts', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
    setDiscounts(res.discounts);
  };

  const handleDeleteDiscount = async (code: string) => {
    const res = await apiFetch<{ discounts: DiscountRule[] }>(
      `/api/discounts/${encodeURIComponent(code)}`,
      { method: 'DELETE' }
    );
    setDiscounts(res.discounts);
  };

  // Admin Gift Card CRUD
  const handleCreateAdminGiftCard = async (payload: {
    amountCents: number;
    recipientName: string;
    recipientEmail: string;
    purchaserName?: string;
    purchaserEmail?: string;
    message?: string;
    code?: string;
    sendEmail?: boolean;
  }): Promise<GiftCard> => {
    const res = await apiFetch<{ giftCard: GiftCard; giftCards?: GiftCard[] }>(
      '/api/admin/gift-cards',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (res.giftCards) {
      setGiftCards(res.giftCards);
    } else {
      setGiftCards((prev) => [res.giftCard, ...prev]);
    }
    return res.giftCard;
  };

  const handleUpdateAdminGiftCard = async (
    id: string,
    patch: {
      purchaseStatus?: GiftCard['purchaseStatus'];
      isActive?: boolean;
      remainingBalanceCents?: number;
      recipientName?: string;
      recipientEmail?: string;
      activateAndEmail?: boolean;
    }
  ): Promise<GiftCard> => {
    const res = await apiFetch<{ giftCard: GiftCard; giftCards?: GiftCard[] }>(
      `/api/admin/gift-cards/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    );
    if (res.giftCards) {
      setGiftCards(res.giftCards);
    } else {
      setGiftCards((prev) => prev.map((g) => (g.id === res.giftCard.id ? res.giftCard : g)));
    }
    return res.giftCard;
  };

  const handleDeleteAdminGiftCard = async (id: string): Promise<void> => {
    const res = await apiFetch<{ giftCards: GiftCard[] }>(
      `/api/admin/gift-cards/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    setGiftCards(res.giftCards);
  };

  // Order Completion handler (synced from server Stripe confirmation / webhook)
  const handleOrderComplete = (confirmedOrder: Order, updatedProducts?: Product[]) => {
    setOrders((prev) => [confirmedOrder, ...prev.filter((o) => o.id !== confirmedOrder.id)]);
    if (updatedProducts && updatedProducts.length > 0) {
      setProducts(updatedProducts);
    } else {
      setProducts((prev) =>
        prev.map((p) => {
          const boughtItem = confirmedOrder.items.find((item) => item.productId === p.id);
          if (boughtItem && !p.isMadeToOrder) {
            return {
              ...p,
              quantity: Math.max(0, p.quantity - boughtItem.quantity),
            };
          }
          return p;
        })
      );
    }
    setCartItems([]);
    setAppliedGiftCard(null);
    setGiftCardError(null);
    // Automated OrderComplete hook: sends order confirmation email to customer's registered profile email
    void runOrderCompleteHook(confirmedOrder);
    void loadBootstrap(false);
  };

  const handleUpdateOrder = async (updated: Order): Promise<Order> => {
    const res = await apiFetch<{ order: Order }>(`/api/orders/${updated.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updated),
    });
    const saved = res.order || updated;
    setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
    return saved;
  };

  // Admin Product CRUD
  const handleAddProduct = async (newProd: Product) => {
    const res = await apiFetch<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(newProd),
    });
    setProducts((prev) => [res.product, ...prev]);
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    const res = await apiFetch<{ product: Product }>(`/api/products/${updatedProd.id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedProd),
    });
    setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === res.product.id ? { ...item, product: res.product } : item
      )
    );
  };

  const handleDeleteProduct = async (productId: string) => {
    await apiFetch<{ ok: boolean }>(`/api/products/${productId}`, {
      method: 'DELETE',
    });
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Admin Custom Configurator Pricing
  const handleUpdateCustomPricing = async (config: CustomPricingConfig) => {
    const res = await apiFetch<{ customPricing: CustomPricingConfig }>('/api/custom-pricing', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    setCustomPricing(res.customPricing);
  };

  // Admin Site Settings
  const handleUpdateSettings = async (nextSettings: SiteSettings): Promise<SiteSettings> => {
    setSettings(nextSettings);
    const res = await apiFetch<{ settings: SiteSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(nextSettings),
    });
    setSettings(res.settings);
    return res.settings;
  };

  const handlePageSeoChange = (
    nextList: PageSeoMetadata[],
    updatedSettings?: SiteSettings
  ) => {
    setPageSeoMetadata(nextList);
    if (updatedSettings) {
      setSettings(updatedSettings);
    }
  };

  // Commission handlers (persisted to SQLite)
  const handleAddCommission = async (
    payload: CreateCommissionPayload
  ): Promise<CustomCommission> => {
    const res = await apiFetch<{ commission: CustomCommission }>('/api/commissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCommissions((prev) => [res.commission, ...prev.filter((c) => c.id !== res.commission.id)]);
    return res.commission;
  };

  const handleSendMessage = async (
    commissionId: string,
    text: string,
    sender: 'customer' | 'carver'
  ): Promise<void> => {
    const res = await apiFetch<{ commission: CustomCommission }>(
      `/api/commissions/${commissionId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ text, sender }),
      }
    );
    setCommissions((prev) =>
      prev.map((comm) => (comm.id === res.commission.id ? res.commission : comm))
    );
  };

  const handleUpdateCommission = async (
    commissionId: string,
    patch: {
      status?: CustomCommission['status'];
      quoteAmountCents?: number;
      depositAmountCents?: number;
      leadTimeWeeks?: number;
    }
  ): Promise<void> => {
    const res = await apiFetch<{ commission: CustomCommission }>(
      `/api/commissions/${commissionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    );
    setCommissions((prev) =>
      prev.map((comm) => (comm.id === res.commission.id ? res.commission : comm))
    );
  };

  const handleAcceptCommissionQuote = async (
    commissionId: string,
    email: string
  ): Promise<void> => {
    const res = await apiFetch<{ commission: CustomCommission }>(
      `/api/commissions/${commissionId}/accept`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
    setCommissions((prev) =>
      prev.map((comm) => (comm.id === res.commission.id ? res.commission : comm))
    );
  };

  const handleLookupCommission = async (
    ref: string,
    email: string
  ): Promise<CustomCommission | null> => {
    const res = await apiFetch<{ commission: CustomCommission | null }>(
      `/api/commissions/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`
    );
    if (res.commission) {
      const found = res.commission;
      setCommissions((prev) => [found, ...prev.filter((c) => c.id !== found.id)]);
    }
    return res.commission;
  };

  // Wishlist Handlers (Authenticated SQLite persistence + Guest Join & Auth prompt)
  const handleToggleWishlist = async (input: WishlistToggleInput) => {
    if (!currentUser) {
      setPendingWishlistItem(input);
      setOpenWishlistAfterAuth(false);
      setAuthInitialMode('signup');
      setAuthPromptNote(
        `Join or sign in to save "${input.title}" to your personal wishlist so you can revisit it anytime or request a custom carving.`
      );
      setIsAuthOpen(true);
      return;
    }

    try {
      const res = await apiFetch<{ wishlist: WishlistItem[]; added: boolean }>(
        '/api/wishlist/toggle',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      setWishlist(res.wishlist);
      showWishlistNotice(
        res.added
          ? `Saved "${input.title}" to your wishlist.`
          : `Removed "${input.title}" from your wishlist.`
      );
    } catch {
      // Ignore transient errors
    }
  };

  const handleRemoveFromWishlist = async (itemId: string) => {
    const res = await apiFetch<{ wishlist: WishlistItem[] }>(
      `/api/wishlist/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' }
    );
    setWishlist(res.wishlist);
    showWishlistNotice('Removed piece from your wishlist.');
  };

  const handleOpenWishlistOrAuth = () => {
    if (currentUser) {
      setDashboardSection('client-wishlist');
      setCurrentTab('dashboard');
    } else {
      setPendingWishlistItem(null);
      setOpenWishlistAfterAuth(true);
      setAuthInitialMode('signup');
      setAuthPromptNote(
        'Create a free studio account or sign in to curate a personal wishlist of past archive pieces and available carvings.'
      );
      setIsAuthOpen(true);
    }
  };

  const handleChooseForCustom = (template: CustomInspirationTemplate) => {
    setInspirationTemplate(template);
    setCurrentTab('custom');
  };

  // Admin Gallery Archive CRUD
  const handleAddGalleryItem = async (item: Partial<GalleryItem>) => {
    const res = await apiFetch<{ galleryItems: GalleryItem[] }>('/api/gallery', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    setGalleryItems(res.galleryItems);
  };

  const handleDeleteGalleryItem = async (id: string) => {
    const res = await apiFetch<{ galleryItems: GalleryItem[] }>(
      `/api/gallery/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    setGalleryItems(res.galleryItems);
  };

  if (bootstrapStatus === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] text-[#18231C] p-6">
        <div className="w-10 h-10 border-2 border-[#1B3B2B] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-display text-sm tracking-widest uppercase text-[#526058]">
          Loading {settings.siteName}…
        </p>
      </div>
    );
  }

  if (bootstrapStatus === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] text-[#18231C] p-6 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#1B3B2B]">
          Unable to Connect to Studio Database
        </h1>
        <p className="font-serif-body text-sm text-[#526058] max-w-md">
          {bootstrapError || 'Please verify the Express server and SQLite database are running.'}
        </p>
        <button
          onClick={() => void loadBootstrap(true)}
          className="px-5 py-2.5 rounded-xl bg-[#1B3B2B] text-white text-xs font-sans-ui font-bold uppercase tracking-wider hover:bg-[#12241B] cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#18231C]">
      {wishlistToast && (
        <div className="fixed bottom-6 left-6 z-50 glass-dark text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-sans-ui flex items-center gap-3">
          <span>{wishlistToast}</span>
          {currentUser && currentTab !== 'dashboard' && (
            <button
              type="button"
              onClick={() => {
                setDashboardSection('client-wishlist');
                setCurrentTab('dashboard');
                setWishlistToast(null);
              }}
              className="underline text-[#C29B38] font-semibold cursor-pointer"
            >
              View Wishlist
            </button>
          )}
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleNavigate}
        cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
        wishlistCount={currentUser ? wishlist.length : 0}
        openCart={() => setIsCartOpen(true)}
        settings={settings}
        currentUser={currentUser}
        onOpenAuth={() => {
          setPendingWishlistItem(null);
          setOpenWishlistAfterAuth(false);
          setAuthPromptNote(null);
          setAuthInitialMode('login');
          setIsAuthOpen(true);
        }}
        onOpenDashboard={handleOpenDashboard}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentTab === 'store' && (
          <StorefrontView
            products={products}
            cartItems={cartItems}
            wishlist={wishlist}
            currentUser={currentUser}
            initialProductId={initialProductId}
            onClearInitialProduct={() => setInitialProductId(null)}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            onOpenCustom={() => setCurrentTab('custom')}
            onOpenGallery={() => setCurrentTab('gallery')}
            onOpenGiftCards={() => setCurrentTab('gift-cards')}
            onOpenStory={() => setCurrentTab('story')}
          />
        )}

        {currentTab === 'gallery' && (
          <GalleryView
            products={products}
            galleryItems={galleryItems}
            wishlist={wishlist}
            currentUser={currentUser}
            initialPieceId={initialPieceId}
            onClearInitialPiece={() => setInitialPieceId(null)}
            onToggleWishlist={handleToggleWishlist}
            onOpenWishlistOrAuth={handleOpenWishlistOrAuth}
            onChooseForCustom={handleChooseForCustom}
          />
        )}

        {currentTab === 'story' && (
          <StoryView
            onStartCustom={() => setCurrentTab('custom')}
            onBrowseCollection={() => setCurrentTab('store')}
          />
        )}

        {currentTab === 'custom' && (
          <CustomAtelier
            commissions={commissions}
            customPricing={customPricing}
            currentUser={currentUser}
            isAdmin={currentUser?.role === 'ADMIN'}
            inspirationTemplate={inspirationTemplate}
            onClearInspiration={() => setInspirationTemplate(null)}
            onAddCommission={handleAddCommission}
            onSendMessage={handleSendMessage}
            onAcceptQuote={handleAcceptCommissionQuote}
            onLookupCommission={handleLookupCommission}
          />
        )}

        {currentTab === 'provenance' && <ProvenanceView products={products} />}

        {currentTab === 'gift-cards' && (
          <GiftCardsView
            settings={settings}
            currentUser={currentUser}
            onGiftCardCreated={(gc) => {
              setGiftCards((prev) => [gc, ...prev.filter((x) => x.id !== gc.id)]);
            }}
            onApplyGiftCardToCart={async (code) => {
              await handleApplyGiftCard(code);
              if (cartItems.length > 0) {
                setIsCartOpen(true);
              } else {
                showWishlistNotice(`Gift card ${code} applied — add a taonga piece to redeem at checkout.`);
              }
            }}
            onOpenStore={() => setCurrentTab('store')}
            onOpenPaymentSettings={() => handleOpenDashboard('admin-payments')}
          />
        )}

        {currentTab === 'orders' && (
          <OrderLookupView orders={orders} settings={settings} couriers={couriers} />
        )}

        {currentTab === 'policies' && (
          <PoliciesView
            settings={settings}
            initialSection={policySection}
            isAdmin={currentUser?.role === 'ADMIN'}
            onBackToStore={() => handleNavigate('store')}
            onOpenAdminSettings={() => handleOpenDashboard('admin-settings')}
          />
        )}

        {currentTab === 'dashboard' && currentUser && (
          <DashboardView
            user={currentUser}
            activeSection={dashboardSection}
            onSelectSection={setDashboardSection}
            orders={orders}
            products={products}
            galleryItems={galleryItems}
            wishlist={wishlist}
            giftCards={giftCards}
            couriers={couriers}
            rates={rates}
            discounts={discounts}
            customPricing={customPricing}
            commissions={commissions}
            settings={settings}
            pageSeoMetadata={pageSeoMetadata}
            onUpdateOrder={handleUpdateOrder}
            onUpdateRate={handleUpdateRate}
            onBulkRaiseRates={handleBulkRaiseRates}
            onUpdateCourier={handleUpdateCourier}
            onSaveDiscount={handleSaveDiscount}
            onDeleteDiscount={handleDeleteDiscount}
            onCreateAdminGiftCard={handleCreateAdminGiftCard}
            onUpdateAdminGiftCard={handleUpdateAdminGiftCard}
            onDeleteAdminGiftCard={handleDeleteAdminGiftCard}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddGalleryItem={handleAddGalleryItem}
            onDeleteGalleryItem={handleDeleteGalleryItem}
            onAddToCartFromWishlist={handleAddToCart}
            onRemoveFromWishlist={handleRemoveFromWishlist}
            onChooseInspirationFromWishlist={handleChooseForCustom}
            onUpdateCustomPricing={handleUpdateCustomPricing}
            onUpdateCommission={handleUpdateCommission}
            onSendCommissionMessage={handleSendMessage}
            onAcceptCommissionQuote={handleAcceptCommissionQuote}
            onUpdateSettings={handleUpdateSettings}
            onPageSeoChange={handlePageSeoChange}
            onUpdateProfile={handleUpdateProfile}
            onBrowseStore={() => setCurrentTab('store')}
            onBrowseGallery={() => setCurrentTab('gallery')}
            onOpenGiftCards={() => setCurrentTab('gift-cards')}
            onStartCustom={() => setCurrentTab('custom')}
            onOpenPolicies={(section) => handleNavigate('policies', section || 'terms')}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Auth Modal (Login & Sign Up) */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authInitialMode}
        authPromptNote={authPromptNote}
        settings={settings}
        onClose={handleCloseAuth}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onRemoveItem={handleRemoveCartItem}
        onUpdateQuantity={handleUpdateCartQuantity}
        couriers={couriers}
        rates={rates}
        discounts={discounts}
        selectedServiceId={selectedServiceId}
        onSelectService={setSelectedServiceId}
        paymentMethod={selectedPaymentMethod}
        onSelectPaymentMethod={setSelectedPaymentMethod}
        settings={settings}
        discountCode={discountCode}
        onApplyDiscount={setDiscountCode}
        giftCardCode={appliedGiftCard?.code || ''}
        giftCardBalanceCents={appliedGiftCard?.remainingBalanceCents ?? 0}
        giftCardError={giftCardError}
        isValidatingGiftCard={validatingGiftCard}
        onApplyGiftCard={handleApplyGiftCard}
        onClearGiftCard={handleClearGiftCard}
        onOpenGiftCards={() => setCurrentTab('gift-cards')}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal (Stripe SAQ A Hosted Element, Cash on Pickup & Gift Card Redemption) */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          resetConfirmationEmailLog();
        }}
        items={cartItems}
        subtotalCents={priceSummary.subtotalCents}
        discountCents={priceSummary.discountCents}
        shippingCents={priceSummary.shippingCents}
        gstCents={priceSummary.gstCents}
        totalCents={priceSummary.totalCents}
        selectedService={selectedService}
        courierName={selectedCourier?.name || 'NZ Post'}
        allServices={allServices}
        rates={rates}
        discounts={discounts}
        packageSize={priceSummary.packageSize}
        paymentMethod={selectedPaymentMethod}
        onSelectPaymentMethod={setSelectedPaymentMethod}
        discountCode={discountCode}
        giftCardCode={appliedGiftCard?.code || ''}
        giftCardBalanceCents={appliedGiftCard?.remainingBalanceCents ?? 0}
        giftCardError={giftCardError}
        isValidatingGiftCard={validatingGiftCard}
        onApplyGiftCard={handleApplyGiftCard}
        onClearGiftCard={handleClearGiftCard}
        currentUser={currentUser}
        confirmationEmailLog={confirmationEmailLog}
        sendingConfirmationEmail={sendingConfirmationEmail}
        onOrderComplete={handleOrderComplete}
        onOpenPaymentSettings={() => handleOpenDashboard('admin-payments')}
        settings={settings}
      />

      {/* Footer */}
      <Footer onNavigate={handleNavigate} settings={settings} />
    </div>
  );
}
