import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Layers,
  Ruler,
  FileCheck,
  ArrowRight,
  Upload,
  AlertCircle,
  Search,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import {
  CustomCommission,
  CustomInspirationTemplate,
  CustomPricingConfig,
  DesignMotif,
  StoneVariety,
  UserProfile,
} from '../types';
import { calculateCustomPieceCents, formatNZD } from '../utils/pricing';

export interface CreateCommissionPayload extends CustomCommission {
  mode: 'configurator' | 'direct-quote';
  includePauaEye?: boolean;
  includeHardwoodBox?: boolean;
}

interface CustomAtelierProps {
  commissions: CustomCommission[];
  customPricing: CustomPricingConfig;
  currentUser: UserProfile | null;
  isAdmin?: boolean;
  inspirationTemplate?: CustomInspirationTemplate | null;
  onClearInspiration?: () => void;
  onAddCommission: (commission: CreateCommissionPayload) => Promise<CustomCommission>;
  onSendMessage: (
    commissionId: string,
    text: string,
    sender: 'customer' | 'carver'
  ) => Promise<void>;
  onAcceptQuote: (commissionId: string, email: string) => Promise<void>;
  onLookupCommission?: (ref: string, email: string) => Promise<CustomCommission | null>;
}

const DEFAULT_CORDS = [
  'Traditional 4-Plait Black Waxed Cord',
  'Earthy Desert Tan Braided Cord',
  'Forest Olive Green Plait Cord',
  'Dual-Tone Black & Tan Bound Cord',
];

const DEFAULT_BINDINGS = [
  'Traditional Cross-Lash with Bone Toggle',
  'Classic Waxed Whipping Knot',
  'Sliding Adjustable Fisherman Knot',
];

