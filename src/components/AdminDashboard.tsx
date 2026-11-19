import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  AlertCircle,
  CheckCircle2,
  Plus,
  Percent,
  Download,
  Settings,
  ShieldCheck,
  Search,
  Send,
  Upload,
  Image as ImageIcon,
  Trash2,
  Globe,
  Sparkles,
  Share2,
  Eye,
  RotateCcw,
  CreditCard,
  KeyRound,
  Webhook,
  Copy,
  Check,
  Lock,
  RefreshCw,
  Edit3,
  Tag,
  MessageSquare,
  FileText,
  Mail,
  Banknote,
  MapPin,
  Gift,
} from 'lucide-react';
import { DEFAULT_SITE_SETTINGS } from '../utils/defaults';
import {
  AdminPaymentSettingsView,
  Courier,
  CourierRate,
  CustomCommission,
  CustomPricingConfig,
  DesignMotif,
  DiscountRule,
  GalleryItem,
  GiftCard,
  GiftCardRedemption,
  Order,
  OrderEmailLog,
  PackageSizeCode,
  PageSeoMetadata,
  PolicySectionKey,
  Product,
  SiteSettings,
  StoneVariety,
} from '../types';
import { formatNZD, PACKAGE_SIZES } from '../utils/pricing';
import { downloadOrdersCsv } from '../utils/ordersCsv';
import { apiFetch } from '../utils/api';
import { SeoAuditSection } from './SeoAuditSection';

