import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  Camera,
  Award,
  X,
} from 'lucide-react';
import { Product, SiteSettings } from '../types';
import { apiFetch } from '../utils/api';
import { sanitizeSafeMediaUrl } from '../utils/url';
import { DEFAULT_SITE_SETTINGS } from '../utils/defaults';
import { CertificateOfAuthenticity } from './CertificateOfAuthenticity';
import {
  certificateOwnerCheckSchema,
  provenanceVerifySchema,
  validateWithSchema,
} from '../validation/schemas';

interface ProvenanceRecord {
  certificateNumber?: string;
  title: string;
  authenticityCode: string;
  originRiver: string;
  material: string;
  designType?: string;
  dimensions?: string;
  carverName: string;
  image: string;
  permitRef?: string;
  issuedAt?: string;
  orderNumber?: string;
  hasRecordedSale?: boolean;
  buyerCheckStatus?: 'UNCHECKED' | 'MATCHED' | 'MISMATCH';
}

interface ProvenanceViewProps {
  products: Product[];
  settings?: SiteSettings;
  initialCode?: string | null;
  onClearInitialCode?: () => void;
}

export const ProvenanceView: React.FC<ProvenanceViewProps> = ({
  products,
  settings = DEFAULT_SITE_SETTINGS,
  initialCode,
  onClearInitialCode,
}) => {
  const [searchCode, setSearchCode] = useState(initialCode || '');
  const [searchResult, setSearchResult] = useState<ProvenanceRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // Secondary & combined anti-counterfeit buyer name/email double-check
  const [ownerVerifyInput, setOwnerVerifyInput] = useState('');
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerChecking, setBuyerChecking] = useState(false);
  const [buyerCheckError, setBuyerCheckError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const runLookup = async (rawCode: string, buyerQuery?: string, fromSecondary = false) => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) return;

    if (fromSecondary) {
      setBuyerChecking(true);
      setBuyerCheckError(null);
    } else {
      setSearching(true);
      setBuyerCheckError(null);
      if (buyerQuery && buyerQuery.trim()) {
        setBuyerInput(buyerQuery.trim());
      } else {
        setBuyerInput('');
      }
    }

    try {
      const buyerParam =
        buyerQuery && buyerQuery.trim()
          ? `&buyer=${encodeURIComponent(buyerQuery.trim())}`
          : '';
      const res = await apiFetch<{ verified: boolean; record: ProvenanceRecord | null }>(
        `/api/provenance/verify?code=${encodeURIComponent(cleanCode)}${buyerParam}`
      );
      if (res.verified && res.record) {
        setSearchResult(res.record);
      } else {
        setSearchResult(null);
      }
    } catch {
      if (fromSecondary) {
        setBuyerCheckError('Unable to verify buyer match right now. Please try again.');
      } else {
        const match = products.find(
          (p) => p.authenticityCode.trim().toUpperCase() === cleanCode
        );
        setSearchResult(
          match
            ? {
                title: match.title,
                authenticityCode: match.authenticityCode,
                originRiver: match.originRiver,
                material: match.material,
                designType: match.designType,
                dimensions: match.dimensions,
                carverName: match.carverName,
                image: match.images[0] || '',
                permitRef: match.permitRef,
                hasRecordedSale: false,
                buyerCheckStatus: 'UNCHECKED',
              }
            : null
        );
      }
    } finally {
      setSearched(true);
      setSearching(false);
      setBuyerChecking(false);
    }
  };

  useEffect(() => {
    if (!initialCode) return;
    const clean = initialCode.trim().toUpperCase();
    setSearchCode(clean);
    void runLookup(clean);
    onClearInitialCode?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const parsed = validateWithSchema(provenanceVerifySchema, {
      code: searchCode,
      buyer: ownerVerifyInput.trim() || undefined,
    });
    if (!parsed.success) {
      setLookupError(parsed.error);
      return;
    }
    await runLookup(parsed.data.code, parsed.data.buyer, false);
    setIsVerifyModalOpen(false);
  };

  const handleBuyerVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchResult) return;
    setBuyerCheckError(null);
    const parsed = validateWithSchema(certificateOwnerCheckSchema, {
      owner: buyerInput,
    });
    if (!parsed.success) {
      setBuyerCheckError(parsed.error);
      return;
    }
    setOwnerVerifyInput(parsed.data.owner);
    const lookupKey = searchResult.certificateNumber || searchResult.authenticityCode;
    await runLookup(lookupKey, parsed.data.owner, true);
  };

  const safePieceImage = sanitizeSafeMediaUrl(searchResult?.image);

  return (
    <div className="relative max-w-6xl mx-auto px-6 py-12 space-y-12 overflow-hidden">
      {/* Subtle Opaque River Stone Texture in Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] bg-cover bg-fixed"
        style={{
          backgroundImage: `url('/src/assets/images/hero_pounamu_river_1794468029445.jpg')`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 text-center space-y-3">
        <span className="text-xs uppercase tracking-[0.25em] font-sans-ui text-[#2D5A46] font-semibold">
          Taonga by Jesse · Certified Provenance &amp; QR Verification
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C]">
          Certificate &amp; Origin Verification
        </h1>
        <p className="text-[#526058] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Under the Ngāi Tahu (Pounamu Vesting) Act 1997, all natural greenstone in New Zealand’s South Island is legally owned and guarded by Te Rūnanga o Ngāi Tahu. Every piece leaving our studio carries a unique Taonga by Jesse certificate card paired with its official studio photograph.
        </p>
      </div>

      {/* Real-time Code & Ownership Lookup System with Glass Panel */}
      <div className="relative z-10 glass-panel p-6 sm:p-10 rounded-3xl shadow-xl space-y-6">
        <div className="max-w-3xl mx-auto space-y-2 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="font-display text-lg font-bold text-[#18231C]">
              Verify Authenticity &amp; Collector Ownership
            </h2>
            <button
              type="button"
              onClick={() => setIsVerifyModalOpen(true)}
              className="px-2.5 py-1 rounded-lg border border-[#1B382B]/30 bg-white/90 hover:bg-[#FAF9F6] text-[11px] font-semibold text-[#1B382B] inline-flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#2D5A46]" />
              <span>Open Verification Modal</span>
            </button>
          </div>
          <p className="text-xs text-[#526058]">
            Enter your Certificate # (<span className="font-mono">TBJ-...</span>) or Ngāi Tahu provenance code (<span className="font-mono">NT-...</span>), plus your buyer name or email to cross-reference studio sale records.
          </p>

          <form onSubmit={handleLookup} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 text-left">
            <div className="md:col-span-5">
              <label className="sr-only" htmlFor="provenance-code-input">
                Certificate or Provenance Code
              </label>
              <input
                id="provenance-code-input"
                type="text"
                required
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Provenance or Cert # (e.g. TBJ-2026-... or NT-...)"
                className="w-full p-3.5 border border-white/80 bg-white/95 rounded-2xl text-xs font-mono uppercase focus:outline-none focus:border-[#1B382B] shadow-xs"
              />
            </div>
            <div className="md:col-span-4">
              <label className="sr-only" htmlFor="provenance-owner-input">
                Buyer Name or Checkout Email (Optional)
              </label>
              <input
                id="provenance-owner-input"
                type="text"
                value={ownerVerifyInput}
                onChange={(e) => setOwnerVerifyInput(e.target.value)}
                placeholder="Owner name or email (optional match)"
                className="w-full p-3.5 border border-white/80 bg-white/95 rounded-2xl text-xs focus:outline-none focus:border-[#1B382B] shadow-xs"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={searching || !searchCode.trim()}
                className="w-full h-full px-5 py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
              >
                <Search className="w-4 h-4 text-[#7FA892]" />
                <span>{searching ? 'Checking...' : 'Verify Authenticity'}</span>
              </button>
            </div>
          </form>
          {lookupError && (
            <div className="mt-2 p-2.5 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs font-medium text-left">
              {lookupError}
            </div>
          )}
        </div>

        {searched && (
          <div className="mt-6 pt-6 border-t border-[#E8E2D6]/80">
            {searchResult ? (
              <div className="p-6 bg-white/85 rounded-2xl border border-[#D8E2DC] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start shadow-xs">
                {/* Official Studio Photo for Visual Grain & Carving Comparison */}
                <div className="lg:col-span-4 space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-[#E8E2D6] bg-[#FAF9F6]">
                    {safePieceImage ? (
                      <img
                        src={safePieceImage}
                        alt={searchResult.title}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-xs text-[#7D8B82]">
                        Studio photo unavailable
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-[#18231C]/85 text-white text-[10px] font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                      <Camera className="w-3 h-3 text-[#C29B38]" />
                      <span>Official Studio Photo</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#526058] leading-relaxed">
                    Compare natural river stone grain, mineral inclusions, and carving profile above with the piece in your hand to confirm it matches this certificate.
                  </p>
                </div>

                {/* Provenance Metadata + Anti-Counterfeit Buyer Check */}
                <div className="lg:col-span-8 space-y-4 text-xs font-sans-ui">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#2D5A46] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>VERIFIED AUTHENTIC — TAONGA BY JESSE REGISTRY</span>
                    </div>
                    {searchResult.certificateNumber && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1B382B] text-[#F0D486] font-mono text-[11px] font-bold">
                        <Award className="w-3.5 h-3.5" />
                        <span>{searchResult.certificateNumber}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-xl font-bold text-[#18231C]">
                      {searchResult.title}
                    </h3>
                    {(searchResult.designType || searchResult.dimensions) && (
                      <div className="text-[11px] text-[#526058] mt-0.5">
                        {[
                          searchResult.designType ? `Motif: ${searchResult.designType}` : null,
                          searchResult.dimensions ? `Dimensions: ${searchResult.dimensions}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6]">
                    <div>
                      <span className="text-[#526058] block">Ngāi Tahu Code:</span>
                      <strong className="font-mono text-[#18231C]">
                        {searchResult.authenticityCode}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#526058] block">River of Origin:</span>
                      <strong className="text-[#18231C]">{searchResult.originRiver}</strong>
                    </div>
                    <div>
                      <span className="text-[#526058] block">Stone Variety:</span>
                      <strong className="text-[#18231C]">{searchResult.material} Pounamu</strong>
                    </div>
                    <div>
                      <span className="text-[#526058] block">Master Carver:</span>
                      <strong className="text-[#18231C]">
                        {searchResult.carverName} (Napier, NZ)
                      </strong>
                    </div>
                    {searchResult.permitRef && (
                      <div className="col-span-2">
                        <span className="text-[#526058] block">DOC Permit / Exemption Ref:</span>
                        <strong className="font-mono text-[#18231C]">{searchResult.permitRef}</strong>
                      </div>
                    )}
                    {searchResult.issuedAt && (
                      <div className="col-span-2">
                        <span className="text-[#526058] block">Certificate Issued:</span>
                        <strong className="text-[#18231C]">
                          {new Date(searchResult.issuedAt).toLocaleDateString('en-NZ', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          {searchResult.orderNumber ? `(Order ${searchResult.orderNumber})` : ''}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Anti-Counterfeit Collector Ownership Double-Check */}
                  {searchResult.hasRecordedSale ? (
                    <div className="p-4 rounded-xl border border-[#D8E2DC] bg-[#F7F9F8] space-y-2.5">
                      <div className="flex items-center gap-2 font-display font-bold text-xs text-[#18231C]">
                        <UserCheck className="w-4 h-4 text-[#1B382B]" />
                        <span>Collector Verification Double-Check (Anti-Counterfeit)</span>
                      </div>
                      <p className="text-[11px] text-[#526058] leading-relaxed">
                        To protect against forged certificates reusing a real number, enter the original buyer’s full name, surname, or checkout email to verify it matches our recorded sale. Private details remain hidden.
                      </p>
                      <form onSubmit={handleBuyerVerify} className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={buyerInput}
                          onChange={(e) => setBuyerInput(e.target.value)}
                          placeholder="Buyer full name, surname, or checkout email..."
                          className="flex-1 min-w-[200px] px-3 py-2 border border-[#D8E2DC] bg-white rounded-xl text-xs focus:outline-none focus:border-[#1B382B]"
                        />
                        <button
                          type="submit"
                          disabled={buyerChecking || !buyerInput.trim()}
                          className="px-4 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                        >
                          {buyerChecking ? 'Checking...' : 'Check Collector Match'}
                        </button>
                      </form>

                      {buyerCheckError && (
                        <div className="text-[11px] text-[#A63A2A] font-medium">
                          {buyerCheckError}
                        </div>
                      )}

                      {searchResult.buyerCheckStatus === 'MATCHED' && (
                        <div className="p-2.5 rounded-lg bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] text-[11px] flex items-center gap-2 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                          <span>
                            Collector Match Confirmed: The buyer name or email matches the original issued sale for certificate{' '}
                            <span className="font-mono font-bold">
                              {searchResult.certificateNumber}
                            </span>
                            .
                          </span>
                        </div>
                      )}

                      {searchResult.buyerCheckStatus === 'MISMATCH' && (
                        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-[11px] flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>
                            No match found for that buyer name or email on certificate{' '}
                            <span className="font-mono font-bold">
                              {searchResult.certificateNumber}
                            </span>
                            . Double-check spelling, or contact Taonga by Jesse before purchasing second-hand if the card may be duplicated.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-[11px] text-[#526058]">
                      This code corresponds to a catalogue or archive carving recorded by Jesse in Napier. Unique <span className="font-mono">TBJ-YYYY-XXXXXX</span> collector certificates are issued and linked to the buyer upon purchase.
                    </div>
                  )}
                </div>

                {/* Printable Double-Sided Business Card Preview */}
                <div className="lg:col-span-12 pt-5 mt-2 border-t border-[#E8E2D6]">
                  <CertificateOfAuthenticity
                    certificates={[
                      {
                        certificateNumber:
                          searchResult.certificateNumber || searchResult.authenticityCode,
                        authenticityCode: searchResult.authenticityCode,
                        title: searchResult.title,
                        material: searchResult.material,
                        designType: searchResult.designType,
                        dimensions: searchResult.dimensions,
                        originRiver: searchResult.originRiver,
                        permitRef: searchResult.permitRef,
                        carverName: searchResult.carverName || 'Jesse',
                        image: searchResult.image,
                        orderNumber: searchResult.orderNumber,
                        issuedAt: searchResult.issuedAt,
                        hasRecordedSale: searchResult.hasRecordedSale,
                      },
                    ]}
                    settings={settings}
                    orderNumber={searchResult.orderNumber}
                    showOwnerVerification={false}
                    compactHeader
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 bg-red-50/80 text-red-900 rounded-2xl border border-red-200 text-xs text-center space-y-1">
                <div className="font-bold flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Code Not Found in Central Studio Registry</span>
                </div>
                <p className="text-[#526058]">
                  Please double-check the characters entered. If this piece was carved prior to 2024, please reach out to Jesse directly at our Napier studio.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compliance & Legal Standards in Plain English */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans-ui">
        <div className="p-6 glass-panel rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center gap-2 font-display font-bold text-sm text-[#18231C]">
            <ShieldCheck className="w-4 h-4 text-[#1B382B]" />
            <span>Ngāi Tahu Pounamu Act 1997</span>
          </div>
          <p className="text-[#526058] leading-relaxed">
            The Act returned legal ownership of all naturally occurring greenstone in the South Island to Te Rūnanga o Ngāi Tahu. The tribe manages sustainable harvesting and a strict traceability framework protecting the stone for future generations.
          </p>
        </div>

        <div className="p-6 glass-panel rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center gap-2 font-display font-bold text-sm text-[#18231C]">
            <AlertTriangle className="w-4 h-4 text-[#C29B38]" />
            <span>DOC Marine Mammal &amp; Bone Rules</span>
          </div>
          <p className="text-[#526058] leading-relaxed">
            The New Zealand Department of Conservation (DOC) enforces strict permits for possessing or working marine mammal bones or teeth. Our studio records permit numbers and restricts international shipping on bone artifacts to ensure full CITES treaty compliance.
          </p>
        </div>

        <div className="p-6 glass-panel rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center gap-2 font-display font-bold text-sm text-[#18231C]">
            <FileText className="w-4 h-4 text-[#1B382B]" />
            <span>Fair Trading &amp; Raw Stone Laws</span>
          </div>
          <p className="text-[#526058] leading-relaxed">
            Under New Zealand Fair Trading law, it is strictly prohibited to label imported nephrite jade as New Zealand pounamu. In addition, raw uncarved stone over 5kg cannot be exported without ministerial consent. We only retail finished, hand-crafted heirloom pieces.
          </p>
        </div>
      </div>

      {/* Verify Authenticity Modal */}
      {isVerifyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111C16]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Verify Authenticity"
        >
          <div className="bg-white rounded-3xl border border-[#E8E2D6] shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#2D5A46] font-bold">
                  Taonga by Jesse Registry
                </div>
                <h3 className="font-display text-lg font-bold text-[#18231C]">
                  Verify Authenticity &amp; Ownership
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(false)}
                aria-label="Close verify modal"
                className="p-1.5 rounded-lg text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#526058] leading-relaxed">
              Cross-reference your piece’s provenance number and original buyer name or checkout email against our studio SQLite registry.
            </p>

            <form onSubmit={handleLookup} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#18231C] mb-1">
                  Provenance / Certificate Number
                </label>
                <input
                  type="text"
                  required
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="e.g. TBJ-2026-6EEA24 or NT-89210-AR"
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl font-mono uppercase focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18231C] mb-1">
                  Owner Name or Checkout Email
                </label>
                <input
                  type="text"
                  required
                  value={ownerVerifyInput}
                  onChange={(e) => setOwnerVerifyInput(e.target.value)}
                  placeholder="Buyer full name or email used at checkout"
                  className="w-full p-3 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                />
              </div>

              {lookupError && (
                <div className="p-2.5 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs font-medium">
                  {lookupError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2.5 border border-[#E8E2D6] rounded-xl text-[#526058] font-semibold hover:bg-[#FAF9F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={searching || !searchCode.trim() || !ownerVerifyInput.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] text-white font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4 text-[#7FA892]" />
                  <span>{searching ? 'Checking...' : 'Verify Authenticity'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