export const CustomAtelier: React.FC<CustomAtelierProps> = ({
  commissions,
  customPricing,
  currentUser,
  isAdmin = false,
  inspirationTemplate = null,
  onClearInspiration,
  onAddCommission,
  onSendMessage,
  onAcceptQuote,
  onLookupCommission,
}) => {
  const [activeTab, setActiveTab] = useState<'configurator' | 'quotes' | 'my-requests'>('configurator');

  const stoneChoices = useMemo(
    () =>
      customPricing.stoneOptions && customPricing.stoneOptions.length > 0
        ? customPricing.stoneOptions
        : Object.entries(customPricing.materialBaseCents || {}).map(([name, baseCents]) => ({
            name,
            description: 'Aotearoa Greenstone',
            baseCents,
          })),
    [customPricing.stoneOptions, customPricing.materialBaseCents]
  );

  const designChoices = useMemo(
    () =>
      customPricing.designOptions && customPricing.designOptions.length > 0
        ? customPricing.designOptions
        : Object.entries(customPricing.designMultiplier || {}).map(([name, multiplier]) => ({
            name,
            label: name,
            meaning: 'Traditional Carving',
            multiplier,
            previewImageUrl: '/src/assets/images/modern_hero_pounamu_1794472502033.jpg',
          })),
    [customPricing.designOptions, customPricing.designMultiplier]
  );

  const sizeChoices = useMemo(
    () =>
      customPricing.sizeOptions && customPricing.sizeOptions.length > 0
        ? customPricing.sizeOptions
        : [
            { mm: 45, label: 'Delicate Everyday (45mm)', multiplier: customPricing.sizeMultiplier.small45 },
            { mm: 65, label: 'Traditional Classic (65mm)', multiplier: customPricing.sizeMultiplier.medium65 },
            { mm: 85, label: 'Commanding Statement (85mm)', multiplier: customPricing.sizeMultiplier.large85 },
          ],
    [customPricing.sizeOptions, customPricing.sizeMultiplier]
  );

  const cordChoices = useMemo(
    () =>
      customPricing.cordOptions && customPricing.cordOptions.length > 0
        ? customPricing.cordOptions
        : DEFAULT_CORDS,
    [customPricing.cordOptions]
  );

  const bindingChoices = useMemo(
    () =>
      customPricing.bindingOptions && customPricing.bindingOptions.length > 0
        ? customPricing.bindingOptions
        : DEFAULT_BINDINGS,
    [customPricing.bindingOptions]
  );

  // Configurator state
  const [selectedMaterial, setSelectedMaterial] = useState<StoneVariety>(
    stoneChoices[0]?.name || 'Kawakawa'
  );
  const [selectedDesign, setSelectedDesign] = useState<DesignMotif>(
    designChoices[0]?.name || 'Toki'
  );
  const [selectedSizeMm, setSelectedSizeMm] = useState<number>(sizeChoices[1]?.mm || sizeChoices[0]?.mm || 65);
  const [selectedCord, setSelectedCord] = useState<string>(cordChoices[0]);
  const [selectedBinding, setSelectedBinding] = useState<string>(bindingChoices[0]);
  const [includePauaEye, setIncludePauaEye] = useState<boolean>(false);
  const [includeHardwoodBox, setIncludeHardwoodBox] = useState<boolean>(true);
  const [configuratorNotes, setConfiguratorNotes] = useState<string>('');

  // Customer Details & Quote Form State
  const [quoteName, setQuoteName] = useState<string>(
    currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : ''
  );
  const [quoteEmail, setQuoteEmail] = useState<string>(currentUser?.email || '');
  const [quotePhone, setQuotePhone] = useState<string>('');
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [quoteBudget, setQuoteBudget] = useState<string>('$500 - $800 NZD');
  const [referenceImg, setReferenceImg] = useState<string>('');
  const [rightsConfirmed, setRightsConfirmed] = useState<boolean>(false);

  // Submission & Feedback State
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active chat thread & lookup state
  const [selectedCommissionId, setSelectedCommissionId] = useState<string>(
    commissions[0]?.id || ''
  );
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [senderMode, setSenderMode] = useState<'customer' | 'carver'>(
    isAdmin ? 'carver' : 'customer'
  );
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Guest Commission Lookup State
  const [lookupRef, setLookupRef] = useState<string>('');
  const [lookupEmail, setLookupEmail] = useState<string>(currentUser?.email || '');
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser) {
      const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim();
      setQuoteName((prev) => prev || fullName);
      setQuoteEmail((prev) => prev || currentUser.email);
      setLookupEmail((prev) => prev || currentUser.email);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isAdmin) {
      setSenderMode('customer');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!inspirationTemplate) return;
    setSelectedMaterial(inspirationTemplate.material);
    setSelectedDesign(inspirationTemplate.designType);
    if (inspirationTemplate.imageUrl) {
      setReferenceImg(inspirationTemplate.imageUrl);
    }
    const note = `Inspired by past carving: "${inspirationTemplate.title}"${
      inspirationTemplate.authenticityCode ? ` (Ref: ${inspirationTemplate.authenticityCode})` : ''
    }${inspirationTemplate.originRiver ? ` · Origin: ${inspirationTemplate.originRiver}` : ''}.`;
    setConfiguratorNotes(note);
    setQuoteNotes(note);
    setActiveTab('configurator');
  }, [inspirationTemplate]);

  useEffect(() => {
    if (inspirationTemplate) return;
    if (stoneChoices.length > 0 && !stoneChoices.some((s) => s.name === selectedMaterial)) {
      setSelectedMaterial(stoneChoices[0].name);
    }
    if (designChoices.length > 0 && !designChoices.some((d) => d.name === selectedDesign)) {
      setSelectedDesign(designChoices[0].name);
    }
    if (sizeChoices.length > 0 && !sizeChoices.some((sz) => sz.mm === selectedSizeMm)) {
      setSelectedSizeMm(sizeChoices[0].mm);
    }
    if (cordChoices.length > 0 && !cordChoices.includes(selectedCord)) {
      setSelectedCord(cordChoices[0]);
    }
    if (bindingChoices.length > 0 && !bindingChoices.includes(selectedBinding)) {
      setSelectedBinding(bindingChoices[0]);
    }
  }, [
    customPricing,
    inspirationTemplate,
    selectedMaterial,
    selectedDesign,
    selectedSizeMm,
    selectedCord,
    selectedBinding,
    stoneChoices,
    designChoices,
    sizeChoices,
    cordChoices,
    bindingChoices,
  ]);

  useEffect(() => {
    if (
      commissions.length > 0 &&
      (!selectedCommissionId || !commissions.some((c) => c.id === selectedCommissionId))
    ) {
      setSelectedCommissionId(commissions[0].id);
    }
  }, [commissions, selectedCommissionId]);

  // Dynamic price calculation driven from SQLite customPricing config
  const calculatedCents = calculateCustomPieceCents(customPricing, {
    material: selectedMaterial,
    design: selectedDesign,
    sizeMm: selectedSizeMm,
    includePauaEye,
    includeHardwoodBox,
  });

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a PNG, JPG, or WebP image file.');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setFormError('Reference image must be 2.5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setReferenceImg(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateFromConfigurator = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!quoteName.trim() || !quoteEmail.trim()) {
      setFormError('Please provide your full name and email address to submit this custom carving to Jesse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCommissionPayload = {
        id: `comm-${Date.now()}`,
        referenceNumber: `CC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        customerName: quoteName.trim(),
        customerEmail: quoteEmail.trim(),
        customerPhone: quotePhone.trim(),
        material: selectedMaterial,
        designType: selectedDesign,
        pendantSizeMm: selectedSizeMm,
        cordStyle: selectedCord,
        bindingStyle: selectedBinding,
        specialNotes: `Configured Custom Piece.${
          includePauaEye ? ' Includes Pāua inlay.' : ''
        }${includeHardwoodBox ? ' Includes Rimu Presentation Box.' : ''}${
          configuratorNotes.trim() ? ` Notes: ${configuratorNotes.trim()}` : ''
        }`,
        budgetRange: formatNZD(calculatedCents),
        referenceImageUrl: referenceImg || undefined,
        status: 'REQUESTED',
        quoteAmountCents: calculatedCents,
        depositAmountCents: Math.round(calculatedCents * 0.5),
        leadTimeWeeks: 3,
        messages: [
          {
            id: `m-${Date.now()}`,
            sender: 'customer',
            senderName: quoteName.trim(),
            text: `Kia ora Jesse, I have configured a custom ${selectedMaterial} ${selectedDesign} (${selectedSizeMm}mm) with ${selectedCord}.${
              configuratorNotes.trim() ? ` ${configuratorNotes.trim()}` : ''
            }`,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        mode: 'configurator',
        includePauaEye,
        includeHardwoodBox,
      };

      const saved = await onAddCommission(payload);
      setSubmittedId(saved.referenceNumber);
      setSelectedCommissionId(saved.id);
      setConfiguratorNotes('');
      setActiveTab('my-requests');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit custom carving request right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDirectQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!quoteName.trim() || !quoteEmail.trim()) {
      setFormError('Please provide your name and email address.');
      return;
    }
    if (!quoteNotes.trim()) {
      setFormError('Please describe your design idea and carving notes for Jesse.');
      return;
    }
    if (!rightsConfirmed) {
      setFormError('Please confirm you have the right to request this custom carving before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCommissionPayload = {
        id: `comm-${Date.now()}`,
        referenceNumber: `CC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        customerName: quoteName.trim(),
        customerEmail: quoteEmail.trim(),
        customerPhone: quotePhone.trim(),
        material: selectedMaterial,
        designType: selectedDesign,
        pendantSizeMm: selectedSizeMm,
        cordStyle: selectedCord,
        bindingStyle: selectedBinding,
        specialNotes: quoteNotes.trim(),
        budgetRange: quoteBudget,
        referenceImageUrl: referenceImg || undefined,
        status: 'REQUESTED',
        messages: [
          {
            id: `m-${Date.now()}`,
            sender: 'customer',
            senderName: quoteName.trim(),
            text: quoteNotes.trim(),
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        mode: 'direct-quote',
      };

      const saved = await onAddCommission(payload);
      setSubmittedId(saved.referenceNumber);
      setSelectedCommissionId(saved.id);
      setQuoteNotes('');
      setRightsConfirmed(false);
      setActiveTab('my-requests');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit quote request right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedCommissionId) return;
    setFormError(null);
    setIsSendingChat(true);
    try {
      const effectiveSender = isAdmin && senderMode === 'carver' ? 'carver' : 'customer';
      await onSendMessage(selectedCommissionId, chatInput.trim(), effectiveSender);
      setChatInput('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLookupCommission || !lookupRef.trim() || !lookupEmail.trim()) return;
    setLookupMessage(null);
    setIsLookingUp(true);
    try {
      const found = await onLookupCommission(lookupRef.trim(), lookupEmail.trim());
      if (found) {
        setSelectedCommissionId(found.id);
        setLookupMessage(null);
      } else {
        setLookupMessage('No commission found matching that reference number and email.');
      }
    } catch (err) {
      setLookupMessage(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAcceptQuoteClick = async (commission: CustomCommission) => {
    setFormError(null);
    setAcceptingId(commission.id);
    try {
      await onAcceptQuote(commission.id, currentUser?.email || commission.customerEmail);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to accept quote.');
    } finally {
      setAcceptingId(null);
    }
  };

  const activeCommission = commissions.find((c) => c.id === selectedCommissionId) || commissions[0];

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-12 space-y-10 overflow-hidden">
      {/* Subtle Opaque Workshop Texture in Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] bg-cover bg-center"
        style={{
          backgroundImage: `url('/src/assets/images/jesse_carving_hero_1794557997280.jpg')`,
        }}
      />

      {/* Header section */}
      <div className="relative z-10 text-center space-y-3">
        <span className="text-xs uppercase tracking-[0.25em] font-sans-ui text-[#2D5A46] font-semibold">
          Bespoke Artisan Studio · Whakairo
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C]">
          Custom Carving Studio & Configurator
        </h1>
        <p className="text-[#526058] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Create a one-of-a-kind greenstone heirloom. Customize your stone grade, traditional motif shape, cord braiding, and size, or submit your own concept directly to carver Jesse.
        </p>

        {/* Glass Tab Switcher */}
        <div className="inline-flex p-1.5 glass-panel rounded-2xl mt-4 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveTab('configurator');
            }}
            className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'configurator'
                ? 'bg-[#1B382B] text-white shadow-sm'
                : 'text-[#526058] hover:text-[#18231C]'
            }`}
          >
            1. Visual Customizer
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveTab('quotes');
            }}
            className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'quotes'
                ? 'bg-[#1B382B] text-white shadow-sm'
                : 'text-[#526058] hover:text-[#18231C]'
            }`}
          >
            2. Request Direct Quote
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setActiveTab('my-requests');
            }}
            className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'my-requests'
                ? 'bg-[#1B382B] text-white shadow-sm'
                : 'text-[#526058] hover:text-[#18231C]'
            }`}
          >
            3. Active Commissions & Messages ({commissions.length})
          </button>
        </div>

        {/* Chosen Gallery Inspiration Banner */}
        {inspirationTemplate && (
          <div className="max-w-2xl mx-auto mt-4 p-3.5 rounded-2xl bg-white border border-[#1B382B]/25 shadow-xs flex items-center justify-between gap-4 text-left text-xs">
            <div className="flex items-center gap-3 min-w-0">
              {inspirationTemplate.imageUrl && (
                <img
                  src={inspirationTemplate.imageUrl}
                  alt={inspirationTemplate.title}
                  className="w-12 h-12 rounded-xl object-cover border border-[#E8E2D6] shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#2D5A46]">
                  Commissioning Inspired Piece
                </div>
                <div className="font-display font-bold text-[#18231C] truncate">
                  {inspirationTemplate.title}
                </div>
                <div className="text-[11px] text-[#526058] truncate">
                  {inspirationTemplate.material} · {inspirationTemplate.designType} pre-selected
                </div>
              </div>
            </div>
            {onClearInspiration && (
              <button
                type="button"
                onClick={onClearInspiration}
                className="px-3 py-1.5 border border-[#E8E2D6] rounded-lg text-[11px] font-semibold text-[#526058] hover:text-[#18231C] shrink-0 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline error / success banners */}
      {formError && (
        <div className="relative z-10 p-4 rounded-2xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#A63A2A] font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {submittedId && (
        <div className="relative z-10 p-4 glass-panel border border-[#2D5A46]/30 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-[#1B382B] shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2D5A46]" />
            <span>
              Commission <strong>#{submittedId}</strong> saved to the atelier database! Save this reference number to check status or message Jesse below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSubmittedId(null)}
            className="text-xs text-[#526058] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: VISUAL CONFIGURATOR */}
      {activeTab === 'configurator' && (
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Left Column */}
          <form
            onSubmit={handleCreateFromConfigurator}
            className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl"
          >
            {/* Step 1: Dynamic Material / Stone Types from SQLite */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C29B38]" />
                1. Select Greenstone / Material
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stoneChoices.map((stone) => (
                  <button
                    key={stone.name}
                    type="button"
                    onClick={() => setSelectedMaterial(stone.name)}
                    className={`p-3.5 text-left rounded-2xl border text-xs transition-all cursor-pointer ${
                      selectedMaterial === stone.name
                        ? 'border-[#1B382B] bg-[#1B382B]/10 font-bold text-[#1B382B] ring-1 ring-[#1B382B] shadow-xs'
                        : 'border-white/80 bg-white/60 hover:bg-white text-[#526058]'
                    }`}
                  >
                    <div className="font-semibold text-[#18231C]">{stone.name}</div>
                    <div className="text-[10px] text-[#526058] mt-0.5">{stone.description}</div>
                    <div className="text-[10px] font-mono text-[#2D5A46] mt-1 font-semibold">
                      From {formatNZD(stone.baseCents)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Dynamic Shape & Meaning from SQLite */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C29B38]" />
                2. Traditional Shape &amp; Meaning
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {designChoices.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setSelectedDesign(d.name)}
                    className={`p-3.5 text-left rounded-2xl border text-xs transition-all cursor-pointer ${
                      selectedDesign === d.name
                        ? 'border-[#1B382B] bg-[#1B382B]/10 font-bold text-[#1B382B] ring-1 ring-[#1B382B] shadow-xs'
                        : 'border-white/80 bg-white/60 hover:bg-white text-[#526058]'
                    }`}
                  >
                    <div className="font-semibold text-[#18231C]">{d.label || d.name}</div>
                    <div className="text-[10px] text-[#526058] mt-0.5">{d.meaning}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Dynamic Pendant Length from SQLite */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B] flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#C29B38]" />
                3. Pendant Length
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sizeChoices.map((s) => (
                  <button
                    key={`${s.mm}-${s.label}`}
                    type="button"
                    onClick={() => setSelectedSizeMm(s.mm)}
                    className={`p-3 text-center rounded-2xl border text-xs transition-all cursor-pointer ${
                      selectedSizeMm === s.mm
                        ? 'border-[#1B382B] bg-[#1B382B]/10 font-bold text-[#1B382B] ring-1 ring-[#1B382B] shadow-xs'
                        : 'border-white/80 bg-white/60 hover:bg-white text-[#526058]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Cord & Binding */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B]">
                4. Cord Braiding & Binding Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {cordChoices.map((cord) => (
                  <button
                    key={cord}
                    type="button"
                    onClick={() => setSelectedCord(cord)}
                    className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                      selectedCord === cord
                        ? 'border-[#1B382B] bg-[#1B382B]/10 font-semibold text-[#1B382B]'
                        : 'border-white/80 bg-white/60 hover:bg-white text-[#526058]'
                    }`}
                  >
                    {cord}
                  </button>
                ))}
              </div>
              <select
                value={selectedBinding}
                onChange={(e) => setSelectedBinding(e.target.value)}
                className="w-full p-2.5 text-xs border border-white/80 bg-white rounded-xl focus:outline-none focus:border-[#1B382B]"
              >
                {bindingChoices.map((binding) => (
                  <option key={binding} value={binding}>
                    Lashing: {binding}
                  </option>
                ))}
              </select>
            </div>

            {/* Add-ons */}
            <div className="pt-3 border-t border-[#E8E2D6] space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B]">
                Artisan Add-Ons & Presentation
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-white/80 bg-white/60 hover:bg-white cursor-pointer text-xs transition-colors">
                  <input
                    type="checkbox"
                    checked={includePauaEye}
                    onChange={(e) => setIncludePauaEye(e.target.checked)}
                    className="accent-[#1B382B] w-4 h-4"
                  />
                  <div className="flex-1 flex justify-between items-center">
                    <span>New Zealand Iridescent Pāua Shell Eye Inlay</span>
                    <span className="font-mono text-[#1B382B] font-semibold">
                      +{formatNZD(customPricing.pauaEyeCents)}
                    </span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-white/80 bg-white/60 hover:bg-white cursor-pointer text-xs transition-colors">
                  <input
                    type="checkbox"
                    checked={includeHardwoodBox}
                    onChange={(e) => setIncludeHardwoodBox(e.target.checked)}
                    className="accent-[#1B382B] w-4 h-4"
                  />
                  <div className="flex-1 flex justify-between items-center">
                    <span>Handmade Native Rimu & Velvet Gift Presentation Case</span>
                    <span className="font-mono text-[#1B382B] font-semibold">
                      +{formatNZD(customPricing.hardwoodBoxCents)}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Customer Details & Action */}
            <div className="pt-4 border-t border-[#E8E2D6] space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1B382B]">
                Your Details for Jesse
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input
                  type="text"
                  placeholder="Your Full Name *"
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  className="p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
                  required
                />
                <input
                  type="email"
                  placeholder="Your Email Address *"
                  value={quoteEmail}
                  onChange={(e) => setQuoteEmail(e.target.value)}
                  className="p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
                  required
                />
              </div>
              <textarea
                placeholder="Special meaning, recipient's name, or carving requests..."
                value={configuratorNotes}
                onChange={(e) => setConfiguratorNotes(e.target.value)}
                rows={2}
                className="w-full p-3 text-xs border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Saving Request...' : 'Submit Custom Piece to Jesse'}</span>
                <ArrowRight className="w-4 h-4 text-[#7FA892]" />
              </button>
            </div>
          </form>

          {/* Real-time Preview Right Column */}
          <div className="lg:col-span-5 sticky top-28 space-y-6">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 text-center">
              <div className="text-xs font-sans-ui uppercase tracking-widest text-[#526058] font-semibold">
                Live Atelier Preview Plinth
              </div>

              <div className="relative h-68 rounded-2xl bg-gradient-to-b from-white/90 to-[#FAF9F6] flex items-center justify-center p-6 border border-white shadow-inner">
                <img
                  src={
                    referenceImg ||
                    designChoices.find((d) => d.name === selectedDesign)?.previewImageUrl ||
                    '/src/assets/images/modern_hero_pounamu_1794472502033.jpg'
                  }
                  alt="Configured greenstone preview"
                  className="max-h-full object-contain filter drop-shadow-lg rounded-xl"
                />
                <div className="absolute bottom-3 left-3 right-3 px-3 py-1.5 glass-panel rounded-xl text-[11px] text-[#1B382B] font-semibold flex justify-between items-center">
                  <span>
                    {selectedMaterial} · {selectedDesign}
                  </span>
                  <span>{selectedSizeMm}mm</span>
                </div>
              </div>

              {/* Specification breakdown */}
              <div className="space-y-2 text-left text-xs text-[#526058] border-t border-[#E8E2D6]/80 pt-4">
                <div className="flex justify-between">
                  <span>Stone Variety:</span>
                  <strong className="text-[#18231C]">{selectedMaterial} (Aotearoa NZ)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Design Shape:</span>
                  <strong className="text-[#18231C]">{selectedDesign}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Target Dimensions:</span>
                  <strong className="text-[#18231C]">~{selectedSizeMm}mm length</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cord Style:</span>
                  <strong className="text-[#18231C] truncate max-w-[190px]">{selectedCord}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Authenticity Guarantee:</span>
                  <span className="text-[#1B382B] font-semibold flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-[#2D5A46]" />
                    Ngāi Tahu Code Registered
                  </span>
                </div>
              </div>

              {/* Price summary */}
              <div className="p-4 bg-white/70 rounded-2xl border border-white text-center space-y-1 shadow-xs">
                <div className="text-xs text-[#526058] font-medium">
                  Estimated Bespoke Price (GST included)
                </div>
                <div className="font-display text-2xl font-bold text-[#1B382B] tabular-nums">
                  {formatNZD(calculatedCents)}
                </div>
                <div className="text-[11px] text-[#2D5A46] font-medium">
                  50% deposit ({formatNZD(Math.round(calculatedCents * 0.5))}) payable upon quote confirmation
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REQUEST DIRECT QUOTE WITH IMAGE */}
      {activeTab === 'quotes' && (
        <div className="relative z-10 max-w-3xl mx-auto glass-panel p-8 sm:p-10 rounded-3xl space-y-6 shadow-xl">
          <div className="border-b border-[#E8E2D6]/80 pb-4 space-y-1">
            <h2 className="font-display text-xl font-bold text-[#18231C]">
              Submit Custom Concept / Upload Sketch
            </h2>
            <p className="text-xs text-[#526058]">
              Have a specific family symbol, heirloom drawing, or custom dimension requirement? Jesse will review your concept and reply with a custom quote and completion timeframe.
            </p>
          </div>

          <form onSubmit={handleSubmitDirectQuote} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Your Name *</label>
                <input
                  type="text"
                  required
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Email Address *</label>
                <input
                  type="email"
                  required
                  value={quoteEmail}
                  onChange={(e) => setQuoteEmail(e.target.value)}
                  placeholder="you@example.co.nz"
                  className="w-full p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Phone / Mobile</label>
                <input
                  type="tel"
                  value={quotePhone}
                  onChange={(e) => setQuotePhone(e.target.value)}
                  placeholder="+64 21 ..."
                  className="w-full p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C]">Estimated Budget Range</label>
                <select
                  value={quoteBudget}
                  onChange={(e) => setQuoteBudget(e.target.value)}
                  className="w-full p-3 border border-white/80 bg-white rounded-xl"
                >
                  <option>$300 - $500 NZD</option>
                  <option>$500 - $800 NZD</option>
                  <option>$800 - $1,200 NZD</option>
                  <option>$1,200+ Master Heirloom Piece</option>
                </select>
              </div>
            </div>

            {/* Real Reference Image Upload */}
            <div className="space-y-2">
              <label className="font-semibold text-[#18231C]">
                Reference Sketch or Inspiration Image (optional)
              </label>
              <div className="flex flex-wrap items-center gap-4 p-4 border border-white/80 rounded-2xl bg-white/60">
                <div className="w-16 h-16 rounded-xl border border-[#E8E2D6] bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {referenceImg ? (
                    <img
                      src={referenceImg}
                      alt="Uploaded reference"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[#7D8B82] opacity-50" />
                  )}
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <div className="font-medium text-[#18231C]">
                    {referenceImg ? 'Reference image attached' : 'Upload a sketch or reference photo'}
                  </div>
                  <div className="text-[11px] text-[#526058]">
                    PNG, JPG, or WebP up to 2.5 MB — saved directly with your request for Jesse.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-2 glass-button border border-[#E8E2D6] bg-white text-[#1B382B] font-semibold rounded-xl text-xs hover:bg-[#FAF9F6] cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{referenceImg ? 'Replace File' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0])}
                    />
                  </label>
                  {referenceImg && (
                    <button
                      type="button"
                      onClick={() => setReferenceImg('')}
                      className="p-2 rounded-xl border border-[#E8E2D6] bg-white text-[#A63A2A] hover:bg-[#A63A2A]/10 cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#18231C]">Design Notes & Meaning *</label>
              <textarea
                rows={4}
                required
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Describe who this piece is for, desired stone darkness or translucency, motif shape, and any target dates..."
                className="w-full p-3 border border-white/80 bg-white/80 rounded-xl focus:outline-none focus:border-[#1B382B]"
              />
            </div>

            {/* Legal safeguard checkbox */}
            <div className="p-3.5 bg-white/60 border border-white rounded-xl space-y-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="accent-[#1B382B] mt-0.5"
                />
                <span className="text-[#526058]">
                  I confirm that I have the right to request this custom carving, that it respects traditional Māori cultural motifs, and I acknowledge that custom carved pieces are non-refundable once carving begins.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-60"
            >
              <Send className="w-4 h-4 text-[#7FA892]" />
              <span>{isSubmitting ? 'Sending Request...' : 'Send Custom Quote Request to Jesse'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ACTIVE COMMISSIONS & MESSAGING PIPELINE */}
      {activeTab === 'my-requests' && (
        <div className="relative z-10 space-y-6">
          {/* Guest / Collector Commission Lookup Bar */}
          {onLookupCommission && (
            <form
              onSubmit={handleLookup}
              className="glass-panel p-4 rounded-2xl flex flex-wrap items-center gap-3 text-xs shadow-xs"
            >
              <div className="font-semibold text-[#18231C] flex items-center gap-1.5 shrink-0">
                <Search className="w-3.5 h-3.5 text-[#2D5A46]" />
                <span>Find Commission:</span>
              </div>
              <input
                type="text"
                required
                placeholder="Reference # (e.g. CC-2026-842)"
                value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                className="flex-1 min-w-[180px] p-2 border border-[#E8E2D6] rounded-xl bg-white font-mono uppercase focus:outline-none focus:border-[#1B382B]"
              />
              <input
                type="email"
                required
                placeholder="Your Email Address"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                className="flex-1 min-w-[200px] p-2 border border-[#E8E2D6] rounded-xl bg-white focus:outline-none focus:border-[#1B382B]"
              />
              <button
                type="submit"
                disabled={isLookingUp}
                className="px-4 py-2 bg-[#1B382B] text-white rounded-xl font-semibold hover:bg-[#12241B] cursor-pointer disabled:opacity-50"
              >
                {isLookingUp ? 'Finding...' : 'Load Request'}
              </button>
              {lookupMessage && (
                <div className="w-full text-[#A63A2A] font-medium pt-1">{lookupMessage}</div>
              )}
            </form>
          )}

          {commissions.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3 shadow-xl">
              <Sparkles className="w-8 h-8 text-[#C29B38] mx-auto" />
              <h3 className="font-display text-lg font-bold text-[#18231C]">
                No custom commissions loaded yet
              </h3>
              <p className="text-xs text-[#526058] max-w-md mx-auto">
                Configure a bespoke greenstone piece, submit a direct quote request, or look up an existing request above using your reference number and email.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('configurator')}
                className="px-5 py-2.5 bg-[#1B382B] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Open Visual Customizer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Commissions list */}
              <div className="lg:col-span-4 glass-panel p-4 rounded-3xl space-y-3 shadow-xl">
                <h3 className="font-display text-sm font-bold text-[#18231C] px-2 py-1">
                  Studio Requests ({commissions.length})
                </h3>
                <div className="space-y-2">
                  {commissions.map((comm) => (
                    <button
                      key={comm.id}
                      type="button"
                      onClick={() => setSelectedCommissionId(comm.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeCommission?.id === comm.id
                          ? 'border-[#1B382B] bg-[#1B382B]/10 ring-1 ring-[#1B382B]'
                          : 'border-white/80 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-[#18231C]">{comm.referenceNumber}</strong>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            comm.status === 'IN_PRODUCTION'
                              ? 'bg-[#2D5A46] text-white'
                              : comm.status === 'QUOTED'
                              ? 'bg-[#C29B38] text-white'
                              : 'bg-[#E8E2D6] text-[#526058]'
                          }`}
                        >
                          {comm.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-[#526058] mt-1 font-medium">
                        {comm.material} {comm.designType} ({comm.pendantSizeMm}mm)
                      </div>
                      <div className="text-[11px] text-[#526058] flex justify-between mt-2">
                        <span>{comm.customerName}</span>
                        <span className="font-mono font-semibold text-[#18231C]">
                          {comm.quoteAmountCents ? formatNZD(comm.quoteAmountCents) : 'Awaiting Quote'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Commission Detail & Live Chat */}
              {activeCommission && (
                <div className="lg:col-span-8 glass-panel rounded-3xl overflow-hidden shadow-xl flex flex-col h-[650px]">
                  {/* Header */}
                  <div className="p-5 bg-white/70 border-b border-white/80 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-base text-[#18231C]">
                          {activeCommission.referenceNumber}
                        </span>
                        <span className="text-xs text-[#526058]">·</span>
                        <span className="text-xs text-[#526058]">
                          {activeCommission.material} {activeCommission.designType}
                        </span>
                      </div>
                      <div className="text-xs text-[#526058]">
                        Client: {activeCommission.customerName} ({activeCommission.customerEmail})
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-[#526058]">Quoted Price:</div>
                        <div className="font-bold text-[#1B382B] text-sm tabular-nums">
                          {activeCommission.quoteAmountCents
                            ? formatNZD(activeCommission.quoteAmountCents)
                            : 'Awaiting Quote'}
                        </div>
                        {activeCommission.leadTimeWeeks && (
                          <div className="text-[10px] text-[#526058]">
                            Est. {activeCommission.leadTimeWeeks} weeks
                          </div>
                        )}
                      </div>
                      {activeCommission.status === 'QUOTED' && (
                        <button
                          type="button"
                          disabled={acceptingId === activeCommission.id}
                          onClick={() => handleAcceptQuoteClick(activeCommission)}
                          className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer shadow-sm disabled:opacity-60"
                        >
                          {acceptingId === activeCommission.id
                            ? 'Accepting...'
                            : 'Accept Quote'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Pipeline Tracker */}
                  <div className="px-6 py-3 bg-white/50 border-b border-white/80 flex items-center justify-between text-[11px] font-sans-ui overflow-x-auto gap-4">
                    {[
                      { key: 'REQUESTED', label: 'Requested' },
                      { key: 'QUOTED', label: 'Quoted' },
                      { key: 'ACCEPTED', label: 'Accepted' },
                      { key: 'IN_PRODUCTION', label: 'In Production' },
                      { key: 'READY', label: 'Ready & Blessed' },
                      { key: 'SHIPPED', label: 'Dispatched' },
                    ].map((step, idx) => {
                      const isCurrent = activeCommission.status === step.key;
                      return (
                        <div key={step.key} className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent
                                ? 'bg-[#1B382B] text-white'
                                : 'bg-[#E8E2D6] text-[#526058]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className={isCurrent ? 'font-bold text-[#1B382B]' : 'text-[#526058]'}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reference Image & Chat Messages Body */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white/40">
                    {activeCommission.referenceImageUrl && (
                      <div className="p-3 bg-white/80 rounded-2xl border border-[#E8E2D6] flex items-center gap-3 text-xs">
                        <img
                          src={activeCommission.referenceImageUrl}
                          alt="Concept reference"
                          className="w-16 h-16 rounded-xl object-cover border border-[#E8E2D6]"
                        />
                        <div className="text-[#526058]">
                          <strong className="text-[#18231C] block">Attached Concept Image</strong>
                          Sent with request for stone matching & shape approval.
                        </div>
                      </div>
                    )}

                    {activeCommission.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.sender === 'carver' ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div className="text-[10px] text-[#526058] mb-1 px-1">
                          {msg.senderName} ({msg.sender === 'carver' ? 'Master Carver' : 'Client'}) ·{' '}
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div
                          className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed ${
                            msg.sender === 'carver'
                              ? 'bg-[#1B382B] text-white rounded-tl-none shadow-md'
                              : 'bg-white text-[#18231C] border border-white rounded-tr-none shadow-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input Bar */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-4 bg-white/80 border-t border-white/80 space-y-2"
                  >
                    {isAdmin && (
                      <div className="flex items-center justify-between text-xs text-[#526058]">
                        <span>Studio Admin Reply Role:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSenderMode('customer')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors ${
                              senderMode === 'customer'
                                ? 'bg-[#1B382B] text-white font-semibold'
                                : 'bg-white text-[#526058]'
                            }`}
                          >
                            Client Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setSenderMode('carver')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors ${
                              senderMode === 'carver'
                                ? 'bg-[#2D5A46] text-white font-semibold'
                                : 'bg-white text-[#526058]'
                            }`}
                          >
                            Jesse (Carver)
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          isAdmin && senderMode === 'carver'
                            ? 'Reply to client with stone recommendations or timeline...'
                            : 'Ask Jesse about stone selection, carving progress, or sizing...'
                        }
                        className="flex-1 p-3 text-xs border border-white rounded-xl bg-white focus:outline-none focus:border-[#1B382B]"
                      />
                      <button
                        type="submit"
                        disabled={isSendingChat}
                        className="p-3 bg-[#1B382B] hover:bg-[#12241B] text-white rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <Send className="w-4 h-4 text-[#7FA892]" />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