interface AdminDashboardProps {
  orders: Order[];
  products: Product[];
  galleryItems: GalleryItem[];
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
  onUpdateSettings: (newSettings: SiteSettings) => Promise<SiteSettings | void> | void;
  onPageSeoChange?: (nextList: PageSeoMetadata[], updatedSettings?: SiteSettings) => void;
  onOpenPolicies?: (section?: PolicySectionKey) => void;
  isAdmin?: boolean;
  embeddedSection?:
    | 'kpis'
    | 'orders'
    | 'commissions'
    | 'couriers'
    | 'catalogue'
    | 'settings'
    | 'payments'
    | 'seo'
    | 'seo-audit';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  products,
  galleryItems,
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
  onUpdateCustomPricing,
  onUpdateCommission,
  onSendCommissionMessage,
  onUpdateSettings,
  onPageSeoChange,
  onOpenPolicies,
  isAdmin = true,
  embeddedSection,
}) => {
  const [internalTab, setInternalTab] = useState<
    | 'kpis'
    | 'orders'
    | 'commissions'
    | 'couriers'
    | 'catalogue'
    | 'settings'
    | 'payments'
    | 'seo'
    | 'seo-audit'
  >('kpis');
  const activeTab = embeddedSection ?? internalTab;
  const setActiveTab = setInternalTab;

  // Gift Card Admin State
  const [gcAmountNzd, setGcAmountNzd] = useState('150');
  const [gcRecipientName, setGcRecipientName] = useState('');
  const [gcRecipientEmail, setGcRecipientEmail] = useState('');
  const [gcMessage, setGcMessage] = useState('');
  const [gcCustomCode, setGcCustomCode] = useState('');
  const [gcSaving, setGcSaving] = useState(false);
  const [gcNotice, setGcNotice] = useState<string | null>(null);
  const [gcError, setGcError] = useState<string | null>(null);
  const [gcRedemptionsView, setGcRedemptionsView] = useState<{
    card: GiftCard;
    rows: GiftCardRedemption[];
  } | null>(null);

  // Payment Settings State
  const [paymentView, setPaymentView] = useState<AdminPaymentSettingsView | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSavedToast, setPaymentSavedToast] = useState(false);
  const [stripeEnabledDraft, setStripeEnabledDraft] = useState(settings.stripeEnabled ?? true);
  const [cashOnPickupEnabledDraft, setCashOnPickupEnabledDraft] = useState(
    settings.cashOnPickupEnabled ?? true
  );
  const [cashOnPickupInstructionsDraft, setCashOnPickupInstructionsDraft] = useState(
    settings.cashOnPickupInstructions || DEFAULT_SITE_SETTINGS.cashOnPickupInstructions || ''
  );
  const [stripeModeDraft, setStripeModeDraft] = useState<'test' | 'live'>(
    settings.stripeMode || 'test'
  );
  const [publishableKeyDraft, setPublishableKeyDraft] = useState(
    settings.stripePublishableKey || ''
  );
  const [statementDescriptorDraft, setStatementDescriptorDraft] = useState(
    settings.stripeStatementDescriptor || 'POUNAMU ATELIER'
  );
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingStripe, setTestingStripe] = useState(false);

  // Refund Modal State
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [refundAmountNzd, setRefundAmountNzd] = useState('');
  const [refundReason, setRefundReason] = useState<
    'requested_by_customer' | 'duplicate' | 'fraudulent'
  >('requested_by_customer');
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Admin SEO & Open Graph Draft State
  const [seoDraft, setSeoDraft] = useState({
    seoTitle: settings.seoTitle || DEFAULT_SITE_SETTINGS.seoTitle,
    seoDescription: settings.seoDescription || DEFAULT_SITE_SETTINGS.seoDescription,
    seoKeywords: settings.seoKeywords ?? DEFAULT_SITE_SETTINGS.seoKeywords ?? '',
    ogTitle: settings.ogTitle || DEFAULT_SITE_SETTINGS.ogTitle,
    ogDescription: settings.ogDescription || DEFAULT_SITE_SETTINGS.ogDescription,
    ogImageUrl: settings.ogImageUrl || DEFAULT_SITE_SETTINGS.ogImageUrl || '',
    ogSiteName: settings.ogSiteName || settings.siteName || 'Pounamu Atelier',
    twitterCardType: settings.twitterCardType || 'summary_large_image',
    canonicalUrl: settings.canonicalUrl || '',
    allowSearchIndexing: settings.allowSearchIndexing ?? true,
  });
  const [seoSavedToast, setSeoSavedToast] = useState(false);
  const [sitemapRegenerating, setSitemapRegenerating] = useState(false);
  const [sitemapNotice, setSitemapNotice] = useState<string | null>(null);

  useEffect(() => {
    setSeoDraft({
      seoTitle: settings.seoTitle || DEFAULT_SITE_SETTINGS.seoTitle,
      seoDescription: settings.seoDescription || DEFAULT_SITE_SETTINGS.seoDescription,
      seoKeywords: settings.seoKeywords ?? DEFAULT_SITE_SETTINGS.seoKeywords ?? '',
      ogTitle: settings.ogTitle || DEFAULT_SITE_SETTINGS.ogTitle,
      ogDescription: settings.ogDescription || DEFAULT_SITE_SETTINGS.ogDescription,
      ogImageUrl: settings.ogImageUrl || DEFAULT_SITE_SETTINGS.ogImageUrl || '',
      ogSiteName: settings.ogSiteName || settings.siteName || 'Pounamu Atelier',
      twitterCardType: settings.twitterCardType || 'summary_large_image',
      canonicalUrl: settings.canonicalUrl || '',
      allowSearchIndexing: settings.allowSearchIndexing ?? true,
    });
  }, [
    settings.seoTitle,
    settings.seoDescription,
    settings.seoKeywords,
    settings.ogTitle,
    settings.ogDescription,
    settings.ogImageUrl,
    settings.ogSiteName,
    settings.twitterCardType,
    settings.canonicalUrl,
    settings.allowSearchIndexing,
    settings.siteName,
  ]);

  // Admin Legal Policies & Terms Draft State (persisted to SQLite site_settings)
  const [policiesDraft, setPoliciesDraft] = useState({
    termsAndConditionsText:
      settings.termsAndConditionsText || DEFAULT_SITE_SETTINGS.termsAndConditionsText,
    privacyPolicyText: settings.privacyPolicyText || DEFAULT_SITE_SETTINGS.privacyPolicyText,
    shippingAndReturnsPolicyText:
      settings.shippingAndReturnsPolicyText ||
      DEFAULT_SITE_SETTINGS.shippingAndReturnsPolicyText,
    customCommissionsPolicyText:
      settings.customCommissionsPolicyText || DEFAULT_SITE_SETTINGS.customCommissionsPolicyText,
    authenticityPolicyText:
      settings.authenticityPolicyText || DEFAULT_SITE_SETTINGS.authenticityPolicyText,
    returnPolicyDays: settings.returnPolicyDays ?? DEFAULT_SITE_SETTINGS.returnPolicyDays,
  });
  const [policiesSaving, setPoliciesSaving] = useState(false);
  const [policiesSavedToast, setPoliciesSavedToast] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  useEffect(() => {
    setPoliciesDraft({
      termsAndConditionsText:
        settings.termsAndConditionsText || DEFAULT_SITE_SETTINGS.termsAndConditionsText,
      privacyPolicyText: settings.privacyPolicyText || DEFAULT_SITE_SETTINGS.privacyPolicyText,
      shippingAndReturnsPolicyText:
        settings.shippingAndReturnsPolicyText ||
        DEFAULT_SITE_SETTINGS.shippingAndReturnsPolicyText,
      customCommissionsPolicyText:
        settings.customCommissionsPolicyText ||
        DEFAULT_SITE_SETTINGS.customCommissionsPolicyText,
      authenticityPolicyText:
        settings.authenticityPolicyText || DEFAULT_SITE_SETTINGS.authenticityPolicyText,
      returnPolicyDays: settings.returnPolicyDays ?? DEFAULT_SITE_SETTINGS.returnPolicyDays,
    });
  }, [
    settings.termsAndConditionsText,
    settings.privacyPolicyText,
    settings.shippingAndReturnsPolicyText,
    settings.customCommissionsPolicyText,
    settings.authenticityPolicyText,
    settings.returnPolicyDays,
  ]);

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoliciesSaving(true);
    setPoliciesError(null);
    try {
      await onUpdateSettings({
        ...settings,
        termsAndConditionsText: policiesDraft.termsAndConditionsText.trim(),
        privacyPolicyText: policiesDraft.privacyPolicyText.trim(),
        shippingAndReturnsPolicyText: policiesDraft.shippingAndReturnsPolicyText.trim(),
        customCommissionsPolicyText: policiesDraft.customCommissionsPolicyText.trim(),
        authenticityPolicyText: policiesDraft.authenticityPolicyText.trim(),
        returnPolicyDays: Math.max(0, Number(policiesDraft.returnPolicyDays) || 0),
      });
      setPoliciesSavedToast(true);
      setTimeout(() => setPoliciesSavedToast(false), 3500);
    } catch (err) {
      setPoliciesError(
        err instanceof Error ? err.message : 'Failed to save legal policies to database.'
      );
    } finally {
      setPoliciesSaving(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'payments') return;
    let active = true;
    setPaymentLoading(true);
    setPaymentError(null);
    apiFetch<{ paymentSettings: AdminPaymentSettingsView }>('/api/admin/payment-settings')
      .then((res) => {
        if (!active) return;
        const ps = res.paymentSettings;
        setPaymentView(ps);
        setStripeEnabledDraft(ps.stripeEnabled);
        setCashOnPickupEnabledDraft(ps.cashOnPickupEnabled ?? true);
        setCashOnPickupInstructionsDraft(
          ps.cashOnPickupInstructions || DEFAULT_SITE_SETTINGS.cashOnPickupInstructions || ''
        );
        setStripeModeDraft(ps.stripeMode);
        setPublishableKeyDraft(ps.stripePublishableKey || '');
        setStatementDescriptorDraft(ps.stripeStatementDescriptor || 'POUNAMU ATELIER');
      })
      .catch((err) => {
        if (!active) return;
        setPaymentError(err instanceof Error ? err.message : 'Unable to load payment settings.');
      })
      .finally(() => {
        if (active) setPaymentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, activeTab]);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentError(null);
    setTestResult(null);
    try {
      const res = await apiFetch<{
        paymentSettings: AdminPaymentSettingsView;
        settings: SiteSettings;
      }>('/api/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify({
          stripeEnabled: stripeEnabledDraft,
          cashOnPickupEnabled: cashOnPickupEnabledDraft,
          cashOnPickupInstructions: cashOnPickupInstructionsDraft.trim(),
          stripeMode: stripeModeDraft,
          stripePublishableKey: publishableKeyDraft.trim(),
          stripeStatementDescriptor: statementDescriptorDraft.trim(),
          ...(secretKeyInput.trim() ? { stripeSecretKey: secretKeyInput.trim() } : {}),
          ...(webhookSecretInput.trim()
            ? { stripeWebhookSecret: webhookSecretInput.trim() }
            : {}),
        }),
      });
      setPaymentView(res.paymentSettings);
      setCashOnPickupEnabledDraft(res.paymentSettings.cashOnPickupEnabled ?? true);
      setCashOnPickupInstructionsDraft(
        res.paymentSettings.cashOnPickupInstructions || ''
      );
      setSecretKeyInput('');
      setWebhookSecretInput('');
      onUpdateSettings(res.settings);
      setPaymentSavedToast(true);
      setTimeout(() => setPaymentSavedToast(false), 3500);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to save payment settings.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleClearSecret = async (which: 'secret' | 'webhook') => {
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      const res = await apiFetch<{
        paymentSettings: AdminPaymentSettingsView;
        settings: SiteSettings;
      }>('/api/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(
          which === 'secret' ? { clearSecretKey: true } : { clearWebhookSecret: true }
        ),
      });
      setPaymentView(res.paymentSettings);
      onUpdateSettings(res.settings);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to clear secret.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleTestStripeConnection = async () => {
    setTestingStripe(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        livemode: boolean;
        availableCurrencies: string[];
        hasPublishableKey: boolean;
        hasWebhookSecret: boolean;
      }>('/api/admin/payment-settings/test', {
        method: 'POST',
      });
      setTestResult({
        ok: true,
        message: `Connected (${res.livemode ? 'LIVE' : 'TEST'} mode). Currencies: ${
          res.availableCurrencies.join(', ') || 'NZD'
        }. Publishable Key: ${res.hasPublishableKey ? 'OK' : 'Missing'}, Webhook Secret: ${
          res.hasWebhookSecret ? 'OK' : 'Not Set'
        }.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Stripe API connection failed.',
      });
    } finally {
      setTestingStripe(false);
    }
  };

  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingOrder) return;
    setRefundProcessing(true);
    setRefundError(null);
    try {
      const amountCents = Math.round(parseFloat(refundAmountNzd || '0') * 100);
      const res = await apiFetch<{ order: Order }>(`/api/orders/${refundingOrder.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents: amountCents > 0 ? amountCents : undefined,
          reason: refundReason,
        }),
      });
      onUpdateOrder(res.order);
      setRefundingOrder(null);
      void refreshOrderEmailLogs();
      setTrackingNotice(
        `Refund recorded on Order ${refundingOrder.orderNumber} — automated refund email notification sent to ${refundingOrder.customerEmail}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed.');
    } finally {
      setRefundProcessing(false);
    }
  };

  // Fulfilment, Order Status & Email Notification Log state
  const [fulfillingOrderId, setFulfillingOrderId] = useState<string | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [actualCostInput, setActualCostInput] = useState('11.50');
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingNotice, setTrackingNotice] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    'ALL' | 'TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'REFUNDED'
  >('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [copiedTrackingOrderId, setCopiedTrackingOrderId] = useState<string | null>(null);
  const [updatingStatusOrderId, setUpdatingStatusOrderId] = useState<string | null>(null);
  const [orderEmailLogs, setOrderEmailLogs] = useState<OrderEmailLog[]>([]);

  const refreshOrderEmailLogs = async () => {
    if (!isAdmin) return;
    try {
      const res = await apiFetch<{ emailLogs: OrderEmailLog[] }>('/api/admin/order-email-logs');
      setOrderEmailLogs(res.emailLogs || []);
    } catch {
      // Ignore transient poll errors
    }
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'orders') return;
    void refreshOrderEmailLogs();
  }, [isAdmin, activeTab]);

  // Add / Edit / Delete Product state
  const [newTitle, setNewTitle] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newMaterial, setNewMaterial] = useState<StoneVariety>('Kawakawa');
  const [newDesign, setNewDesign] = useState<DesignMotif>('Toki');
  const [newPrice, setNewPrice] = useState('320');
  const [newCost, setNewCost] = useState('100');
  const [newQty, setNewQty] = useState('1');
  const [newWeight, setNewWeight] = useState('75');
  const [newPkgSize, setNewPkgSize] = useState<PackageSizeCode>('BAG-S');
  const [newIsUnique, setNewIsUnique] = useState(true);
  const [newIsMadeToOrder, setNewIsMadeToOrder] = useState(false);
  const [newIsExportRestricted, setNewIsExportRestricted] = useState(false);
  const [newRiver, setNewRiver] = useState('Arahura River, West Coast');
  const [newCode, setNewCode] = useState('NT-94102-AR');
  const [newImage, setNewImage] = useState('/src/assets/images/product_toki_pounamu_1794468031889.jpg');
  const [newDescription, setNewDescription] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  const [productActionError, setProductActionError] = useState<string | null>(null);
  const [productSaving, setProductSaving] = useState(false);

  // Add / Delete Gallery Archive state
  const [galTitle, setGalTitle] = useState('');
  const [galMaterial, setGalMaterial] = useState<StoneVariety>('Kawakawa');
  const [galDesign, setGalDesign] = useState<DesignMotif>('Toki');
  const [galOrigin, setGalOrigin] = useState('Arahura River, West Coast');
  const [galCode, setGalCode] = useState('NT-ARCHIVE-01');
  const [galYear, setGalYear] = useState(String(new Date().getFullYear()));
  const [galImage, setGalImage] = useState('/src/assets/images/gallery_tangiwai_roimata_1794950532051.jpg');
  const [galDescription, setGalDescription] = useState('');
  const [galSaving, setGalSaving] = useState(false);
  const [galError, setGalError] = useState<string | null>(null);
  const [confirmDeleteGalleryId, setConfirmDeleteGalleryId] = useState<string | null>(null);

  // Discount Form state
  const [discCode, setDiscCode] = useState('');
  const [discType, setDiscType] = useState<DiscountRule['type']>('PERCENTAGE');
  const [discValue, setDiscValue] = useState('10');
  const [discMinSpend, setDiscMinSpend] = useState('100');
  const [discDescription, setDiscDescription] = useState('');
  const [discError, setDiscError] = useState<string | null>(null);

  // Admin Commissions & Custom Pricing State
  const [selectedAdminCommId, setSelectedAdminCommId] = useState<string>(
    commissions[0]?.id || ''
  );
  const [commStatusDraft, setCommStatusDraft] = useState<CustomCommission['status']>('QUOTED');
  const [commQuoteNzdDraft, setCommQuoteNzdDraft] = useState('');
  const [commDepositNzdDraft, setCommDepositNzdDraft] = useState('');
  const [commLeadWeeksDraft, setCommLeadWeeksDraft] = useState('3');
  const [commSaving, setCommSaving] = useState(false);
  const [commSavedToast, setCommSavedToast] = useState(false);
  const [commReplyText, setCommReplyText] = useState('');
  const [pricingDraft, setPricingDraft] = useState<CustomPricingConfig>(customPricing);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSavedToast, setPricingSavedToast] = useState(false);
  const [newStoneName, setNewStoneName] = useState('');
  const [newStoneDesc, setNewStoneDesc] = useState('');
  const [newStonePriceNzd, setNewStonePriceNzd] = useState('320');
  const [newDesignName, setNewDesignName] = useState('');
  const [newDesignMeaning, setNewDesignMeaning] = useState('');
  const [newDesignMult, setNewDesignMult] = useState('1.15');
  const [newSizeMm, setNewSizeMm] = useState('');
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizeMult, setNewSizeMult] = useState('1.15');
  const [newCordText, setNewCordText] = useState('');
  const [newBindingText, setNewBindingText] = useState('');

  useEffect(() => {
    setPricingDraft(customPricing);
  }, [customPricing]);

  const dynamicStoneNames: string[] = Array.from(
    new Set([
      ...(pricingDraft.stoneOptions?.map((s) => s.name) || []),
      ...Object.keys(pricingDraft.materialBaseCents || {}),
      ...products.map((p) => p.material),
      ...galleryItems.map((g) => g.material),
      'Whale Bone',
    ])
  ).filter(Boolean);

  const dynamicDesignNames: string[] = Array.from(
    new Set([
      ...(pricingDraft.designOptions?.map((d) => d.name) || []),
      ...Object.keys(pricingDraft.designMultiplier || {}),
      ...products.map((p) => p.designType),
      ...galleryItems.map((g) => g.designType),
    ])
  ).filter(Boolean);

  useEffect(() => {
    if (commissions.length > 0 && (!selectedAdminCommId || !commissions.some((c) => c.id === selectedAdminCommId))) {
      setSelectedAdminCommId(commissions[0].id);
    }
  }, [commissions, selectedAdminCommId]);

  const activeAdminCommission =
    commissions.find((c) => c.id === selectedAdminCommId) || commissions[0] || null;

  useEffect(() => {
    if (activeAdminCommission) {
      setCommStatusDraft(activeAdminCommission.status);
      setCommQuoteNzdDraft(
        activeAdminCommission.quoteAmountCents
          ? (activeAdminCommission.quoteAmountCents / 100).toFixed(2)
          : ''
      );
      setCommDepositNzdDraft(
        activeAdminCommission.depositAmountCents
          ? (activeAdminCommission.depositAmountCents / 100).toFixed(2)
          : ''
      );
      setCommLeadWeeksDraft(String(activeAdminCommission.leadTimeWeeks || 3));
    }
  }, [activeAdminCommission]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8E2D6] p-8 text-center space-y-2">
        <ShieldCheck className="w-8 h-8 text-[#A63A2A] mx-auto" />
        <h3 className="font-display text-base font-bold text-[#18231C]">
          Administrator Access Required
        </h3>
        <p className="text-xs text-[#526058]">
          Only studio administrators can modify orders, shipping matrices, payment settings, or global site SEO settings.
        </p>
      </div>
    );
  }

  // KPI Calculations (exclude unpaid PENDING checkouts)
  const settledOrders = orders.filter((o) => o.status !== 'PENDING');
  const totalRefundedCents = settledOrders.reduce((sum, o) => sum + (o.refundedAmountCents || 0), 0);
  const totalRevenueCents = settledOrders.reduce((sum, o) => sum + o.totalCents, 0) - totalRefundedCents;
  const totalGstCents = Math.round((totalRevenueCents * 3) / 23);
  const totalShippingCollectedCents = settledOrders.reduce((sum, o) => sum + o.shippingCents, 0);
  const totalStripeFeesCents = settledOrders.reduce((sum, o) => sum + o.stripeFeeCents, 0);
  const totalNetReceivedCents =
    settledOrders.reduce((sum, o) => sum + o.netCents, 0) - totalRefundedCents;

  // Profit calculation using item cost price
  let totalCostOfGoodsCents = 0;
  let totalActualShippingPaidCents = 0;
  settledOrders.forEach((order) => {
    order.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        totalCostOfGoodsCents += prod.costPriceCents * item.quantity;
      } else {
        totalCostOfGoodsCents += Math.round(item.priceCents * 0.35); // fallback estimated 35% cost
      }
    });
    if (order.actualCourierCostCents) {
      totalActualShippingPaidCents += order.actualCourierCostCents;
    }
  });

  const estimatedProfitCents = totalRevenueCents - totalCostOfGoodsCents - totalStripeFeesCents;
  const postageMarginCents = totalShippingCollectedCents - totalActualShippingPaidCents;
  const averageOrderValueCents =
    settledOrders.length > 0 ? Math.round(totalRevenueCents / settledOrders.length) : 0;

  // Queues
  const unfulfilledOrders = orders.filter(
    (o) => o.status === 'PAID' || o.status === 'PROCESSING' || o.status === 'FULFILLING'
  );
  const pendingQuotes = commissions.filter((c) => c.status === 'REQUESTED');
  const lowStockItems = products.filter((p) => p.quantity <= 1 && !p.isUniquePiece);

  const openFulfillmentModal = (order: Order) => {
    setFulfillingOrderId(order.id);
    setTrackingError(null);
    if (order.status === 'SHIPPED' || order.trackingNumber) {
      setTrackingNumberInput(order.trackingNumber || '');
    } else {
      setTrackingNumberInput(`NZP-${Math.floor(10000000 + Math.random() * 90000000)}NZ`);
    }
    setActualCostInput(
      typeof order.actualCourierCostCents === 'number' && order.actualCourierCostCents > 0
        ? (order.actualCourierCostCents / 100).toFixed(2)
        : '11.50'
    );
  };

  const handleSaveTrackingOrShip = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const cleanTracking = trackingNumberInput.trim();
    if (!cleanTracking) {
      setTrackingError('Please enter a valid courier tracking number.');
      return;
    }

    const parsedCost = parseFloat(actualCostInput || '0');
    const actualCents =
      Number.isFinite(parsedCost) && parsedCost >= 0
        ? Math.round(parsedCost * 100)
        : order.actualCourierCostCents || 0;

    const wasAlreadyShipped = order.status === 'SHIPPED';
    const updated: Order = {
      ...order,
      status: wasAlreadyShipped ? order.status : 'SHIPPED',
      trackingNumber: cleanTracking,
      actualCourierCostCents: actualCents,
      shippedAt: order.shippedAt || new Date().toISOString(),
    };

    setTrackingSaving(true);
    setTrackingError(null);
    try {
      await onUpdateOrder(updated);
      await refreshOrderEmailLogs();
      setFulfillingOrderId(null);
      setTrackingNumberInput('');
      setTrackingNotice(
        wasAlreadyShipped
          ? `Tracking # updated to ${cleanTracking} for Order ${order.orderNumber} — now visible in customer Order History.`
          : `Order ${order.orderNumber} marked as SHIPPED with tracking # ${cleanTracking} — automated shipping email queued/sent to ${order.customerEmail}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : 'Unable to save tracking number.');
    } finally {
      setTrackingSaving(false);
    }
  };

  const handleAdminStatusChange = async (order: Order, nextStatus: Order['status']) => {
    if (nextStatus === order.status) return;
    setUpdatingStatusOrderId(order.id);
    try {
      const updated: Order = {
        ...order,
        status: nextStatus,
        ...(nextStatus === 'SHIPPED'
          ? { shippedAt: order.shippedAt || new Date().toISOString() }
          : {}),
        ...(nextStatus === 'DELIVERED'
          ? {
              deliveredAt: order.deliveredAt || new Date().toISOString(),
              ...(order.paymentMethod === 'CASH_ON_PICKUP' ? { paymentStatus: 'PAID' as const } : {}),
            }
          : {}),
      };
      await onUpdateOrder(updated);
      await refreshOrderEmailLogs();
      setTrackingNotice(
        `Order ${order.orderNumber} status updated to ${nextStatus} — automated customer email notification dispatched to ${order.customerEmail}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } catch (err) {
      setTrackingNotice(
        err instanceof Error ? err.message : `Failed to update status for ${order.orderNumber}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } finally {
      setUpdatingStatusOrderId(null);
    }
  };

  const handleMarkCashCollected = async (order: Order) => {
    setUpdatingStatusOrderId(order.id);
    try {
      const updated: Order = {
        ...order,
        paymentStatus: 'PAID',
        status: 'DELIVERED',
        deliveredAt: order.deliveredAt || new Date().toISOString(),
      };
      await onUpdateOrder(updated);
      await refreshOrderEmailLogs();
      setTrackingNotice(
        `Cash collected for ${order.orderNumber} (${formatNZD(order.totalCents)}) — marked PAID & DELIVERED and notified ${order.customerEmail}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } catch (err) {
      setTrackingNotice(
        err instanceof Error ? err.message : `Failed to mark cash collected for ${order.orderNumber}.`
      );
      setTimeout(() => setTrackingNotice(null), 6000);
    } finally {
      setUpdatingStatusOrderId(null);
    }
  };

  const handleExportXeroCsv = () => {
    downloadOrdersCsv(orders);
  };

  return (
    <div className={embeddedSection ? 'space-y-6 font-sans-ui' : 'max-w-7xl mx-auto px-6 py-10 space-y-8 font-sans-ui'}>
      {/* Top Admin Header (shown only when standalone) */}
      {!embeddedSection && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#2D5A46] font-bold">
              Studio Management & Logistics
            </div>
            <h1 className="font-display text-2xl font-bold text-[#18231C]">
              Pounamu Atelier Backoffice
            </h1>
          </div>

          {/* Tab switchers */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#E8E2D6] rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('kpis')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'kpis' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              KPI & Analytics
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                activeTab === 'orders' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Orders & Dispatch
              {unfulfilledOrders.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#C29B38]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('commissions')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                activeTab === 'commissions' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Commissions
              {pendingQuotes.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#C29B38]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('couriers')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'couriers' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Couriers & Promos
            </button>
            <button
              onClick={() => setActiveTab('catalogue')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'catalogue' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Stone Inventory
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'settings' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'payments' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab('seo')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'seo' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              SEO & Open Graph
            </button>
            <button
              onClick={() => setActiveTab('seo-audit')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'seo-audit' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              SEO Audit
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: KPI & ANALYTICS */}
      {activeTab === 'kpis' && (
        <div className="space-y-8">
          {/* Top KPI Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-[#E8E2D6] space-y-1">
              <span className="text-[11px] text-[#526058]">Gross Revenue (GST incl.)</span>
              <div className="font-display text-xl font-bold text-[#1B382B] tabular-nums">
                {formatNZD(totalRevenueCents)}
              </div>
              <div className="text-[10px] text-[#2D5A46] font-semibold">
                {settledOrders.length} Paid Orders · Net {formatNZD(totalNetReceivedCents)}
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E2D6] space-y-1">
              <span className="text-[11px] text-[#526058]">15% NZ GST Included</span>
              <div className="font-display text-xl font-bold text-[#18231C] tabular-nums">
                {formatNZD(totalGstCents)}
              </div>
              <div className="text-[10px] text-[#526058]">IRD Return Ready</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E2D6] space-y-1">
              <span className="text-[11px] text-[#526058]">Net Profit (excl. stone cost)</span>
              <div className="font-display text-xl font-bold text-[#2D5A46] tabular-nums">
                {formatNZD(estimatedProfitCents)}
              </div>
              <div className="text-[10px] text-[#526058]">Stripe fees: {formatNZD(totalStripeFeesCents)}</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E2D6] space-y-1">
              <span className="text-[11px] text-[#526058]">Average Order Value (AOV)</span>
              <div className="font-display text-xl font-bold text-[#18231C] tabular-nums">
                {formatNZD(averageOrderValueCents)}
              </div>
              <div className="text-[10px] text-[#526058]">Postage Margin: {formatNZD(postageMarginCents)}</div>
            </div>
          </div>

          {/* "Needs Attention" Queue */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C29B38]" />
                <span>Atelier Action Queue ("Needs Attention")</span>
              </h3>
              <button
                onClick={handleExportXeroCsv}
                className="px-3 py-1.5 border border-[#E8E2D6] text-xs font-semibold rounded-lg hover:bg-[#FAF9F6] flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Xero CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-1">
                <div className="font-bold text-[#18231C]">
                  {unfulfilledOrders.length} Orders Awaiting Packing &amp; Pickup
                </div>
                <div className="text-[11px] text-[#526058]">
                  Orders placed via Stripe or Cash on Pickup awaiting packing, courier labels, or studio collection.
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-[#1B382B] font-semibold text-xs pt-1 hover:underline block"
                >
                  Go to Dispatch →
                </button>
              </div>

              <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-1">
                <div className="font-bold text-[#18231C]">
                  {pendingQuotes.length} Bespoke Custom Quotes to Review
                </div>
                <div className="text-[11px] text-[#526058]">
                  Clients awaiting Jesse’s quote and lead time estimate.
                </div>
              </div>

              <div className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-1">
                <div className="font-bold text-[#18231C]">
                  {lowStockItems.length} Pieces at Low Stock
                </div>
                <div className="text-[11px] text-[#526058]">
                  Replenish workshop carvings or assign new rough stone slabs.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS & DISPATCH */}
      {activeTab === 'orders' && (() => {
        const q = orderSearchQuery.trim().toLowerCase();
        const filteredOrders = orders.filter((o) => {
          if (
            orderStatusFilter === 'TO_SHIP' &&
            o.status !== 'PAID' &&
            o.status !== 'PROCESSING' &&
            o.status !== 'FULFILLING'
          ) {
            return false;
          }
          if (orderStatusFilter === 'SHIPPED' && o.status !== 'SHIPPED') return false;
          if (orderStatusFilter === 'DELIVERED' && o.status !== 'DELIVERED') return false;
          if (orderStatusFilter === 'REFUNDED' && o.status !== 'REFUNDED') return false;
          if (q) {
            const hay = `${o.orderNumber} ${o.customerName} ${o.customerEmail} ${o.trackingNumber || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        const fulfillingOrder = fulfillingOrderId
          ? orders.find((o) => o.id === fulfillingOrderId) || null
          : null;

        return (
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C]">
                  Customer Orders &amp; Courier Dispatch ({orders.length})
                </h3>
                <p className="text-[11px] text-[#526058]">
                  Updating an order’s status (Processing, Shipped, Delivered) automatically emails the customer and logs delivery in SQLite.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportXeroCsv}
                className="px-3 py-1.5 border border-[#E8E2D6] text-xs font-semibold rounded-lg hover:bg-[#FAF9F6] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Xero CSV</span>
              </button>
            </div>

            {trackingNotice && (
              <div className="p-3 rounded-xl bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                <span>{trackingNotice}</span>
              </div>
            )}

            {/* Status Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex flex-wrap p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs self-start">
                {(
                  [
                    { id: 'ALL', label: `All (${orders.length})` },
                    {
                      id: 'TO_SHIP',
                      label: `Preparing (${orders.filter((o) => o.status === 'PAID' || o.status === 'PROCESSING' || o.status === 'FULFILLING').length})`,
                    },
                    {
                      id: 'SHIPPED',
                      label: `Shipped (${orders.filter((o) => o.status === 'SHIPPED').length})`,
                    },
                    {
                      id: 'DELIVERED',
                      label: `Delivered (${orders.filter((o) => o.status === 'DELIVERED').length})`,
                    },
                    {
                      id: 'REFUNDED',
                      label: `Refunded (${orders.filter((o) => o.status === 'REFUNDED').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      orderStatusFilter === tab.id
                        ? 'bg-[#1B382B] text-white'
                        : 'text-[#526058] hover:text-[#18231C]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search order #, customer, or tracking #..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs focus:bg-white focus:border-[#1B382B] outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F6] text-[#526058] border-b border-[#E8E2D6]">
                  <tr>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Taonga Items</th>
                    <th className="p-3">Payment &amp; Fulfilment</th>
                    <th className="p-3">Total (NZD)</th>
                    <th className="p-3">Status &amp; Tracking</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D6]">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#526058]">
                        No orders match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const isCashPickup = o.paymentMethod === 'CASH_ON_PICKUP';
                      const effectivePayStatus =
                        o.paymentStatus ||
                        (o.status === 'REFUNDED'
                          ? 'REFUNDED'
                          : o.status === 'PENDING'
                          ? 'UNPAID'
                          : isCashPickup
                          ? 'PAY_ON_PICKUP'
                          : 'PAID');
                      return (
                        <tr key={o.id} className="hover:bg-[#FAF9F6]/50">
                          <td className="p-3 font-mono font-bold text-[#18231C]">{o.orderNumber}</td>
                          <td className="p-3">
                            <div className="font-semibold text-[#18231C]">{o.customerName}</div>
                            <div className="text-[10px] text-[#526058]">
                              {isCashPickup ? o.customerPhone : o.shippingAddress.city} · {o.customerEmail}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-[11px]">
                              {o.items.map((i) => i.title).join(', ')}
                            </div>
                            <div className="text-[10px] font-mono text-[#2D5A46]">
                              {o.items.map((i) => i.authenticityCode).join(', ')}
                            </div>
                          </td>
                          <td className="p-3 space-y-0.5">
                            <div className="font-semibold text-[#18231C]">
                              {o.paymentMethod === 'GIFT_CARD'
                                ? 'Digital Gift Card'
                                : isCashPickup
                                ? 'Cash on Pickup'
                                : 'Stripe Card'}
                            </div>
                            <div className="text-[10px] text-[#526058]">
                              {effectivePayStatus === 'PAY_ON_PICKUP'
                                ? 'Due on collection'
                                : effectivePayStatus === 'PAID'
                                ? 'Paid'
                                : effectivePayStatus === 'REFUNDED'
                                ? 'Refunded'
                                : 'Unpaid'}{' '}
                              ·{' '}
                              {isCashPickup || o.courierName === 'Studio Pickup'
                                ? 'Napier Studio Pickup'
                                : `${o.courierName} (${o.packageSizeCode})`}
                            </div>
                            {(o.giftCardAppliedCents || 0) > 0 && (
                              <div className="text-[10px] font-mono text-[#2D5A46]">
                                Gift Card {o.giftCardCode}: -{formatNZD(o.giftCardAppliedCents || 0)}
                              </div>
                            )}
                            {o.pickupNotes && (
                              <div className="text-[10px] text-[#2D5A46] italic truncate max-w-[200px]" title={o.pickupNotes}>
                                Pickup: {o.pickupNotes}
                              </div>
                            )}
                            {o.orderNotes && (
                              <div className="text-[10px] text-[#18231C] italic truncate max-w-[220px]" title={o.orderNotes}>
                                Order Note: {o.orderNotes}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-[#1B382B]">
                            <div>{formatNZD(o.totalCents)}</div>
                            {o.refundedAmountCents ? (
                              <div className="text-[10px] text-[#A63A2A]">
                                Refunded {formatNZD(o.refundedAmountCents)}
                              </div>
                            ) : null}
                          </td>
                          <td className="p-3 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  o.status === 'SHIPPED' || o.status === 'DELIVERED'
                                    ? 'bg-[#2D5A46] text-white'
                                    : o.status === 'REFUNDED'
                                    ? 'bg-[#A63A2A] text-white'
                                    : o.status === 'PENDING'
                                    ? 'bg-[#7D8B82] text-white'
                                    : 'bg-[#C29B38] text-white'
                                }`}
                              >
                                {o.status}
                              </span>
                              <select
                                aria-label={`Update status for ${o.orderNumber}`}
                                disabled={updatingStatusOrderId === o.id}
                                value={o.status}
                                onChange={(e) =>
                                  void handleAdminStatusChange(
                                    o,
                                    e.target.value as Order['status']
                                  )
                                }
                                className="px-2 py-0.5 border border-[#E8E2D6] rounded bg-white text-[10px] font-semibold text-[#18231C] focus:border-[#1B382B] outline-none cursor-pointer disabled:opacity-50"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="PAID">PAID</option>
                                <option value="PROCESSING">PROCESSING</option>
                                <option value="FULFILLING">FULFILLING</option>
                                <option value="SHIPPED">SHIPPED</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="REFUNDED">REFUNDED</option>
                              </select>
                            </div>
                            {o.trackingNumber ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#18231C]">
                                <span>{o.trackingNumber}</span>
                                <button
                                  type="button"
                                  title="Copy tracking number"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(o.trackingNumber || '');
                                    setCopiedTrackingOrderId(o.id);
                                    setTimeout(() => setCopiedTrackingOrderId(null), 1800);
                                  }}
                                  className="text-[#526058] hover:text-[#1B382B] cursor-pointer"
                                >
                                  {copiedTrackingOrderId === o.id ? (
                                    <Check className="w-3 h-3 text-[#2D5A46]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : o.status === 'SHIPPED' && !isCashPickup ? (
                              <div className="text-[10px] text-[#A63A2A] font-medium">
                                No tracking # saved yet
                              </div>
                            ) : null}
                            {(() => {
                              const logs = orderEmailLogs.filter((l) => l.orderId === o.id);
                              if (logs.length === 0) return null;
                              return (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  {logs.slice(0, 3).map((log) => (
                                    <span
                                      key={log.id}
                                      title={`${log.subject} → ${log.recipientEmail} (${log.status} via ${log.provider} at ${new Date(
                                        log.sentAt
                                      ).toLocaleString('en-NZ')})`}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E2D6] text-[9px] text-[#2D5A46] font-medium"
                                    >
                                      <Mail className="w-2.5 h-2.5" />
                                      <span>
                                        {log.template
                                          .replace('order_status_', '')
                                          .replace('order_', '')}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                            {o.stripePaymentIntentId && (
                              <div className="text-[10px] font-mono text-[#7D8B82]">
                                {o.stripePaymentIntentId.slice(0, 14)}…
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                            {isCashPickup ? (
                              effectivePayStatus !== 'PAID' && o.status !== 'REFUNDED' && (
                                <button
                                  type="button"
                                  disabled={updatingStatusOrderId === o.id}
                                  onClick={() => void handleMarkCashCollected(o)}
                                  className="px-2.5 py-1 bg-[#1B382B] text-white rounded text-[11px] font-semibold hover:bg-[#12241B] cursor-pointer disabled:opacity-50"
                                >
                                  Mark Cash Collected
                                </button>
                              )
                            ) : (
                              <>
                                {(o.status === 'PAID' ||
                                  o.status === 'PROCESSING' ||
                                  o.status === 'FULFILLING') && (
                                  <button
                                    type="button"
                                    onClick={() => openFulfillmentModal(o)}
                                    className="px-2.5 py-1 bg-[#1B382B] text-white rounded text-[11px] font-semibold hover:bg-[#12241B] cursor-pointer"
                                  >
                                    Dispatch &amp; Label
                                  </button>
                                )}
                                {(o.status === 'SHIPPED' || o.status === 'DELIVERED') && (
                                  <button
                                    type="button"
                                    onClick={() => openFulfillmentModal(o)}
                                    className="px-2.5 py-1 border border-[#1B382B]/30 text-[#1B382B] hover:bg-[#FAF9F6] rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>{o.trackingNumber ? 'Update Tracking' : 'Add Tracking'}</span>
                                  </button>
                                )}
                              </>
                            )}
                            {o.status !== 'PENDING' && (o.refundedAmountCents || 0) < o.totalCents && (
                              <button
                                type="button"
                                onClick={() => {
                                  const remaining = o.totalCents - (o.refundedAmountCents || 0);
                                  setRefundingOrder(o);
                                  setRefundAmountNzd((remaining / 100).toFixed(2));
                                  setRefundError(null);
                                }}
                                className="px-2.5 py-1 border border-[#A63A2A]/40 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* FULFILLMENT & TRACKING UPDATE MODAL */}
            {fulfillingOrder && (
              <div className="fixed inset-0 z-50 bg-[#111C16]/50 backdrop-blur-xs flex items-center justify-center p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveTrackingOrShip(fulfillingOrder.id);
                  }}
                  className="bg-white rounded-2xl border border-[#E8E2D6] p-6 max-w-md w-full space-y-4 shadow-2xl"
                >
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-sm text-[#18231C]">
                      {fulfillingOrder.status === 'SHIPPED'
                        ? `Update Tracking Number — ${fulfillingOrder.orderNumber}`
                        : `Dispatch Order — ${fulfillingOrder.orderNumber}`}
                    </h4>
                    <p className="text-[11px] text-[#526058]">
                      {fulfillingOrder.customerName} · {fulfillingOrder.courierName} (
                      {fulfillingOrder.courierServiceName})
                    </p>
                  </div>

                  {trackingError && (
                    <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{trackingError}</span>
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-[#18231C] block">
                        Courier Tracking Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={trackingNumberInput}
                        onChange={(e) => setTrackingNumberInput(e.target.value)}
                        placeholder="e.g. NZP-884029104NZ"
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono focus:outline-none focus:border-[#1B382B]"
                      />
                      <div className="text-[10px] text-[#526058]">
                        Customers immediately see this tracking number and live courier link inside their Order History dashboard.
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-[#18231C] block">
                        Actual Courier Cost Charged to Studio ($ NZD ex-GST)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={actualCostInput}
                        onChange={(e) => setActualCostInput(e.target.value)}
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono focus:outline-none focus:border-[#1B382B]"
                      />
                      <div className="text-[10px] text-[#526058]">
                        Used to calculate exact postage margin in analytics.
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={trackingSaving}
                      onClick={() => {
                        setFulfillingOrderId(null);
                        setTrackingError(null);
                      }}
                      className="px-3.5 py-2 border border-[#E8E2D6] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={trackingSaving}
                      className="px-4 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {trackingSaving
                        ? 'Saving...'
                        : fulfillingOrder.status === 'SHIPPED'
                        ? 'Save Tracking Number'
                        : 'Mark Shipped & Save Tracking'}
                    </button>
                  </div>
                </form>
              </div>
            )}

          {/* REFUND MODAL */}
          {refundingOrder && (
            <div className="fixed inset-0 z-50 bg-[#111C16]/50 flex items-center justify-center p-4">
              <form
                onSubmit={handleExecuteRefund}
                className="bg-white rounded-xl border border-[#E8E2D6] p-6 max-w-md w-full space-y-4 text-xs"
              >
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-sm text-[#18231C]">
                    Issue Stripe Refund — {refundingOrder.orderNumber}
                  </h4>
                  <p className="text-[11px] text-[#526058]">
                    Customer: {refundingOrder.customerName} ({refundingOrder.customerEmail}) · Paid{' '}
                    {formatNZD(refundingOrder.totalCents)}
                  </p>
                </div>

                {refundError && (
                  <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] font-medium">
                    {refundError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">
                    Refund Amount (NZD) — Max{' '}
                    {formatNZD(refundingOrder.totalCents - (refundingOrder.refundedAmountCents || 0))}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.50"
                    max={((refundingOrder.totalCents - (refundingOrder.refundedAmountCents || 0)) / 100).toFixed(2)}
                    required
                    value={refundAmountNzd}
                    onChange={(e) => setRefundAmountNzd(e.target.value)}
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Stripe Refund Reason</label>
                  <select
                    value={refundReason}
                    onChange={(e) =>
                      setRefundReason(
                        e.target.value as 'requested_by_customer' | 'duplicate' | 'fraudulent'
                      )
                    }
                    className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white"
                  >
                    <option value="requested_by_customer">Requested by Customer</option>
                    <option value="duplicate">Duplicate Payment</option>
                    <option value="fraudulent">Fraudulent Charge</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={refundProcessing}
                    onClick={() => setRefundingOrder(null)}
                    className="px-3 py-1.5 border border-[#E8E2D6] rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={refundProcessing}
                    className="px-4 py-1.5 bg-[#A63A2A] hover:bg-[#8E2F21] text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {refundProcessing ? 'Processing Refund...' : 'Confirm Stripe Refund'}
                  </button>
                </div>
              </form>
            </div>
          )}
          </div>
        );
      })()}

      {/* TAB: BESPOKE COMMISSIONS & BUILDER PRICING */}
      {activeTab === 'commissions' && (
        <div className="space-y-8 text-xs">
          {/* Section A: Commissions Queue & Quoting */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#1B382B]" />
                  Custom Carving Requests & Quotes ({commissions.length})
                </h3>
                <p className="text-[#526058] mt-0.5">
                  Review submitted sketches/configurations, set exact NZD quotes & lead times, advance production status, and reply directly to clients.
                </p>
              </div>
              {commSavedToast && (
                <span className="inline-flex items-center gap-1.5 text-[#2D5A46] font-bold bg-[#F7F9F8] px-3 py-1 rounded-full border border-[#2D5A46]/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Commission Saved in SQLite
                </span>
              )}
            </div>

            {commissions.length === 0 ? (
              <div className="py-10 text-center text-[#526058]">
                No bespoke commission requests in SQLite yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left queue list */}
                <div className="lg:col-span-4 space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {commissions.map((comm) => (
                    <button
                      key={comm.id}
                      type="button"
                      onClick={() => setSelectedAdminCommId(comm.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        activeAdminCommission?.id === comm.id
                          ? 'border-[#1B382B] bg-[#1B382B]/10 ring-1 ring-[#1B382B]'
                          : 'border-[#E8E2D6] bg-[#FAF9F6] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="font-mono text-[#18231C]">{comm.referenceNumber}</strong>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            comm.status === 'REQUESTED'
                              ? 'bg-[#C29B38] text-white'
                              : comm.status === 'SHIPPED'
                              ? 'bg-[#2D5A46] text-white'
                              : 'bg-[#E8E2D6] text-[#18231C]'
                          }`}
                        >
                          {comm.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="font-semibold text-[#18231C] mt-1">
                        {comm.material} {comm.designType} ({comm.pendantSizeMm}mm)
                      </div>
                      <div className="flex justify-between text-[11px] text-[#526058] mt-1">
                        <span>{comm.customerName}</span>
                        <span className="font-mono font-semibold text-[#1B382B]">
                          {comm.quoteAmountCents ? formatNZD(comm.quoteAmountCents) : 'Needs Quote'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right quote editor + chat */}
                {activeAdminCommission && (
                  <div className="lg:col-span-8 space-y-4">
                    <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]/70 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-display font-bold text-sm text-[#18231C]">
                            {activeAdminCommission.referenceNumber} — {activeAdminCommission.customerName}
                          </div>
                          <div className="text-[11px] text-[#526058]">
                            {activeAdminCommission.customerEmail}
                            {activeAdminCommission.customerPhone ? ` · ${activeAdminCommission.customerPhone}` : ''}
                            {' · '}Budget: {activeAdminCommission.budgetRange}
                          </div>
                        </div>
                        {activeAdminCommission.referenceImageUrl && (
                          <img
                            src={activeAdminCommission.referenceImageUrl}
                            alt="Client reference"
                            className="w-14 h-14 rounded-lg object-cover border border-[#E8E2D6]"
                          />
                        )}
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-[#E8E2D6] text-[#526058]">
                        <strong className="text-[#18231C]">Specs:</strong>{' '}
                        {activeAdminCommission.material} {activeAdminCommission.designType} ·{' '}
                        {activeAdminCommission.pendantSizeMm}mm · {activeAdminCommission.cordStyle} ·{' '}
                        {activeAdminCommission.bindingStyle}
                        {activeAdminCommission.specialNotes && (
                          <p className="mt-1 text-[#18231C]">{activeAdminCommission.specialNotes}</p>
                        )}
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setCommSaving(true);
                          try {
                            const quoteCents = commQuoteNzdDraft
                              ? Math.round(parseFloat(commQuoteNzdDraft) * 100)
                              : undefined;
                            const depCents = commDepositNzdDraft
                              ? Math.round(parseFloat(commDepositNzdDraft) * 100)
                              : undefined;
                            await onUpdateCommission(activeAdminCommission.id, {
                              status: commStatusDraft,
                              quoteAmountCents: quoteCents,
                              depositAmountCents: depCents,
                              leadTimeWeeks: parseInt(commLeadWeeksDraft, 10) || 3,
                            });
                            setCommSavedToast(true);
                            setTimeout(() => setCommSavedToast(false), 3000);
                          } finally {
                            setCommSaving(false);
                          }
                        }}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1"
                      >
                        <div className="space-y-1">
                          <label className="font-semibold text-[#18231C] block">Status</label>
                          <select
                            value={commStatusDraft}
                            onChange={(e) =>
                              setCommStatusDraft(e.target.value as CustomCommission['status'])
                            }
                            className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                          >
                            <option value="REQUESTED">REQUESTED</option>
                            <option value="QUOTED">QUOTED</option>
                            <option value="ACCEPTED">ACCEPTED</option>
                            <option value="DEPOSIT_PAID">DEPOSIT PAID</option>
                            <option value="IN_PRODUCTION">IN PRODUCTION</option>
                            <option value="QUALITY_CHECK">QUALITY CHECK</option>
                            <option value="READY">READY</option>
                            <option value="SHIPPED">SHIPPED</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-[#18231C] block">Quote ($ NZD)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="520.00"
                            value={commQuoteNzdDraft}
                            onChange={(e) => setCommQuoteNzdDraft(e.target.value)}
                            className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="font-semibold text-[#18231C]">Deposit ($)</label>
                            {commQuoteNzdDraft && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCommDepositNzdDraft(
                                    ((parseFloat(commQuoteNzdDraft) || 0) * 0.5).toFixed(2)
                                  )
                                }
                                className="text-[10px] text-[#2D5A46] font-semibold hover:underline cursor-pointer"
                              >
                                50%
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="260.00"
                            value={commDepositNzdDraft}
                            onChange={(e) => setCommDepositNzdDraft(e.target.value)}
                            className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-[#18231C] block">Lead Time (wks)</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              value={commLeadWeeksDraft}
                              onChange={(e) => setCommLeadWeeksDraft(e.target.value)}
                              className="w-16 p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                            />
                            <button
                              type="submit"
                              disabled={commSaving}
                              className="flex-1 px-3 py-2 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#2D5A46] cursor-pointer disabled:opacity-50"
                            >
                              {commSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Message thread & carver reply */}
                    <div className="border border-[#E8E2D6] rounded-xl overflow-hidden bg-white">
                      <div className="p-3 bg-[#FAF9F6] border-b border-[#E8E2D6] font-semibold text-[#18231C]">
                        Client Message Thread
                      </div>
                      <div className="p-4 max-h-56 overflow-y-auto space-y-2.5">
                        {activeAdminCommission.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`p-3 rounded-xl text-xs ${
                              m.sender === 'carver'
                                ? 'bg-[#1B382B] text-white ml-8'
                                : 'bg-[#FAF9F6] border border-[#E8E2D6] text-[#18231C] mr-8'
                            }`}
                          >
                            <div className="text-[10px] opacity-75 mb-0.5">
                              {m.senderName} · {new Date(m.timestamp).toLocaleString()}
                            </div>
                            <div>{m.text}</div>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!commReplyText.trim()) return;
                          await onSendCommissionMessage(
                            activeAdminCommission.id,
                            commReplyText.trim(),
                            'carver'
                          );
                          setCommReplyText('');
                        }}
                        className="p-3 border-t border-[#E8E2D6] flex gap-2 bg-[#FAF9F6]"
                      >
                        <input
                          type="text"
                          value={commReplyText}
                          onChange={(e) => setCommReplyText(e.target.value)}
                          placeholder="Reply to client as Jesse..."
                          className="flex-1 p-2 border border-[#E8E2D6] rounded-lg bg-white focus:outline-none focus:border-[#1B382B]"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#1B382B] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-[#7FA892]" />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section B: Full Dynamic Custom Configurator Options & Pricing Rules (SQLite) */}
          {(() => {
            const stones =
              pricingDraft.stoneOptions && pricingDraft.stoneOptions.length > 0
                ? pricingDraft.stoneOptions
                : Object.entries(pricingDraft.materialBaseCents || {}).map(([name, baseCents]) => ({
                    name,
                    description: 'Aotearoa Greenstone',
                    baseCents,
                  }));
            const designs =
              pricingDraft.designOptions && pricingDraft.designOptions.length > 0
                ? pricingDraft.designOptions
                : Object.entries(pricingDraft.designMultiplier || {}).map(([name, multiplier]) => ({
                    name,
                    label: name,
                    meaning: 'Traditional Carving',
                    multiplier,
                  }));
            const sizes =
              pricingDraft.sizeOptions && pricingDraft.sizeOptions.length > 0
                ? pricingDraft.sizeOptions
                : [
                    { mm: 45, label: 'Delicate Everyday (45mm)', multiplier: pricingDraft.sizeMultiplier.small45 },
                    { mm: 65, label: 'Traditional Classic (65mm)', multiplier: pricingDraft.sizeMultiplier.medium65 },
                    { mm: 85, label: 'Commanding Statement (85mm)', multiplier: pricingDraft.sizeMultiplier.large85 },
                  ];
            const cords = pricingDraft.cordOptions || [];
            const bindings = pricingDraft.bindingOptions || [];

            return (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPricingSaving(true);
                  try {
                    const materialBaseCents: Record<string, number> = {};
                    stones.forEach((s) => {
                      if (s.name.trim()) materialBaseCents[s.name.trim()] = s.baseCents;
                    });
                    const designMultiplier: Record<string, number> = {};
                    designs.forEach((d) => {
                      if (d.name.trim()) designMultiplier[d.name.trim()] = d.multiplier;
                    });
                    await onUpdateCustomPricing({
                      ...pricingDraft,
                      stoneOptions: stones,
                      designOptions: designs,
                      sizeOptions: sizes,
                      materialBaseCents,
                      designMultiplier,
                      sizeMultiplier: {
                        small45: sizes[0]?.multiplier ?? pricingDraft.sizeMultiplier.small45,
                        medium65: sizes[1]?.multiplier ?? pricingDraft.sizeMultiplier.medium65,
                        large85: sizes[2]?.multiplier ?? pricingDraft.sizeMultiplier.large85,
                      },
                      cordOptions: cords,
                      bindingOptions: bindings,
                    });
                    setPricingSavedToast(true);
                    setTimeout(() => setPricingSavedToast(false), 3000);
                  } finally {
                    setPricingSaving(false);
                  }
                }}
                className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#18231C]">
                      Custom Carving Studio Options &amp; Pricing (SQLite)
                    </h3>
                    <p className="text-[#526058] mt-0.5">
                      Add, rename, edit, or remove any stone variety, carving shape &amp; meaning, pendant length, cord braiding, or binding style. Changes go live immediately in the Custom Studio and server-side pricing.
                    </p>
                  </div>
                  {pricingSavedToast && (
                    <span className="inline-flex items-center gap-1.5 text-[#2D5A46] font-bold bg-[#F7F9F8] px-3 py-1 rounded-full border border-[#2D5A46]/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Custom Studio Config Saved
                    </span>
                  )}
                </div>

                {/* 1. Stone Types */}
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-3">
                  <div className="font-bold text-[#18231C]">1. Stone Varieties &amp; Base Prices</div>
                  <div className="space-y-2">
                    {stones.map((stone, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={stone.name}
                          placeholder="Stone name (any string)"
                          onChange={(e) => {
                            const next = stones.map((s, i) =>
                              i === idx ? { ...s, name: e.target.value } : s
                            );
                            setPricingDraft({ ...pricingDraft, stoneOptions: next });
                          }}
                          className="sm:col-span-4 p-1.5 border border-[#E8E2D6] rounded bg-white font-semibold"
                        />
                        <input
                          type="text"
                          value={stone.description}
                          placeholder="Stone colour / note"
                          onChange={(e) => {
                            const next = stones.map((s, i) =>
                              i === idx ? { ...s, description: e.target.value } : s
                            );
                            setPricingDraft({ ...pricingDraft, stoneOptions: next });
                          }}
                          className="sm:col-span-5 p-1.5 border border-[#E8E2D6] rounded bg-white"
                        />
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <span className="text-[#526058]">$</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={(stone.baseCents / 100).toFixed(0)}
                            onChange={(e) => {
                              const next = stones.map((s, i) =>
                                i === idx
                                  ? { ...s, baseCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                                  : s
                              );
                              setPricingDraft({ ...pricingDraft, stoneOptions: next });
                            }}
                            className="w-full p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={stones.length <= 1}
                          onClick={() => {
                            const next = stones.filter((_, i) => i !== idx);
                            setPricingDraft({ ...pricingDraft, stoneOptions: next });
                          }}
                          aria-label={`Delete ${stone.name}`}
                          className="sm:col-span-1 p-1.5 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded disabled:opacity-30 cursor-pointer justify-self-end"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-[#E8E2D6]">
                    <input
                      type="text"
                      value={newStoneName}
                      onChange={(e) => setNewStoneName(e.target.value)}
                      placeholder="New stone name (e.g. Aotea)"
                      className="sm:col-span-4 p-1.5 border border-[#E8E2D6] rounded bg-white"
                    />
                    <input
                      type="text"
                      value={newStoneDesc}
                      onChange={(e) => setNewStoneDesc(e.target.value)}
                      placeholder="Subtitle (e.g. Blue-Green Feldspar)"
                      className="sm:col-span-5 p-1.5 border border-[#E8E2D6] rounded bg-white"
                    />
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={newStonePriceNzd}
                      onChange={(e) => setNewStonePriceNzd(e.target.value)}
                      placeholder="$ NZD"
                      className="sm:col-span-2 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStoneName.trim()) return;
                        const next = [
                          ...stones,
                          {
                            name: newStoneName.trim(),
                            description: newStoneDesc.trim() || 'Aotearoa Stone',
                            baseCents: Math.round((parseFloat(newStonePriceNzd) || 300) * 100),
                          },
                        ];
                        setPricingDraft({ ...pricingDraft, stoneOptions: next });
                        setNewStoneName('');
                        setNewStoneDesc('');
                      }}
                      className="sm:col-span-1 py-1.5 px-2 bg-[#1B382B] text-white rounded font-semibold hover:bg-[#12241B] cursor-pointer text-[11px]"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* 2. Shapes & Meanings */}
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-3">
                  <div className="font-bold text-[#18231C]">2. Traditional Shapes, Meanings &amp; Multipliers</div>
                  <div className="space-y-2">
                    {designs.map((design, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={design.name}
                          placeholder="Shape key (e.g. Hei Matau)"
                          onChange={(e) => {
                            const next = designs.map((d, i) =>
                              i === idx ? { ...d, name: e.target.value, label: e.target.value } : d
                            );
                            setPricingDraft({ ...pricingDraft, designOptions: next });
                          }}
                          className="sm:col-span-4 p-1.5 border border-[#E8E2D6] rounded bg-white font-semibold"
                        />
                        <input
                          type="text"
                          value={design.meaning}
                          placeholder="Meaning (e.g. Safe Ocean Travel)"
                          onChange={(e) => {
                            const next = designs.map((d, i) =>
                              i === idx ? { ...d, meaning: e.target.value } : d
                            );
                            setPricingDraft({ ...pricingDraft, designOptions: next });
                          }}
                          className="sm:col-span-5 p-1.5 border border-[#E8E2D6] rounded bg-white"
                        />
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <span className="text-[#526058]">×</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.5"
                            value={design.multiplier}
                            onChange={(e) => {
                              const next = designs.map((d, i) =>
                                i === idx ? { ...d, multiplier: parseFloat(e.target.value) || 1 } : d
                              );
                              setPricingDraft({ ...pricingDraft, designOptions: next });
                            }}
                            className="w-full p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={designs.length <= 1}
                          onClick={() => {
                            const next = designs.filter((_, i) => i !== idx);
                            setPricingDraft({ ...pricingDraft, designOptions: next });
                          }}
                          aria-label={`Delete ${design.name}`}
                          className="sm:col-span-1 p-1.5 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded disabled:opacity-30 cursor-pointer justify-self-end"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-[#E8E2D6]">
                    <input
                      type="text"
                      value={newDesignName}
                      onChange={(e) => setNewDesignName(e.target.value)}
                      placeholder="New shape (e.g. Hei Matau)"
                      className="sm:col-span-4 p-1.5 border border-[#E8E2D6] rounded bg-white"
                    />
                    <input
                      type="text"
                      value={newDesignMeaning}
                      onChange={(e) => setNewDesignMeaning(e.target.value)}
                      placeholder="Meaning (e.g. Safe Passage & Abundance)"
                      className="sm:col-span-5 p-1.5 border border-[#E8E2D6] rounded bg-white"
                    />
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      value={newDesignMult}
                      onChange={(e) => setNewDesignMult(e.target.value)}
                      placeholder="× Mult"
                      className="sm:col-span-2 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDesignName.trim()) return;
                        const next = [
                          ...designs,
                          {
                            name: newDesignName.trim(),
                            label: newDesignName.trim(),
                            meaning: newDesignMeaning.trim() || 'Traditional Motif',
                            multiplier: parseFloat(newDesignMult) || 1.15,
                            previewImageUrl: '/src/assets/images/modern_hero_pounamu_1794472502033.jpg',
                          },
                        ];
                        setPricingDraft({ ...pricingDraft, designOptions: next });
                        setNewDesignName('');
                        setNewDesignMeaning('');
                      }}
                      className="sm:col-span-1 py-1.5 px-2 bg-[#1B382B] text-white rounded font-semibold hover:bg-[#12241B] cursor-pointer text-[11px]"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* 3. Pendant Lengths & Add-ons */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-3">
                    <div className="font-bold text-[#18231C]">3. Pendant Lengths &amp; Scale Multipliers</div>
                    <div className="space-y-2">
                      {sizes.map((sz, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3 flex items-center gap-1">
                            <input
                              type="number"
                              min="10"
                              value={sz.mm}
                              onChange={(e) => {
                                const next = sizes.map((s, i) =>
                                  i === idx ? { ...s, mm: parseInt(e.target.value, 10) || 45 } : s
                                );
                                setPricingDraft({ ...pricingDraft, sizeOptions: next });
                              }}
                              className="w-full p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                            />
                            <span className="text-[#526058] text-[10px]">mm</span>
                          </div>
                          <input
                            type="text"
                            value={sz.label}
                            placeholder="Label (any string)"
                            onChange={(e) => {
                              const next = sizes.map((s, i) =>
                                i === idx ? { ...s, label: e.target.value } : s
                              );
                              setPricingDraft({ ...pricingDraft, sizeOptions: next });
                            }}
                            className="col-span-6 p-1.5 border border-[#E8E2D6] rounded bg-white"
                          />
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-[#526058]">×</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0.5"
                              value={sz.multiplier}
                              onChange={(e) => {
                                const next = sizes.map((s, i) =>
                                  i === idx
                                    ? { ...s, multiplier: parseFloat(e.target.value) || 1 }
                                    : s
                                );
                                setPricingDraft({ ...pricingDraft, sizeOptions: next });
                              }}
                              className="w-full p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={sizes.length <= 1}
                            onClick={() => {
                              const next = sizes.filter((_, i) => i !== idx);
                              setPricingDraft({ ...pricingDraft, sizeOptions: next });
                            }}
                            aria-label={`Delete ${sz.label}`}
                            className="col-span-1 p-1.5 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded disabled:opacity-30 cursor-pointer justify-self-end"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-12 gap-2 pt-2 border-t border-[#E8E2D6]">
                      <input
                        type="number"
                        min="10"
                        value={newSizeMm}
                        onChange={(e) => setNewSizeMm(e.target.value)}
                        placeholder="mm (e.g. 95)"
                        className="col-span-3 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                      />
                      <input
                        type="text"
                        value={newSizeLabel}
                        onChange={(e) => setNewSizeLabel(e.target.value)}
                        placeholder="Label (e.g. Ceremonial Taonga (95mm))"
                        className="col-span-6 p-1.5 border border-[#E8E2D6] rounded bg-white"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={newSizeMult}
                        onChange={(e) => setNewSizeMult(e.target.value)}
                        placeholder="× Mult"
                        className="col-span-2 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const mmVal = parseInt(newSizeMm, 10);
                          if (!mmVal || mmVal < 10) return;
                          const next = [
                            ...sizes,
                            {
                              mm: mmVal,
                              label: newSizeLabel.trim() || `${mmVal}mm Custom Length`,
                              multiplier: parseFloat(newSizeMult) || 1.2,
                            },
                          ];
                          setPricingDraft({ ...pricingDraft, sizeOptions: next });
                          setNewSizeMm('');
                          setNewSizeLabel('');
                        }}
                        className="col-span-1 py-1.5 px-1 bg-[#1B382B] text-white rounded font-semibold hover:bg-[#12241B] cursor-pointer text-[11px]"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Artisan Add-Ons */}
                  <div className="lg:col-span-4 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-3">
                    <div className="font-bold text-[#18231C]">Artisan Add-On Pricing</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#526058]">Pāua Eye Inlay ($ NZD)</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={(pricingDraft.pauaEyeCents / 100).toFixed(0)}
                        onChange={(e) =>
                          setPricingDraft({
                            ...pricingDraft,
                            pauaEyeCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                          })
                        }
                        className="w-24 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#526058]">Rimu Gift Box ($ NZD)</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={(pricingDraft.hardwoodBoxCents / 100).toFixed(0)}
                        onChange={(e) =>
                          setPricingDraft({
                            ...pricingDraft,
                            hardwoodBoxCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                          })
                        }
                        className="w-24 p-1.5 border border-[#E8E2D6] rounded bg-white font-mono text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Cord Braiding & Binding Strings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-2.5">
                    <div className="font-bold text-[#18231C]">4. Cord Braiding Styles (Any String)</div>
                    {cords.map((cord, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cord}
                          onChange={(e) => {
                            const next = cords.map((c, i) => (i === idx ? e.target.value : c));
                            setPricingDraft({ ...pricingDraft, cordOptions: next });
                          }}
                          className="flex-1 p-1.5 border border-[#E8E2D6] rounded bg-white"
                        />
                        <button
                          type="button"
                          disabled={cords.length <= 1}
                          onClick={() => {
                            const next = cords.filter((_, i) => i !== idx);
                            setPricingDraft({ ...pricingDraft, cordOptions: next });
                          }}
                          aria-label={`Remove cord ${cord}`}
                          className="p-1.5 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#E8E2D6]">
                      <input
                        type="text"
                        value={newCordText}
                        onChange={(e) => setNewCordText(e.target.value)}
                        placeholder="Add new cord style (e.g. 6-Plait Smoked Hemp Cord)"
                        className="flex-1 p-1.5 border border-[#E8E2D6] rounded bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCordText.trim()) return;
                          setPricingDraft({
                            ...pricingDraft,
                            cordOptions: [...cords, newCordText.trim()],
                          });
                          setNewCordText('');
                        }}
                        className="px-3 py-1.5 bg-[#1B382B] text-white rounded font-semibold hover:bg-[#12241B] cursor-pointer text-[11px]"
                      >
                        + Add Cord
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-2.5">
                    <div className="font-bold text-[#18231C]">5. Binding / Lashing Styles (Any String)</div>
                    {bindings.map((binding, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={binding}
                          onChange={(e) => {
                            const next = bindings.map((b, i) => (i === idx ? e.target.value : b));
                            setPricingDraft({ ...pricingDraft, bindingOptions: next });
                          }}
                          className="flex-1 p-1.5 border border-[#E8E2D6] rounded bg-white"
                        />
                        <button
                          type="button"
                          disabled={bindings.length <= 1}
                          onClick={() => {
                            const next = bindings.filter((_, i) => i !== idx);
                            setPricingDraft({ ...pricingDraft, bindingOptions: next });
                          }}
                          aria-label={`Remove binding ${binding}`}
                          className="p-1.5 text-[#A63A2A] hover:bg-[#A63A2A]/10 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#E8E2D6]">
                      <input
                        type="text"
                        value={newBindingText}
                        onChange={(e) => setNewBindingText(e.target.value)}
                        placeholder="Add new lashing style (e.g. Sterling Silver Bail)"
                        className="flex-1 p-1.5 border border-[#E8E2D6] rounded bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newBindingText.trim()) return;
                          setPricingDraft({
                            ...pricingDraft,
                            bindingOptions: [...bindings, newBindingText.trim()],
                          });
                          setNewBindingText('');
                        }}
                        className="px-3 py-1.5 bg-[#1B382B] text-white rounded font-semibold hover:bg-[#12241B] cursor-pointer text-[11px]"
                      >
                        + Add Binding
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pricingSaving}
                    className="px-5 py-2.5 bg-[#1B382B] hover:bg-[#2D5A46] text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {pricingSaving ? 'Saving Configuration...' : 'Save Custom Studio Options & Pricing'}
                  </button>
                </div>
              </form>
            );
          })()}
        </div>
      )}

      {/* TAB 3: COURIER RATE MATRIX, COURIER RULES & PROMO DISCOUNTS */}
      {activeTab === 'couriers' && (
        <div className="space-y-8 text-xs">
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C]">
                  Courier Rate Grid & Packaging Rules
                </h3>
                <p className="text-xs text-[#526058]">
                  Package sizes down the side, active courier services across the top. Edit any cell inline to update customer checkout shipping in SQLite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBulkRaiseRates(5)}
                className="px-3.5 py-2 bg-[#FAF9F6] border border-[#E8E2D6] hover:bg-[#E8E2D6] text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
              >
                <Percent className="w-3.5 h-3.5 text-[#1B382B]" />
                <span>Raise All Courier Rates by +5%</span>
              </button>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-[#E8E2D6] rounded-xl overflow-hidden">
                <thead className="bg-[#FAF9F6] text-[#526058]">
                  <tr>
                    <th className="p-3 border-b border-r border-[#E8E2D6]">Package Size (Down)</th>
                    {couriers.flatMap((c) =>
                      c.services.map((s) => (
                        <th key={s.id} className="p-3 border-b border-[#E8E2D6]">
                          <div className="font-semibold text-[#18231C]">{s.name}</div>
                          <div className="text-[10px] text-[#526058]">
                            {c.name} {!c.isActive || !s.isActive ? '(Paused)' : ''}
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D6]">
                  {(['BAG-S', 'BAG-M', 'BOX-1', 'BOX-2'] as PackageSizeCode[]).map((code) => {
                    const sizeInfo = PACKAGE_SIZES[code];
                    return (
                      <tr key={code} className="hover:bg-[#FAF9F6]/50">
                        <td className="p-3 border-r border-[#E8E2D6] bg-[#FAF9F6]/30">
                          <strong className="text-[#18231C]">{code}</strong>
                          <div className="text-[10px] text-[#526058]">{sizeInfo.name}</div>
                          <div className="text-[10px] text-[#526058]">Max: {sizeInfo.maxWeightGrams}g</div>
                        </td>
                        {couriers.flatMap((c) =>
                          c.services.map((s) => {
                            const rate = rates.find(
                              (r) => r.courierServiceId === s.id && r.packageSizeCode === code
                            );
                            const priceCents = rate ? rate.priceCents : 0;
                            return (
                              <td key={s.id} className="p-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-[#526058]">$</span>
                                  <input
                                    type="number"
                                    step="0.50"
                                    value={(priceCents / 100).toFixed(2)}
                                    onChange={(e) => {
                                      if (rate) {
                                        const val = parseFloat(e.target.value) || 0;
                                        onUpdateRate(rate.id, Math.round(val * 100));
                                      }
                                    }}
                                    className="w-20 p-1 border border-[#E8E2D6] rounded font-mono text-xs focus:outline-none focus:border-[#1B382B]"
                                  />
                                </div>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Courier & Service Activation + Free Shipping Rules */}
            <div className="pt-4 border-t border-[#E8E2D6] space-y-4">
              <h4 className="font-display text-sm font-bold text-[#18231C]">
                Courier Carriers, Signature & Free-Shipping Thresholds
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {couriers.map((courier) => (
                  <div
                    key={courier.id}
                    className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]/60 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-2">
                      <div>
                        <strong className="text-[#18231C]">{courier.name}</strong>
                        <div className="text-[10px] font-mono text-[#526058] truncate max-w-[240px]">
                          {courier.trackingUrlTemplate}
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-[#18231C]">
                        <input
                          type="checkbox"
                          checked={courier.isActive}
                          onChange={(e) =>
                            onUpdateCourier({ ...courier, isActive: e.target.checked })
                          }
                          className="accent-[#1B382B]"
                        />
                        <span>Carrier Active</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      {courier.services.map((srv) => (
                        <div
                          key={srv.id}
                          className="p-2.5 bg-white rounded-lg border border-[#E8E2D6] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#18231C]">{srv.name}</span>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={srv.isActive}
                                onChange={(e) =>
                                  onUpdateCourier({
                                    ...courier,
                                    services: courier.services.map((s) =>
                                      s.id === srv.id ? { ...s, isActive: e.target.checked } : s
                                    ),
                                  })
                                }
                                className="accent-[#1B382B]"
                              />
                              <span>Enabled</span>
                            </label>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#526058]">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={srv.requiresSignature}
                                onChange={(e) =>
                                  onUpdateCourier({
                                    ...courier,
                                    services: courier.services.map((s) =>
                                      s.id === srv.id
                                        ? { ...s, requiresSignature: e.target.checked }
                                        : s
                                    ),
                                  })
                                }
                                className="accent-[#1B382B]"
                              />
                              <span>Signature Required</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                              <span>Free over ($ NZD):</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={
                                  srv.freeOverAmountCents
                                    ? Math.round(srv.freeOverAmountCents / 100)
                                    : 0
                                }
                                onChange={(e) => {
                                  const dollars = parseFloat(e.target.value) || 0;
                                  onUpdateCourier({
                                    ...courier,
                                    services: courier.services.map((s) =>
                                      s.id === srv.id
                                        ? {
                                            ...s,
                                            freeOverAmountCents:
                                              dollars > 0 ? Math.round(dollars * 100) : undefined,
                                          }
                                        : s
                                    ),
                                  });
                                }}
                                className="w-16 p-1 border border-[#E8E2D6] rounded font-mono text-right"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Discount & Promo Codes Manager (SQLite) */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5">
            <div>
              <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#1B382B]" />
                Discount & Promo Codes (SQLite)
              </h3>
              <p className="text-[#526058] mt-0.5">
                All promo codes evaluated in cart drawer and server checkout are managed live from SQLite.
              </p>
            </div>

            {discError && (
              <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] font-medium">
                {discError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDiscError(null);
                const cleanCode = discCode.trim().toUpperCase();
                if (!cleanCode) return;
                const rawVal = parseFloat(discValue) || 0;
                const valCentsOrPct =
                  discType === 'PERCENTAGE'
                    ? Math.round(rawVal)
                    : discType === 'FIXED'
                    ? Math.round(rawVal * 100)
                    : 0;
                try {
                  await onSaveDiscount({
                    code: cleanCode,
                    type: discType,
                    value: valCentsOrPct,
                    minSpendCents: Math.round((parseFloat(discMinSpend) || 0) * 100) || undefined,
                    description:
                      discDescription.trim() || `${cleanCode} promotional discount`,
                    isActive: true,
                  });
                  setDiscCode('');
                  setDiscDescription('');
                } catch (err) {
                  setDiscError(err instanceof Error ? err.message : 'Unable to save discount code.');
                }
              }}
              className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
            >
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Code *</label>
                <input
                  type="text"
                  required
                  placeholder="POUNAMU15"
                  value={discCode}
                  onChange={(e) => setDiscCode(e.target.value)}
                  className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Type</label>
                <select
                  value={discType}
                  onChange={(e) => setDiscType(e.target.value as DiscountRule['type'])}
                  className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                >
                  <option value="PERCENTAGE">% Off Items</option>
                  <option value="FIXED">$ Off Fixed</option>
                  <option value="FREE_SHIPPING">Free Courier</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">
                  {discType === 'PERCENTAGE' ? 'Percent (%)' : discType === 'FIXED' ? 'Amount ($ NZD)' : 'Value'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  disabled={discType === 'FREE_SHIPPING'}
                  value={discType === 'FREE_SHIPPING' ? '0' : discValue}
                  onChange={(e) => setDiscValue(e.target.value)}
                  className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Min Spend ($)</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={discMinSpend}
                  onChange={(e) => setDiscMinSpend(e.target.value)}
                  className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Description</label>
                <input
                  type="text"
                  placeholder="Seasonal discount..."
                  value={discDescription}
                  onChange={(e) => setDiscDescription(e.target.value)}
                  className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                className="py-2 px-3 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] cursor-pointer"
              >
                Save Promo Code
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#526058] border-b border-[#E8E2D6]">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Min Spend</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D6]">
                  {discounts.map((d) => (
                    <tr key={d.code}>
                      <td className="p-3 font-mono font-bold text-[#1B382B]">{d.code}</td>
                      <td className="p-3 font-mono">
                        {d.type === 'PERCENTAGE'
                          ? `${d.value}% off`
                          : d.type === 'FIXED'
                          ? `${formatNZD(d.value)} off`
                          : 'Free Courier'}
                      </td>
                      <td className="p-3 font-mono text-[#526058]">
                        {d.minSpendCents ? formatNZD(d.minSpendCents) : 'None'}
                      </td>
                      <td className="p-3 text-[#526058]">{d.description}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => onSaveDiscount({ ...d, isActive: !d.isActive })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            d.isActive
                              ? 'bg-[#2D5A46]/15 text-[#2D5A46]'
                              : 'bg-[#E8E2D6] text-[#526058]'
                          }`}
                        >
                          {d.isActive ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteDiscount(d.code)}
                          className="text-[#A63A2A] hover:underline font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Digital Gift Cards Manager (SQLite) */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#1B382B]" />
                  Digital Gift Cards (SQLite · {giftCards.length})
                </h3>
                <p className="text-[#526058] mt-0.5">
                  Issue studio gift cards directly, activate Cash on Pickup vouchers once payment is collected, adjust balances, or inspect redemption logs.
                </p>
              </div>
            </div>

            {gcNotice && (
              <div className="p-2.5 rounded-lg bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                <span>{gcNotice}</span>
              </div>
            )}

            {gcError && (
              <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] font-medium">
                {gcError}
              </div>
            )}

            {onCreateAdminGiftCard && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setGcError(null);
                  setGcNotice(null);
                  const cents = Math.round((parseFloat(gcAmountNzd) || 0) * 100);
                  if (cents < 500 || cents > 500000) {
                    setGcError('Gift card value must be between $5.00 and $5,000.00 NZD.');
                    return;
                  }
                  setGcSaving(true);
                  try {
                    const created = await onCreateAdminGiftCard({
                      amountCents: cents,
                      recipientName: gcRecipientName.trim(),
                      recipientEmail: gcRecipientEmail.trim(),
                      message: gcMessage.trim() || undefined,
                      code: gcCustomCode.trim().toUpperCase() || undefined,
                      sendEmail: true,
                    });
                    setGcNotice(
                      `Issued active gift card ${created.code} (${formatNZD(created.initialAmountCents)}) for ${created.recipientEmail}.`
                    );
                    setGcRecipientName('');
                    setGcRecipientEmail('');
                    setGcMessage('');
                    setGcCustomCode('');
                  } catch (err) {
                    setGcError(err instanceof Error ? err.message : 'Unable to create gift card.');
                  } finally {
                    setGcSaving(false);
                  }
                }}
                className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
              >
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Value ($ NZD) *</label>
                  <input
                    type="number"
                    required
                    min="5"
                    max="5000"
                    step="1"
                    value={gcAmountNzd}
                    onChange={(e) => setGcAmountNzd(e.target.value)}
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Aroha Henderson"
                    value={gcRecipientName}
                    onChange={(e) => setGcRecipientName(e.target.value)}
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="aroha@example.co.nz"
                    value={gcRecipientEmail}
                    onChange={(e) => setGcRecipientEmail(e.target.value)}
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Custom Code (Opt.)</label>
                  <input
                    type="text"
                    placeholder="Auto PA-GIFT-..."
                    value={gcCustomCode}
                    onChange={(e) => setGcCustomCode(e.target.value.toUpperCase())}
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Dedication Note</label>
                  <input
                    type="text"
                    placeholder="Optional message..."
                    value={gcMessage}
                    onChange={(e) => setGcMessage(e.target.value)}
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={gcSaving}
                  className="py-2 px-3 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] disabled:opacity-50 cursor-pointer"
                >
                  {gcSaving ? 'Issuing...' : 'Issue Gift Card'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#526058] border-b border-[#E8E2D6]">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Recipient &amp; Purchaser</th>
                    <th className="p-3">Original</th>
                    <th className="p-3">Remaining</th>
                    <th className="p-3">Mode &amp; Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D6]">
                  {giftCards.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#526058]">
                        No digital gift cards issued yet. Use the form above to issue one.
                      </td>
                    </tr>
                  ) : (
                    giftCards.map((gc) => (
                      <tr key={gc.id} className="hover:bg-[#FAF9F6]/50">
                        <td className="p-3 font-mono font-bold text-[#1B382B]">{gc.code}</td>
                        <td className="p-3">
                          <div className="font-semibold text-[#18231C]">{gc.recipientName}</div>
                          <div className="text-[10px] text-[#526058]">
                            To: {gc.recipientEmail} · By: {gc.purchaserEmail}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[#526058] tabular-nums">
                          {formatNZD(gc.initialAmountCents)}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#18231C] tabular-nums">
                          {formatNZD(gc.remainingBalanceCents)}
                        </td>
                        <td className="p-3 space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              gc.purchaseStatus === 'ACTIVE'
                                ? 'bg-[#2D5A46] text-white'
                                : gc.purchaseStatus === 'PENDING'
                                ? 'bg-[#C29B38] text-white'
                                : 'bg-[#7D8B82] text-white'
                            }`}
                          >
                            {gc.purchaseStatus}
                          </span>
                          <div className="text-[10px] text-[#526058]">
                            {gc.purchasePaymentMethod === 'CASH_ON_PICKUP'
                              ? 'Cash on Pickup'
                              : gc.purchasePaymentMethod === 'ADMIN_ISSUED'
                              ? 'Admin Issued'
                              : 'Stripe'}
                          </div>
                        </td>
                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          {gc.purchaseStatus === 'PENDING' && onUpdateAdminGiftCard && (
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateAdminGiftCard(gc.id, { activateAndEmail: true });
                                setGcNotice(
                                  `Cash collected — ${gc.code} activated and emailed to ${gc.recipientEmail}.`
                                );
                              }}
                              className="px-2.5 py-1 bg-[#1B382B] text-white rounded text-[11px] font-semibold hover:bg-[#12241B] cursor-pointer"
                            >
                              Collect Cash &amp; Activate
                            </button>
                          )}
                          {gc.purchaseStatus !== 'PENDING' &&
                            gc.purchaseStatus !== 'REDEEMED' &&
                            onUpdateAdminGiftCard && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextActive = gc.purchaseStatus !== 'ACTIVE';
                                  await onUpdateAdminGiftCard(gc.id, {
                                    isActive: nextActive,
                                    purchaseStatus: nextActive ? 'ACTIVE' : 'PAUSED',
                                  });
                                }}
                                className="text-[#1B382B] hover:underline font-semibold cursor-pointer"
                              >
                                {gc.purchaseStatus === 'ACTIVE' ? 'Pause' : 'Activate'}
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await apiFetch<{ redemptions: GiftCardRedemption[] }>(
                                  '/api/admin/gift-cards'
                                );
                                setGcRedemptionsView({
                                  card: gc,
                                  rows: (res.redemptions || []).filter((r) => r.giftCardId === gc.id),
                                });
                              } catch {
                                setGcRedemptionsView({ card: gc, rows: [] });
                              }
                            }}
                            className="text-[#526058] hover:text-[#18231C] hover:underline font-semibold cursor-pointer"
                          >
                            History
                          </button>
                          {onDeleteAdminGiftCard && (
                            <button
                              type="button"
                              onClick={() => void onDeleteAdminGiftCard(gc.id)}
                              className="text-[#A63A2A] hover:underline font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {gcRedemptionsView && (
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-[#18231C]">
                    Redemption History — {gcRedemptionsView.card.code}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setGcRedemptionsView(null)}
                    className="text-[#526058] hover:text-[#18231C] font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {gcRedemptionsView.rows.length === 0 ? (
                  <p className="text-[#526058] text-[11px]">No redemptions recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 text-[11px]">
                    {gcRedemptionsView.rows.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-lg border border-[#E8E2D6]"
                      >
                        <span className="font-mono font-semibold text-[#18231C]">
                          {r.orderNumber || r.orderId}
                        </span>
                        <span className="font-mono font-bold text-[#1B382B]">
                          -{formatNZD(r.amountCents)}
                        </span>
                        <span className="text-[#2D5A46] font-semibold">{r.status}</span>
                        <span className="text-[#526058]">
                          {new Date(r.redeemedAt).toLocaleString('en-NZ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STONE INVENTORY & CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#18231C]">
              Stone Catalogue & Authenticity Codes ({products.length})
            </h3>
          </div>

          {productActionError && (
            <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs font-medium">
              {productActionError}
            </div>
          )}

          {/* Add new product form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTitle.trim()) return;
              setProductActionError(null);
              setProductSaving(true);
              try {
                const qty = Math.max(0, parseInt(newQty, 10) || 1);
                const prod: Product = {
                  id: `prod-${Date.now()}`,
                  sku: newSku.trim() || `SKU-${Math.floor(100 + Math.random() * 900)}`,
                  title: newTitle.trim(),
                  slug: newTitle
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, ''),
                  priceCents: Math.round((parseFloat(newPrice) || 0) * 100),
                  costPriceCents: Math.round((parseFloat(newCost) || 0) * 100),
                  weightGrams: parseInt(newWeight, 10) || 75,
                  defaultPackageSize: newPkgSize,
                  quantity: qty,
                  isUniquePiece: newIsUnique,
                  isMadeToOrder: newIsMadeToOrder,
                  material: newMaterial,
                  designType: newDesign,
                  authenticityCode: newCode.trim(),
                  originRiver: newRiver.trim(),
                  isExportRestricted: newIsExportRestricted || newMaterial === 'Whale Bone',
                  description:
                    newDescription.trim() ||
                    `Master carved ${newMaterial} ${newDesign} by Jesse.`,
                  spiritualMeaning: 'Symbol of mana, courage, and safe travel across Aotearoa.',
                  dimensions: '60mm × 25mm × 7mm',
                  cordDetails: 'Traditional 4-plait black cord',
                  carverName: 'Jesse',
                  images: [newImage.trim() || '/src/assets/images/product_toki_pounamu_1794468031889.jpg'],
                  featured: true,
                  published: true,
                };
                await onAddProduct(prod);
                setNewTitle('');
                setNewSku('');
                setNewDescription('');
              } catch (err) {
                setProductActionError(err instanceof Error ? err.message : 'Unable to add product.');
              } finally {
                setProductSaving(false);
              }
            }}
            className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-3 text-xs"
          >
            <div className="font-bold text-[#18231C]">Add Newly Carved Taonga to Studio:</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Taonga Title *"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
              />
              <select
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value as StoneVariety)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
              >
                {dynamicStoneNames.map((stone) => (
                  <option key={stone} value={stone}>
                    {stone}
                  </option>
                ))}
              </select>
              <select
                value={newDesign}
                onChange={(e) => setNewDesign(e.target.value as DesignMotif)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
              >
                {dynamicDesignNames.map((design) => (
                  <option key={design} value={design}>
                    {design}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Ngāi Tahu Code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Origin River"
                value={newRiver}
                onChange={(e) => setNewRiver(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white sm:col-span-2"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price ($ NZD)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost ($ NZD)"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
              />
              <input
                type="number"
                min="0"
                placeholder="Stock Qty"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
              <input
                type="text"
                placeholder="Image URL or upload →"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono sm:col-span-2"
              />
              <label className="p-2 border border-[#1B382B] text-[#1B382B] rounded-lg font-semibold text-center cursor-pointer hover:bg-[#1B382B] hover:text-white transition-colors">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= 2.5 * 1024 * 1024) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (typeof ev.target?.result === 'string') {
                          setNewImage(ev.target.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <select
                value={newPkgSize}
                onChange={(e) => setNewPkgSize(e.target.value as PackageSizeCode)}
                className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
              >
                <option value="BAG-S">BAG-S</option>
                <option value="BAG-M">BAG-M</option>
                <option value="BOX-1">BOX-1</option>
                <option value="BOX-2">BOX-2</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-[#18231C]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsUnique}
                    onChange={(e) => setNewIsUnique(e.target.checked)}
                    className="accent-[#1B382B]"
                  />
                  <span>1-of-1 Unique Piece</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsMadeToOrder}
                    onChange={(e) => setNewIsMadeToOrder(e.target.checked)}
                    className="accent-[#1B382B]"
                  />
                  <span>Made to Order</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsExportRestricted}
                    onChange={(e) => setNewIsExportRestricted(e.target.checked)}
                    className="accent-[#1B382B]"
                  />
                  <span>NZ-Only Export Restricted</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={productSaving}
                className="px-5 py-2 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{productSaving ? 'Saving...' : 'Add Taonga to Store'}</span>
              </button>
            </div>
          </form>

          {/* Product list */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF9F6] text-[#526058] border-b border-[#E8E2D6]">
                <tr>
                  <th className="p-3">Taonga Title</th>
                  <th className="p-3">Variety & Code</th>
                  <th className="p-3">Origin</th>
                  <th className="p-3">Price / Cost</th>
                  <th className="p-3">Stock & Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D6]">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF9F6]/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          className="w-9 h-9 rounded-lg object-cover border border-[#E8E2D6] shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-[#18231C]">{p.title}</div>
                          <div className="text-[10px] font-mono text-[#7D8B82]">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>{p.material}</div>
                      <div className="text-[10px] font-mono text-[#2D5A46] font-semibold">
                        {p.authenticityCode}
                      </div>
                    </td>
                    <td className="p-3 text-[#526058]">{p.originRiver}</td>
                    <td className="p-3 font-mono">
                      <div className="font-bold text-[#1B382B]">{formatNZD(p.priceCents)}</div>
                      <div className="text-[10px] text-[#526058]">Cost {formatNZD(p.costPriceCents)}</div>
                    </td>
                    <td className="p-3 space-y-1">
                      <div>
                        {p.isUniquePiece ? (
                          <span className="text-[10px] text-[#C29B38] font-bold">
                            1-of-1 ({p.quantity} left)
                          </span>
                        ) : p.isMadeToOrder ? (
                          <span className="text-[10px] text-[#2D5A46] font-bold">Made to Order</span>
                        ) : (
                          <span className="text-[10px] text-[#526058]">Qty: {p.quantity}</span>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => onUpdateProduct({ ...p, published: !p.published })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            p.published
                              ? 'bg-[#2D5A46]/15 text-[#2D5A46]'
                              : 'bg-[#E8E2D6] text-[#526058]'
                          }`}
                        >
                          {p.published ? 'Published' : 'Hidden'}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(p)}
                        className="px-2.5 py-1 border border-[#E8E2D6] rounded-lg text-[#1B382B] font-semibold hover:bg-[#FAF9F6] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      {confirmDeleteProductId === p.id ? (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteProduct(p.id);
                              setConfirmDeleteProductId(null);
                            }}
                            className="px-2.5 py-1 bg-[#A63A2A] text-white rounded-lg font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProductId(null)}
                            className="px-2 py-1 border border-[#E8E2D6] rounded-lg text-[#526058] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProductId(p.id)}
                          className="px-2.5 py-1 border border-[#A63A2A]/30 text-[#A63A2A] rounded-lg font-semibold hover:bg-[#A63A2A]/10 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* EDIT PRODUCT MODAL */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 bg-[#111C16]/50 flex items-center justify-center p-4 overflow-y-auto">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setProductSaving(true);
                  try {
                    await onUpdateProduct(editingProduct);
                    setEditingProduct(null);
                  } finally {
                    setProductSaving(false);
                  }
                }}
                className="bg-white rounded-2xl border border-[#E8E2D6] p-6 max-w-2xl w-full space-y-4 text-xs my-8"
              >
                <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-3">
                  <h4 className="font-display font-bold text-base text-[#18231C]">
                    Edit Taonga: {editingProduct.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="text-[#526058] hover:text-[#18231C] cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold">Title</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.title}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, title: e.target.value })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">SKU</label>
                    <input
                      type="text"
                      value={editingProduct.sku}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, sku: e.target.value })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Price ($ NZD incl. GST)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={(editingProduct.priceCents / 100).toFixed(2)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          priceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                        })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Compare-At Price ($ NZD, optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        editingProduct.compareAtPriceCents
                          ? (editingProduct.compareAtPriceCents / 100).toFixed(2)
                          : ''
                      }
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          compareAtPriceCents: e.target.value
                            ? Math.round((parseFloat(e.target.value) || 0) * 100)
                            : undefined,
                        })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Cost Price ($ NZD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={(editingProduct.costPriceCents / 100).toFixed(2)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          costPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                        })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.quantity}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Ngāi Tahu Code</label>
                    <input
                      type="text"
                      value={editingProduct.authenticityCode}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, authenticityCode: e.target.value })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Origin River</label>
                    <input
                      type="text"
                      value={editingProduct.originRiver}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, originRiver: e.target.value })
                      }
                      className="w-full p-2 border border-[#E8E2D6] rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">Primary Image URL</label>
                  <input
                    type="text"
                    value={editingProduct.images[0] || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        images: [e.target.value, ...editingProduct.images.slice(1)],
                      })
                    }
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">Description</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    className="w-full p-2 border border-[#E8E2D6] rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.published}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, published: e.target.checked })
                      }
                      className="accent-[#1B382B]"
                    />
                    <span>Published in Store</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.isUniquePiece}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, isUniquePiece: e.target.checked })
                      }
                      className="accent-[#1B382B]"
                    />
                    <span>Unique 1-of-1</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.isMadeToOrder}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, isMadeToOrder: e.target.checked })
                      }
                      className="accent-[#1B382B]"
                    />
                    <span>Made to Order</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.isExportRestricted}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          isExportRestricted: e.target.checked,
                        })
                      }
                      className="accent-[#1B382B]"
                    />
                    <span>Export Restricted</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E2D6]">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 border border-[#E8E2D6] rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={productSaving}
                    className="px-5 py-2 bg-[#1B382B] text-white font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {productSaving ? 'Saving...' : 'Save Product Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PAST & ARCHIVED GALLERY MANAGER */}
          <div className="pt-8 border-t border-[#E8E2D6] space-y-5">
            <div>
              <h3 className="font-display text-base font-bold text-[#18231C]">
                Past Works Gallery Archive ({galleryItems.length} curated +{' '}
                {products.filter((p) => !p.isMadeToOrder && p.quantity <= 0).length} sold storefront items)
              </h3>
              <p className="text-xs text-[#526058] mt-0.5">
                Sold storefront pieces automatically move out of the active shop into the public Gallery so customers can still browse and choose past styles for custom carving. You can also archive additional past pieces below.
              </p>
            </div>

            {galError && (
              <div className="p-2.5 rounded-lg bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs">
                {galError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!galTitle.trim()) return;
                setGalError(null);
                setGalSaving(true);
                try {
                  await onAddGalleryItem({
                    title: galTitle.trim(),
                    material: galMaterial,
                    designType: galDesign,
                    originRiver: galOrigin.trim(),
                    authenticityCode: galCode.trim(),
                    carvedYear: galYear.trim(),
                    imageUrl: galImage.trim(),
                    description:
                      galDescription.trim() ||
                      `Past heirloom ${galMaterial} ${galDesign} carved by Jesse.`,
                  });
                  setGalTitle('');
                  setGalDescription('');
                } catch (err) {
                  setGalError(err instanceof Error ? err.message : 'Unable to add gallery piece.');
                } finally {
                  setGalSaving(false);
                }
              }}
              className="p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6] space-y-3 text-xs"
            >
              <div className="font-bold text-[#18231C]">Add Past Heirloom to Gallery Archive:</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Carving Title *"
                  value={galTitle}
                  onChange={(e) => setGalTitle(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
                />
                <select
                  value={galMaterial}
                  onChange={(e) => setGalMaterial(e.target.value as StoneVariety)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
                >
                  {dynamicStoneNames.map((stone) => (
                    <option key={stone} value={stone}>
                      {stone}
                    </option>
                  ))}
                </select>
                <select
                  value={galDesign}
                  onChange={(e) => setGalDesign(e.target.value as DesignMotif)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
                >
                  {dynamicDesignNames.map((design) => (
                    <option key={design} value={design}>
                      {design}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Year Carved (e.g. 2025)"
                  value={galYear}
                  onChange={(e) => setGalYear(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <input
                  type="text"
                  placeholder="Origin River"
                  value={galOrigin}
                  onChange={(e) => setGalOrigin(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
                />
                <input
                  type="text"
                  placeholder="Ngāi Tahu Code"
                  value={galCode}
                  onChange={(e) => setGalCode(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono"
                />
                <label className="p-2 border border-[#1B382B] text-[#1B382B] rounded-lg font-semibold text-center cursor-pointer hover:bg-[#1B382B] hover:text-white transition-colors">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size <= 2.5 * 1024 * 1024) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (typeof ev.target?.result === 'string') {
                            setGalImage(ev.target.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <input
                  type="text"
                  placeholder="Image URL"
                  value={galImage}
                  onChange={(e) => setGalImage(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white font-mono sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Description / Carving Story"
                  value={galDescription}
                  onChange={(e) => setGalDescription(e.target.value)}
                  className="p-2 border border-[#E8E2D6] rounded-lg bg-white"
                />
                <button
                  type="submit"
                  disabled={galSaving}
                  className="py-2 px-4 bg-[#1B382B] text-white font-semibold rounded-lg hover:bg-[#12241B] cursor-pointer disabled:opacity-50"
                >
                  {galSaving ? 'Adding...' : 'Add to Gallery Archive'}
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {galleryItems.map((g) => (
                <div
                  key={g.id}
                  className="p-3 rounded-xl border border-[#E8E2D6] bg-white flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={g.imageUrl}
                      alt={g.title}
                      className="w-12 h-12 rounded-lg object-cover border border-[#E8E2D6] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-[#18231C] truncate">{g.title}</div>
                      <div className="text-[10px] text-[#526058] truncate">
                        {g.material} · {g.designType} · {g.carvedYear}
                      </div>
                    </div>
                  </div>
                  {confirmDeleteGalleryId === g.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteGalleryItem(g.id);
                          setConfirmDeleteGalleryId(null);
                        }}
                        className="px-2 py-1 bg-[#A63A2A] text-white rounded text-[10px] font-bold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGalleryId(null)}
                        className="px-2 py-1 border border-[#E8E2D6] rounded text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGalleryId(g.id)}
                      className="px-2 py-1 border border-[#A63A2A]/30 text-[#A63A2A] rounded-lg text-[10px] font-semibold hover:bg-[#A63A2A]/10 shrink-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DYNAMIC SITE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          {/* Brand Assets: Logo & Favicon Upload */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#1B382B]" />
                  Brand Identity & Visual Assets
                </h3>
                <p className="text-xs text-[#526058] mt-0.5">
                  Upload your boutique studio logo and browser favicon. Changes update immediately across the storefront, header, footer, and browser tab.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload Card */}
              <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#18231C] flex items-center gap-1.5">
                    Studio Logo
                  </label>
                  {settings.logoUrl && (
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, logoUrl: undefined })}
                      className="text-[11px] text-[#A63A2A] hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Logo Preview Box */}
                <div className="h-24 rounded-lg border border-dashed border-[#D1C7B7] bg-white flex items-center justify-center p-3 relative overflow-hidden group">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Studio Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[#7D8B82] space-y-1">
                      <ImageIcon className="w-6 h-6 mx-auto opacity-40" />
                      <span className="text-[11px] block">No custom logo set (using default emblem)</span>
                    </div>
                  )}
                </div>

                {/* File Upload Input */}
                <div className="space-y-2">
                  <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-[#1B382B] text-[#1B382B] hover:bg-[#1B382B] hover:text-white transition-colors rounded-lg text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Image</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (typeof event.target?.result === 'string') {
                              onUpdateSettings({ ...settings, logoUrl: event.target.result });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7D8B82] block">Or enter public path / external image URL:</span>
                    <input
                      type="text"
                      placeholder="/logo.png or https://example.com/logo.png"
                      value={settings.logoUrl || ''}
                      onChange={(e) => onUpdateSettings({ ...settings, logoUrl: e.target.value || undefined })}
                      className="w-full text-xs p-2 border border-[#E8E2D6] rounded-md bg-white font-mono focus:outline-[#1B382B]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#7D8B82] pt-1">
                  <span>PNG, SVG, JPG, WebP</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        logoUrl: '/logo.png',
                      })
                    }
                    className="text-[#1B382B] font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Use Public /logo.png
                  </button>
                </div>
              </div>

              {/* Favicon Upload Card */}
              <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#18231C] flex items-center gap-1.5">
                    Browser Favicon
                  </label>
                  {settings.faviconUrl && (
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, faviconUrl: undefined })}
                      className="text-[11px] text-[#A63A2A] hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Simulated Browser Tab Preview */}
                <div className="h-24 rounded-lg border border-[#D1C7B7] bg-[#EBE7DF] p-2 flex flex-col justify-end">
                  <div className="text-[10px] text-[#7D8B82] mb-1 font-mono uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#1B382B]" />
                    Browser Tab Preview
                  </div>
                  <div className="bg-white rounded-t-md px-3 py-1.5 flex items-center gap-2 border-t border-x border-[#D1C7B7] shadow-xs">
                    <div className="w-4 h-4 rounded-xs flex items-center justify-center shrink-0 overflow-hidden bg-[#F7F5F0]">
                      {settings.faviconUrl ? (
                        <img
                          src={settings.faviconUrl}
                          alt="Favicon"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-[#1B382B]">P</span>
                      )}
                    </div>
                    <span className="text-[11px] font-sans-ui text-[#18231C] truncate max-w-[170px]">
                      {settings.siteName} — NZ Pounamu
                    </span>
                  </div>
                </div>

                {/* File Upload Input */}
                <div className="space-y-2">
                  <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-[#1B382B] text-[#1B382B] hover:bg-[#1B382B] hover:text-white transition-colors rounded-lg text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Favicon</span>
                    <input
                      type="file"
                      accept="image/png, image/x-icon, image/svg+xml, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (typeof event.target?.result === 'string') {
                              onUpdateSettings({ ...settings, faviconUrl: event.target.result });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7D8B82] block">Or enter public path / external favicon URL:</span>
                    <input
                      type="text"
                      placeholder="/favicon.png or https://example.com/favicon.ico"
                      value={settings.faviconUrl || ''}
                      onChange={(e) => onUpdateSettings({ ...settings, faviconUrl: e.target.value || undefined })}
                      className="w-full text-xs p-2 border border-[#E8E2D6] rounded-md bg-white font-mono focus:outline-[#1B382B]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#7D8B82] pt-1">
                  <span>ICO, PNG, SVG (64×64 ready)</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        faviconUrl: '/favicon.png',
                      })
                    }
                    className="text-[#1B382B] font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Use Public /favicon.png
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Authentication & Member Access Controls */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs">
            <div className="border-b border-[#E8E2D6] pb-4">
              <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1B382B]" />
                Client Login & Registration Options
              </h3>
              <p className="text-xs text-[#526058] mt-0.5">
                Choose which authentication methods customers can use to register and sign in to view their order history.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Toggle: Email Registration */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50">
                <div className="space-y-1">
                  <div className="font-bold text-[#18231C]">Allow Email Registration & Login</div>
                  <p className="text-[#526058]">
                    Let new clients create an account with their email and password (stored securely in SQLite with scrypt hashing).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.allowEmailRegistration}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        allowEmailRegistration: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-[#D1C7B7] peer-focus:outline-none rounded-full peer peer-checked:bg-[#1B382B] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                </label>
              </div>

              {/* Toggle: Gmail / Google OAuth */}
              <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-[#18231C]">Allow Gmail / Google OAuth</div>
                    <p className="text-[#526058]">
                      Show the “Continue with Gmail / Google” sign-in button in the customer login modal.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.allowGmailOAuth}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          allowGmailOAuth: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-[#D1C7B7] peer-focus:outline-none rounded-full peer peer-checked:bg-[#1B382B] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                  </label>
                </div>

                {settings.allowGmailOAuth && (
                  <div className="pt-2 border-t border-[#E8E2D6]/80 space-y-1">
                    <label className="font-semibold text-[#18231C] block">
                      Google OAuth 2.0 Web Client ID
                    </label>
                    <input
                      type="text"
                      value={settings.googleClientId || ''}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          googleClientId: e.target.value,
                        })
                      }
                      placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                      className="w-full p-2.5 bg-white border border-[#E8E2D6] rounded-lg font-mono text-xs"
                    />
                    <p className="text-[11px] text-[#526058]">
                      Required for live Google Sign-In popups. Tokens are verified server-side against Google before creating a SQLite session.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Studio & Legal Settings */}
          <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6 shadow-xs">
            <h3 className="font-display text-base font-bold text-[#18231C]">
              Studio & Legal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Studio / Site Name</label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => onUpdateSettings({ ...settings, siteName: e.target.value })}
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Header Tagline (underneath Site Name)</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => onUpdateSettings({ ...settings, tagline: e.target.value })}
                  placeholder="Hand-Carved Authentic New Zealand Greenstone by Jesse"
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#18231C]">Announcement Banner Text</label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[#2D5A46]">
                    <input
                      type="checkbox"
                      checked={settings.announcementEnabled}
                      onChange={(e) =>
                        onUpdateSettings({ ...settings, announcementEnabled: e.target.checked })
                      }
                      className="accent-[#1B382B]"
                    />
                    <span>Show Top Banner</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={settings.announcementBanner}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, announcementBanner: e.target.value })
                  }
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">NZ GST Registration Number</label>
                <input
                  type="text"
                  value={settings.gstNumber}
                  onChange={(e) => onUpdateSettings({ ...settings, gstNumber: e.target.value })}
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Contact Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => onUpdateSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Studio Phone</label>
                <input
                  type="text"
                  value={settings.contactPhone}
                  onChange={(e) => onUpdateSettings({ ...settings, contactPhone: e.target.value })}
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Workshop Physical Address</label>
                <input
                  type="text"
                  value={settings.workshopAddress}
                  onChange={(e) => onUpdateSettings({ ...settings, workshopAddress: e.target.value })}
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg"
                />
              </div>
            </div>

            {/* Persistence & Save Indicator */}
            <div className="pt-2 border-t border-[#E8E2D6] flex items-center justify-between text-xs text-[#526058]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-medium text-[#1B382B]">Synced with SQLite database</span>
                <span className="text-[#7D8B82]">— settings persist across restarts</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings })}
                className="py-1.5 px-3 bg-[#1B382B] text-white rounded-lg text-xs font-semibold hover:bg-[#2D5A46] transition-colors shadow-xs cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Legal Pages: Terms, Privacy Act 2020, Shipping & Returns, Custom Commissions */}
          <form
            onSubmit={handleSavePolicies}
            className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E2D6] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1B382B]" />
                  Legal Pages, Terms &amp; Privacy Policies (SQLite)
                </h3>
                <p className="text-xs text-[#526058] mt-1">
                  Edit your studio’s legal notices without touching code. Blank lines separate paragraphs, and numbered headings (e.g. <code className="font-mono">1. Section Title</code>) format automatically on the storefront policy pages.
                </p>
              </div>
              {onOpenPolicies && (
                <button
                  type="button"
                  onClick={() => onOpenPolicies('terms')}
                  className="px-3 py-1.5 rounded-lg border border-[#E8E2D6] bg-[#FAF9F6] text-[11px] font-semibold text-[#1B382B] hover:border-[#1B382B] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Live Policy Page
                </button>
              )}
            </div>

            {policiesError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {policiesError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Terms & Conditions */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#18231C]">
                    Terms &amp; Conditions (Consumer Guarantees Act &amp; Store Terms)
                  </label>
                  <div className="flex items-center gap-2">
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={() => onOpenPolicies('terms')}
                        className="text-[11px] text-[#2D5A46] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPoliciesDraft((prev) => ({
                          ...prev,
                          termsAndConditionsText: DEFAULT_SITE_SETTINGS.termsAndConditionsText,
                        }))
                      }
                      className="text-[11px] text-[#526058] hover:text-[#18231C] underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
                <textarea
                  rows={7}
                  value={policiesDraft.termsAndConditionsText}
                  onChange={(e) =>
                    setPoliciesDraft((prev) => ({
                      ...prev,
                      termsAndConditionsText: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-sans-ui text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {/* Privacy Policy */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#18231C]">
                    Privacy Policy (New Zealand Privacy Act 2020 &amp; IPP 12)
                  </label>
                  <div className="flex items-center gap-2">
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={() => onOpenPolicies('privacy')}
                        className="text-[11px] text-[#2D5A46] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPoliciesDraft((prev) => ({
                          ...prev,
                          privacyPolicyText: DEFAULT_SITE_SETTINGS.privacyPolicyText,
                        }))
                      }
                      className="text-[11px] text-[#526058] hover:text-[#18231C] underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
                <textarea
                  rows={7}
                  value={policiesDraft.privacyPolicyText}
                  onChange={(e) =>
                    setPoliciesDraft((prev) => ({
                      ...prev,
                      privacyPolicyText: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-sans-ui text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {/* Shipping & Returns Policy */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#18231C]">
                    Shipping &amp; Returns Policy (Couriers, DOC Whale Bone Rules &amp; Refunds)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[#526058]">
                      <span>Return Window (Days):</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={policiesDraft.returnPolicyDays}
                        onChange={(e) =>
                          setPoliciesDraft((prev) => ({
                            ...prev,
                            returnPolicyDays: Number(e.target.value),
                          }))
                        }
                        className="w-16 px-2 py-1 border border-[#E8E2D6] rounded-lg text-center font-mono text-[#18231C]"
                      />
                    </label>
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={() => onOpenPolicies('shipping')}
                        className="text-[11px] text-[#2D5A46] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPoliciesDraft((prev) => ({
                          ...prev,
                          shippingAndReturnsPolicyText:
                            DEFAULT_SITE_SETTINGS.shippingAndReturnsPolicyText,
                          returnPolicyDays: DEFAULT_SITE_SETTINGS.returnPolicyDays,
                        }))
                      }
                      className="text-[11px] text-[#526058] hover:text-[#18231C] underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={policiesDraft.shippingAndReturnsPolicyText}
                  onChange={(e) =>
                    setPoliciesDraft((prev) => ({
                      ...prev,
                      shippingAndReturnsPolicyText: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-sans-ui text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {/* Custom Commissions Policy */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#18231C]">
                    Custom Commissions &amp; Bespoke Carving Terms
                  </label>
                  <div className="flex items-center gap-2">
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={() => onOpenPolicies('custom')}
                        className="text-[11px] text-[#2D5A46] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPoliciesDraft((prev) => ({
                          ...prev,
                          customCommissionsPolicyText:
                            DEFAULT_SITE_SETTINGS.customCommissionsPolicyText,
                        }))
                      }
                      className="text-[11px] text-[#526058] hover:text-[#18231C] underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={policiesDraft.customCommissionsPolicyText}
                  onChange={(e) =>
                    setPoliciesDraft((prev) => ({
                      ...prev,
                      customCommissionsPolicyText: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-sans-ui text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {/* Authenticity & Ngāi Tahu Notice */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-[#18231C]">
                    Authenticity &amp; Ngāi Tahu Provenance Policy (Also Shown in Footer)
                  </label>
                  <div className="flex items-center gap-2">
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={() => onOpenPolicies('authenticity')}
                        className="text-[11px] text-[#2D5A46] hover:underline cursor-pointer"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPoliciesDraft((prev) => ({
                          ...prev,
                          authenticityPolicyText: DEFAULT_SITE_SETTINGS.authenticityPolicyText,
                        }))
                      }
                      className="text-[11px] text-[#526058] hover:text-[#18231C] underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={policiesDraft.authenticityPolicyText}
                  onChange={(e) =>
                    setPoliciesDraft((prev) => ({
                      ...prev,
                      authenticityPolicyText: e.target.value,
                    }))
                  }
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-sans-ui text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D6] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-[#526058]">
                {settings.legalNoticeUpdatedAt ? (
                  <span>
                    Last updated in SQLite:{' '}
                    <strong className="text-[#18231C]">
                      {new Date(settings.legalNoticeUpdatedAt).toLocaleString('en-NZ')}
                    </strong>
                  </span>
                ) : (
                  <span>Stored in SQLite table <code className="font-mono">site_settings</code></span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {policiesSavedToast && (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Legal Policies Saved to SQLite
                  </span>
                )}
                <button
                  type="submit"
                  disabled={policiesSaving}
                  className="py-2 px-4 bg-[#1B382B] text-white rounded-xl text-xs font-semibold hover:bg-[#2D5A46] transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {policiesSaving ? 'Saving to Database...' : 'Save Legal Policies to Database'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB: ADMIN-ONLY STRIPE PAYMENT & WEBHOOK SETTINGS */}
      {activeTab === 'payments' && (
        <div className="space-y-6 max-w-4xl text-xs">
          {/* Security & Webhook Status Header */}
          <div className="bg-[#F7F9F8] border border-[#D8E2DC] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[#18231C]">
              <Lock className="w-4 h-4 text-[#2D5A46] shrink-0" />
              <span>
                <strong>PCI SAQ A Security:</strong> Secret keys (
                <code className="font-mono text-[11px] bg-white px-1 rounded border border-[#E8E2D6]">
                  sk_...
                </code>
                ) and webhook signing secrets (
                <code className="font-mono text-[11px] bg-white px-1 rounded border border-[#E8E2D6]">
                  whsec_...
                </code>
                ) are stored strictly server-side in SQLite and never sent to storefront visitors.
              </span>
            </div>
            {paymentSavedToast && (
              <span className="inline-flex items-center gap-1.5 text-[#2D5A46] font-bold bg-white px-3 py-1 rounded-full border border-[#2D5A46]/20 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Payment Settings Saved
              </span>
            )}
          </div>

          {paymentError && (
            <div className="p-3.5 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] font-medium">
              {paymentError}
            </div>
          )}

          <form onSubmit={handleSavePaymentSettings} className="space-y-6">
            {/* Cash on Pickup (Studio Collection) */}
            <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-[#1B382B]" />
                    Cash on Pickup (Napier Studio Collection)
                  </h3>
                  <p className="text-[#526058] mt-0.5">
                    Allow customers to reserve taonga online, skip courier fees ($0.00 shipping), and pay cash or studio EFTPOS upon collection.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="font-semibold text-[#18231C]">
                    {cashOnPickupEnabledDraft ? 'Cash on Pickup Enabled' : 'Cash on Pickup Disabled'}
                  </span>
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={cashOnPickupEnabledDraft}
                      onChange={(e) => setCashOnPickupEnabledDraft(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-[#D1C7B7] rounded-full peer peer-checked:bg-[#1B382B] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                  </div>
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#2D5A46] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-[#18231C]">Studio Collection Address</div>
                    <div className="text-[#526058]">{settings.workshopAddress}</div>
                  </div>
                </div>
                <span className="text-[11px] text-[#526058]">
                  Edit workshop address in Site &amp; Auth Settings
                </span>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="cash-pickup-instructions" className="font-semibold text-[#18231C] block">
                  Customer Pickup Instructions &amp; Hours
                </label>
                <textarea
                  id="cash-pickup-instructions"
                  rows={3}
                  value={cashOnPickupInstructionsDraft}
                  onChange={(e) => setCashOnPickupInstructionsDraft(e.target.value)}
                  placeholder="Collect directly from Jesse's Napier studio by arrangement. Exact cash or studio EFTPOS is settled when picking up your taonga."
                  className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                />
                <p className="text-[11px] text-[#7D8B82]">
                  Shown at checkout, on order confirmation screens, and inside Cash on Pickup confirmation emails.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="px-5 py-2 bg-[#1B382B] hover:bg-[#2D5A46] text-white rounded-xl font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#7FA892]" />
                  <span>{paymentSaving ? 'Saving...' : 'Save Payment Modes'}</span>
                </button>
              </div>
            </div>

            {/* Stripe Enable & Environment Mode */}
            <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#1B382B]" />
                    Stripe Checkout Gateway (NZD)
                  </h3>
                  <p className="text-[#526058] mt-0.5">
                    Configure Stripe Payment Element keys and transaction statement descriptors.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="font-semibold text-[#18231C]">
                    {stripeEnabledDraft ? 'Stripe Enabled' : 'Stripe Paused'}
                  </span>
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={stripeEnabledDraft}
                      onChange={(e) => setStripeEnabledDraft(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-[#D1C7B7] rounded-full peer peer-checked:bg-[#1B382B] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                  </div>
                </label>
              </div>

              {paymentLoading ? (
                <div className="py-8 text-center text-[#526058]">Loading secure key status...</div>
              ) : (
                <div className="space-y-5">
                  {/* Mode Switch & Statement Descriptor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[#18231C] block">
                        Stripe Environment Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF9F6] rounded-xl border border-[#E8E2D6]">
                        <button
                          type="button"
                          onClick={() => setStripeModeDraft('test')}
                          className={`py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                            stripeModeDraft === 'test'
                              ? 'bg-[#C29B38] text-white shadow-xs'
                              : 'text-[#526058] hover:text-[#18231C]'
                          }`}
                        >
                          Test Mode (pk_test / sk_test)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStripeModeDraft('live')}
                          className={`py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                            stripeModeDraft === 'live'
                              ? 'bg-[#1B382B] text-white shadow-xs'
                              : 'text-[#526058] hover:text-[#18231C]'
                          }`}
                        >
                          Live Mode (pk_live / sk_live)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="stripe-descriptor" className="font-semibold text-[#18231C] block">
                        Bank Statement Descriptor (max 22 chars)
                      </label>
                      <input
                        id="stripe-descriptor"
                        type="text"
                        maxLength={22}
                        value={statementDescriptorDraft}
                        onChange={(e) => setStatementDescriptorDraft(e.target.value)}
                        placeholder="POUNAMU ATELIER"
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono uppercase focus:outline-none focus:border-[#1B382B]"
                      />
                    </div>
                  </div>

                  {/* Publishable Key */}
                  <div className="space-y-1.5">
                    <label htmlFor="stripe-pk" className="font-semibold text-[#18231C] flex items-center justify-between">
                      <span>Stripe Publishable Key</span>
                      <span className="text-[11px] font-mono text-[#526058]">
                        {publishableKeyDraft ? 'Public key set' : 'Required for Stripe Elements'}
                      </span>
                    </label>
                    <input
                      id="stripe-pk"
                      type="text"
                      value={publishableKeyDraft}
                      onChange={(e) => setPublishableKeyDraft(e.target.value)}
                      placeholder={stripeModeDraft === 'live' ? 'pk_live_...' : 'pk_test_...'}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>

                  {/* Secret Key (Write-only) */}
                  <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]/70 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="stripe-sk" className="font-bold text-[#18231C] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#1B382B]" />
                        Stripe Secret Key (Server-Side Only)
                      </label>
                      <div className="flex items-center gap-2">
                        {paymentView?.hasSecretKey ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#2D5A46]/15 text-[#2D5A46] font-mono text-[10px] font-bold">
                            Configured ({paymentView.secretSource}): {paymentView.secretKeyMasked}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#C29B38]/15 text-[#9A7820] font-mono text-[10px] font-bold">
                            Not Configured
                          </span>
                        )}
                        {paymentView?.secretSource === 'database' && (
                          <button
                            type="button"
                            onClick={() => handleClearSecret('secret')}
                            className="text-[11px] text-[#A63A2A] hover:underline cursor-pointer"
                          >
                            Clear stored key
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      id="stripe-sk"
                      type="password"
                      autoComplete="new-password"
                      value={secretKeyInput}
                      onChange={(e) => setSecretKeyInput(e.target.value)}
                      placeholder={
                        paymentView?.hasSecretKey
                          ? `Leave blank to keep ${paymentView.secretKeyMasked}, or paste new sk_...`
                          : stripeModeDraft === 'live'
                          ? 'sk_live_...'
                          : 'sk_test_...'
                      }
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white font-mono focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>

                  {/* Webhook Signing Secret (Write-only) */}
                  <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]/70 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="stripe-whsec" className="font-bold text-[#18231C] flex items-center gap-1.5">
                        <Webhook className="w-3.5 h-3.5 text-[#1B382B]" />
                        Stripe Webhook Signing Secret
                      </label>
                      <div className="flex items-center gap-2">
                        {paymentView?.hasWebhookSecret ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#2D5A46]/15 text-[#2D5A46] font-mono text-[10px] font-bold">
                            Configured ({paymentView.webhookSource}): {paymentView.webhookSecretMasked}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#C29B38]/15 text-[#9A7820] font-mono text-[10px] font-bold">
                            Not Configured
                          </span>
                        )}
                        {paymentView?.webhookSource === 'database' && (
                          <button
                            type="button"
                            onClick={() => handleClearSecret('webhook')}
                            className="text-[11px] text-[#A63A2A] hover:underline cursor-pointer"
                          >
                            Clear stored secret
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      id="stripe-whsec"
                      type="password"
                      autoComplete="new-password"
                      value={webhookSecretInput}
                      onChange={(e) => setWebhookSecretInput(e.target.value)}
                      placeholder={
                        paymentView?.hasWebhookSecret
                          ? `Leave blank to keep ${paymentView.webhookSecretMasked}, or paste new whsec_...`
                          : 'whsec_...'
                      }
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white font-mono focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>

                  {/* Actions: Save & Test */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={testingStripe}
                      onClick={handleTestStripeConnection}
                      className="px-4 py-2.5 border border-[#1B382B] text-[#1B382B] hover:bg-[#1B382B] hover:text-white rounded-xl font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingStripe ? 'animate-spin' : ''}`} />
                      <span>{testingStripe ? 'Testing Stripe API...' : 'Test Stripe Connection'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={paymentSaving}
                      className="px-5 py-2.5 bg-[#1B382B] hover:bg-[#2D5A46] text-white rounded-xl font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#7FA892]" />
                      <span>{paymentSaving ? 'Saving...' : 'Save Payment Settings'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border font-medium ${
                        testResult.ok
                          ? 'bg-[#F7F9F8] border-[#2D5A46]/30 text-[#2D5A46]'
                          : 'bg-[#A63A2A]/10 border-[#A63A2A]/30 text-[#A63A2A]'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Webhook Endpoint Instructions Card */}
            <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-4 shadow-xs">
              <div className="border-b border-[#E8E2D6] pb-3">
                <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-[#1B382B]" />
                  Webhook Endpoint Configuration
                </h3>
                <p className="text-[#526058] mt-0.5">
                  Register this endpoint URL in your Stripe Dashboard (Developers → Webhooks) or forward locally with Stripe CLI so charges, stock deductions, and refunds sync automatically.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#18231C]">Endpoint URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E8E2D6] font-mono text-[#1B382B] overflow-x-auto">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/api/stripe/webhook`
                      : '/api/stripe/webhook'}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/api/stripe/webhook`
                          : '/api/stripe/webhook';
                      navigator.clipboard?.writeText(url);
                      setWebhookCopied(true);
                      setTimeout(() => setWebhookCopied(false), 2500);
                    }}
                    className="px-3.5 py-2.5 border border-[#E8E2D6] rounded-lg hover:bg-[#FAF9F6] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {webhookCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#2D5A46]" />
                        <span className="text-[#2D5A46]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-1.5">
                  <div className="font-bold text-[#18231C]">Subscribed Events to Enable</div>
                  <ul className="font-mono text-[11px] text-[#2D5A46] space-y-1">
                    <li>• payment_intent.succeeded</li>
                    <li>• payment_intent.payment_failed</li>
                    <li>• payment_intent.canceled</li>
                    <li>• charge.refunded</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] space-y-1.5">
                  <div className="font-bold text-[#18231C]">Local Testing with Stripe CLI</div>
                  <code className="block font-mono text-[11px] text-[#526058] break-all">
                    stripe listen --forward-to localhost:3000/api/stripe/webhook
                  </code>
                  <p className="text-[11px] text-[#526058]">
                    Paste the printed <code className="font-mono">whsec_...</code> secret above and save.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: ADMIN-ONLY GLOBAL SEO & OPEN GRAPH SETTINGS */}
      {activeTab === 'seo' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpdateSettings({
              ...settings,
              seoTitle: seoDraft.seoTitle.trim(),
              seoDescription: seoDraft.seoDescription.trim(),
              seoKeywords: seoDraft.seoKeywords.trim(),
              ogTitle: seoDraft.ogTitle.trim(),
              ogDescription: seoDraft.ogDescription.trim(),
              ogImageUrl: seoDraft.ogImageUrl.trim() || undefined,
              ogSiteName: seoDraft.ogSiteName.trim() || settings.siteName,
              twitterCardType: seoDraft.twitterCardType,
              canonicalUrl: seoDraft.canonicalUrl.trim(),
              allowSearchIndexing: seoDraft.allowSearchIndexing,
            });
            setSeoSavedToast(true);
            setTimeout(() => setSeoSavedToast(false), 3500);
          }}
          className="space-y-6 max-w-5xl"
        >
          {/* Role & Live Sync Notice */}
          <div className="bg-[#F7F9F8] border border-[#D8E2DC] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[#18231C]">
              <ShieldCheck className="w-4 h-4 text-[#2D5A46] shrink-0" />
              <span>
                <strong>Admin-Only SEO Control:</strong> Changes update live{' '}
                <code className="px-1 py-0.5 rounded bg-white border border-[#E8E2D6] font-mono text-[11px]">
                  &lt;head&gt;
                </code>{' '}
                meta tags, Open Graph cards, Schema.org JSON-LD, and persist in SQLite.
              </span>
            </div>
            {seoSavedToast && (
              <span className="inline-flex items-center gap-1.5 text-[#2D5A46] font-bold bg-white px-3 py-1 rounded-full border border-[#2D5A46]/20 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                SEO Meta Tags Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Search Engine Meta + Open Graph Editors */}
            <div className="xl:col-span-7 space-y-6">
              {/* Search Engine Optimization (Meta Title, Description, Keywords, Robots) */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs">
                <div className="border-b border-[#E8E2D6] pb-3.5">
                  <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#1B382B]" />
                    Global Search Engine Meta Tags
                  </h3>
                  <p className="text-xs text-[#526058] mt-0.5">
                    Configure the browser tab title, homepage meta description, and crawler indexing directives.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Homepage Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="seo-title" className="font-semibold text-[#18231C]">
                        Homepage Title (<span className="font-mono text-[11px]">&lt;title&gt;</span>)
                      </label>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          seoDraft.seoTitle.length >= 30 && seoDraft.seoTitle.length <= 60
                            ? 'text-[#2D5A46]'
                            : 'text-[#C29B38]'
                        }`}
                      >
                        {seoDraft.seoTitle.length} / 60 chars
                      </span>
                    </div>
                    <input
                      id="seo-title"
                      type="text"
                      required
                      value={seoDraft.seoTitle}
                      onChange={(e) => setSeoDraft({ ...seoDraft, seoTitle: e.target.value })}
                      placeholder="Pounamu Atelier — Hand-Carved NZ Greenstone by Jesse"
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                    <p className="text-[11px] text-[#7D8B82]">
                      Recommended: 30–60 characters so the full title appears in search results.
                    </p>
                  </div>

                  {/* Homepage Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="seo-description" className="font-semibold text-[#18231C]">
                        Homepage Meta Description (<span className="font-mono text-[11px]">meta[name="description"]</span>)
                      </label>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          seoDraft.seoDescription.length >= 120 && seoDraft.seoDescription.length <= 160
                            ? 'text-[#2D5A46]'
                            : 'text-[#C29B38]'
                        }`}
                      >
                        {seoDraft.seoDescription.length} / 160 chars
                      </span>
                    </div>
                    <textarea
                      id="seo-description"
                      rows={3}
                      required
                      value={seoDraft.seoDescription}
                      onChange={(e) => setSeoDraft({ ...seoDraft, seoDescription: e.target.value })}
                      placeholder="Summarize your pounamu studio, Ngāi Tahu provenance, and custom carving offering..."
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                    <p className="text-[11px] text-[#7D8B82]">
                      Recommended: 120–160 characters for clean Google snippet display without truncation.
                    </p>
                  </div>

                  {/* Keywords & Canonical URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="seo-keywords" className="font-semibold text-[#18231C] block">
                        Meta Keywords
                      </label>
                      <input
                        id="seo-keywords"
                        type="text"
                        value={seoDraft.seoKeywords}
                        onChange={(e) => setSeoDraft({ ...seoDraft, seoKeywords: e.target.value })}
                        placeholder="New Zealand pounamu, greenstone, Ngāi Tahu"
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="seo-canonical" className="font-semibold text-[#18231C] block">
                        Canonical Base URL (optional)
                      </label>
                      <input
                        id="seo-canonical"
                        type="url"
                        value={seoDraft.canonicalUrl}
                        onChange={(e) => setSeoDraft({ ...seoDraft, canonicalUrl: e.target.value })}
                        placeholder={
                          typeof window !== 'undefined'
                            ? window.location.origin
                            : 'https://pounamuatelier.co.nz'
                        }
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg font-mono focus:outline-none focus:border-[#1B382B]"
                      />
                    </div>
                  </div>

                  {/* Search Indexing Toggle */}
                  <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#18231C]">Allow Search Engine Indexing</div>
                      <p className="text-[11px] text-[#526058]">
                        Sets <code className="font-mono">robots</code> to{' '}
                        <strong>{seoDraft.allowSearchIndexing ? 'index, follow' : 'noindex, nofollow'}</strong>.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={seoDraft.allowSearchIndexing}
                        onChange={(e) =>
                          setSeoDraft({ ...seoDraft, allowSearchIndexing: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-[#D1C7B7] peer-focus:outline-none rounded-full peer peer-checked:bg-[#1B382B] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4.5" />
                    </label>
                  </div>

                  {/* Automated XML Sitemap Control */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#18231C]">
                        Search Engine Sitemap (<code className="font-mono text-[11px]">public/sitemap.xml</code>)
                      </div>
                      <p className="text-[11px] text-[#526058]">
                        Automatically regenerated when active products, gallery pieces, or SEO settings change. Accessible at{' '}
                        <a
                          href="/sitemap.xml"
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono underline text-[#1B382B]"
                        >
                          /sitemap.xml
                        </a>
                        .
                      </p>
                      {sitemapNotice && (
                        <p className="text-[11px] font-semibold text-[#2D5A46] pt-0.5">
                          {sitemapNotice}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={sitemapRegenerating}
                      onClick={async () => {
                        setSitemapRegenerating(true);
                        setSitemapNotice(null);
                        try {
                          const res = await apiFetch<{
                            totalUrls: number;
                            activeProductCount: number;
                            galleryItemCount: number;
                          }>('/api/sitemap/regenerate', { method: 'POST' });
                          setSitemapNotice(
                            `Updated sitemap.xml (${res.totalUrls} URLs: ${res.activeProductCount} active products, ${res.galleryItemCount} gallery pieces).`
                          );
                        } catch (err) {
                          setSitemapNotice(
                            err instanceof Error ? err.message : 'Unable to regenerate sitemap.'
                          );
                        } finally {
                          setSitemapRegenerating(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-white border border-[#E8E2D6] hover:border-[#1B382B] text-[#18231C] rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${sitemapRegenerating ? 'animate-spin' : ''}`} />
                      <span>{sitemapRegenerating ? 'Regenerating...' : 'Regenerate Sitemap'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Open Graph & Social Card Settings */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs">
                <div className="border-b border-[#E8E2D6] pb-3.5">
                  <h3 className="font-display text-base font-bold text-[#18231C] flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[#1B382B]" />
                    Open Graph & Social Share Settings
                  </h3>
                  <p className="text-xs text-[#526058] mt-0.5">
                    Control how links look when shared on Facebook, Slack, Discord, WhatsApp, LinkedIn, and X.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* og:title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="og-title" className="font-semibold text-[#18231C]">
                        Open Graph Title (<span className="font-mono text-[11px]">og:title</span>)
                      </label>
                      <button
                        type="button"
                        onClick={() => setSeoDraft({ ...seoDraft, ogTitle: seoDraft.seoTitle })}
                        className="text-[11px] font-semibold text-[#1B382B] hover:underline cursor-pointer"
                      >
                        Copy from Homepage Title
                      </button>
                    </div>
                    <input
                      id="og-title"
                      type="text"
                      required
                      value={seoDraft.ogTitle}
                      onChange={(e) => setSeoDraft({ ...seoDraft, ogTitle: e.target.value })}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>

                  {/* og:description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="og-description" className="font-semibold text-[#18231C]">
                        Open Graph Description (<span className="font-mono text-[11px]">og:description</span>)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSeoDraft({ ...seoDraft, ogDescription: seoDraft.seoDescription })
                        }
                        className="text-[11px] font-semibold text-[#1B382B] hover:underline cursor-pointer"
                      >
                        Copy from Meta Description
                      </button>
                    </div>
                    <textarea
                      id="og-description"
                      rows={2}
                      required
                      value={seoDraft.ogDescription}
                      onChange={(e) => setSeoDraft({ ...seoDraft, ogDescription: e.target.value })}
                      className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="og-site-name" className="font-semibold text-[#18231C] block">
                        Site Name (<span className="font-mono text-[11px]">og:site_name</span>)
                      </label>
                      <input
                        id="og-site-name"
                        type="text"
                        value={seoDraft.ogSiteName}
                        onChange={(e) => setSeoDraft({ ...seoDraft, ogSiteName: e.target.value })}
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg focus:outline-none focus:border-[#1B382B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="twitter-card" className="font-semibold text-[#18231C] block">
                        Twitter / X Card Format
                      </label>
                      <select
                        id="twitter-card"
                        value={seoDraft.twitterCardType}
                        onChange={(e) =>
                          setSeoDraft({
                            ...seoDraft,
                            twitterCardType: e.target.value as 'summary_large_image' | 'summary',
                          })
                        }
                        className="w-full p-2.5 border border-[#E8E2D6] rounded-lg bg-white focus:outline-none focus:border-[#1B382B]"
                      >
                        <option value="summary_large_image">Large Banner Image (summary_large_image)</option>
                        <option value="summary">Compact Square Thumbnail (summary)</option>
                      </select>
                    </div>
                  </div>

                  {/* OG Preview Image Upload & Presets */}
                  <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#F7F5F0]/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label htmlFor="og-image-url" className="font-bold text-[#18231C]">
                        Open Graph Preview Image (<span className="font-mono text-[11px]">og:image</span>)
                      </label>
                      {seoDraft.ogImageUrl && (
                        <button
                          type="button"
                          onClick={() => setSeoDraft({ ...seoDraft, ogImageUrl: '' })}
                          className="text-[11px] text-[#A63A2A] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#1B382B] text-[#1B382B] hover:bg-[#1B382B] hover:text-white transition-colors rounded-lg text-xs font-semibold cursor-pointer bg-white">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Social Banner</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (typeof ev.target?.result === 'string') {
                                  setSeoDraft((prev) => ({
                                    ...prev,
                                    ogImageUrl: ev.target!.result as string,
                                  }));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setSeoDraft({
                            ...seoDraft,
                            ogImageUrl: '/src/assets/images/jesse_carving_hero_1794557997280.jpg',
                          })
                        }
                        className="px-2.5 py-2 rounded-lg border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-[11px] font-medium text-[#18231C] cursor-pointer"
                      >
                        Carving Hero
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSeoDraft({
                            ...seoDraft,
                            ogImageUrl: '/src/assets/images/jesse_studio_portrait_1794557999104.jpg',
                          })
                        }
                        className="px-2.5 py-2 rounded-lg border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-[11px] font-medium text-[#18231C] cursor-pointer"
                      >
                        Studio Portrait
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSeoDraft({
                            ...seoDraft,
                            ogImageUrl: '/src/assets/images/product_toki_pounamu_1794468031889.jpg',
                          })
                        }
                        className="px-2.5 py-2 rounded-lg border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-[11px] font-medium text-[#18231C] cursor-pointer"
                      >
                        Toki Pendant
                      </button>
                    </div>

                    <input
                      id="og-image-url"
                      type="text"
                      value={seoDraft.ogImageUrl}
                      onChange={(e) => setSeoDraft({ ...seoDraft, ogImageUrl: e.target.value })}
                      placeholder="https://example.com/og-preview.jpg or /src/assets/images/..."
                      className="w-full text-xs p-2.5 border border-[#E8E2D6] rounded-lg bg-white font-mono focus:outline-none focus:border-[#1B382B]"
                    />
                    <p className="text-[11px] text-[#7D8B82]">
                      Recommended aspect ratio: 1200×630 px (1.91:1 landscape) for rich social link previews.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Search & Social Card Previews + Save Controls */}
            <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-24">
              {/* Google Search Snippet Live Preview */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A46] flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Search Result Preview
                  </span>
                  <span className="text-[10px] font-mono text-[#7D8B82]">
                    {seoDraft.allowSearchIndexing ? 'INDEXABLE' : 'NOINDEX'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[#526058]">
                    <div className="w-5 h-5 rounded-full bg-[#1B382B] text-white flex items-center justify-center text-[9px] font-bold overflow-hidden shrink-0">
                      {settings.faviconUrl ? (
                        <img
                          src={settings.faviconUrl}
                          alt="Favicon"
                          className="w-full h-full object-contain bg-white"
                        />
                      ) : (
                        'P'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#18231C] truncate">
                        {seoDraft.ogSiteName || settings.siteName}
                      </div>
                      <div className="text-[10px] text-[#526058] truncate font-mono">
                        {seoDraft.canonicalUrl ||
                          (typeof window !== 'undefined'
                            ? window.location.origin
                            : 'https://pounamuatelier.co.nz')}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#1A4B8C] leading-snug line-clamp-2">
                    {seoDraft.seoTitle || settings.siteName}
                  </div>
                  <p className="text-xs text-[#526058] leading-relaxed line-clamp-3">
                    {seoDraft.seoDescription}
                  </p>
                </div>
              </div>

              {/* Open Graph Social Card Live Preview */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A46] flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    Open Graph Share Card Preview
                  </span>
                  <span className="text-[10px] font-mono text-[#7D8B82]">
                    {seoDraft.twitterCardType}
                  </span>
                </div>

                {seoDraft.twitterCardType === 'summary_large_image' ? (
                  <div className="rounded-xl border border-[#E8E2D6] overflow-hidden bg-[#FAF9F6]">
                    <div className="aspect-[1.91/1] w-full bg-[#EBE7DF] flex items-center justify-center overflow-hidden">
                      {seoDraft.ogImageUrl ? (
                        <img
                          src={seoDraft.ogImageUrl}
                          alt="Open Graph preview banner"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-[#7D8B82] text-xs space-y-1">
                          <ImageIcon className="w-6 h-6 mx-auto opacity-40" />
                          <span>No og:image set</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3.5 space-y-1 border-t border-[#E8E2D6] bg-white">
                      <div className="text-[10px] uppercase tracking-wider text-[#7D8B82] font-mono truncate">
                        {(seoDraft.canonicalUrl ||
                          (typeof window !== 'undefined'
                            ? window.location.hostname
                            : 'pounamuatelier.co.nz')
                        ).replace(/^https?:\/\//, '')}
                      </div>
                      <div className="font-display text-sm font-bold text-[#18231C] leading-snug line-clamp-2">
                        {seoDraft.ogTitle || seoDraft.seoTitle}
                      </div>
                      <p className="text-[11px] text-[#526058] line-clamp-2 leading-relaxed">
                        {seoDraft.ogDescription || seoDraft.seoDescription}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E8E2D6] overflow-hidden bg-white flex items-stretch">
                    <div className="w-24 h-24 shrink-0 bg-[#EBE7DF] flex items-center justify-center overflow-hidden border-r border-[#E8E2D6]">
                      {seoDraft.ogImageUrl ? (
                        <img
                          src={seoDraft.ogImageUrl}
                          alt="Open Graph compact thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#7D8B82]" />
                      )}
                    </div>
                    <div className="p-3 min-w-0 flex-1 space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-[#7D8B82] font-mono truncate">
                        {seoDraft.ogSiteName || settings.siteName}
                      </div>
                      <div className="font-display text-xs font-bold text-[#18231C] truncate">
                        {seoDraft.ogTitle || seoDraft.seoTitle}
                      </div>
                      <p className="text-[11px] text-[#526058] line-clamp-2 leading-snug">
                        {seoDraft.ogDescription || seoDraft.seoDescription}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Save / Reset Action Card */}
              <div className="bg-white rounded-2xl border border-[#E8E2D6] p-5 space-y-3 shadow-xs">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#1B382B] hover:bg-[#2D5A46] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#7FA892]" />
                  <span>Save SEO & Open Graph Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSeoDraft({
                      seoTitle: DEFAULT_SITE_SETTINGS.seoTitle,
                      seoDescription: DEFAULT_SITE_SETTINGS.seoDescription,
                      seoKeywords: DEFAULT_SITE_SETTINGS.seoKeywords ?? '',
                      ogTitle: DEFAULT_SITE_SETTINGS.ogTitle,
                      ogDescription: DEFAULT_SITE_SETTINGS.ogDescription,
                      ogImageUrl: DEFAULT_SITE_SETTINGS.ogImageUrl || '',
                      ogSiteName: DEFAULT_SITE_SETTINGS.ogSiteName || settings.siteName,
                      twitterCardType: DEFAULT_SITE_SETTINGS.twitterCardType,
                      canonicalUrl: DEFAULT_SITE_SETTINGS.canonicalUrl || '',
                      allowSearchIndexing: DEFAULT_SITE_SETTINGS.allowSearchIndexing,
                    })
                  }
                  className="w-full py-2 px-4 border border-[#E8E2D6] hover:bg-[#FAF9F6] text-[#526058] rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Recommended Defaults</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 9: SITEMAP & PER-PAGE SEO AUDIT */}
      {activeTab === 'seo-audit' && (
        <SeoAuditSection
          settings={settings}
          products={products}
          galleryItems={galleryItems}
          pageSeoMetadata={pageSeoMetadata}
          onPageSeoChange={(nextList, updatedSettings) => {
            onPageSeoChange?.(nextList, updatedSettings);
          }}
        />
      )}
    </div>
  );
};
