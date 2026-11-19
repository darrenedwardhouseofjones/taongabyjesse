import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Product } from '../types';
import { apiFetch } from '../utils/api';

interface ProvenanceRecord {
  title: string;
  authenticityCode: string;
  originRiver: string;
  material: string;
  carverName: string;
  image: string;
  permitRef?: string;
}

interface ProvenanceViewProps {
  products: Product[];
}

export const ProvenanceView: React.FC<ProvenanceViewProps> = ({ products }) => {
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<ProvenanceRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchCode.trim().toUpperCase();
    if (!cleanCode) return;

    setSearching(true);
    try {
      const res = await apiFetch<{ verified: boolean; record: ProvenanceRecord | null }>(
        `/api/provenance/verify?code=${encodeURIComponent(cleanCode)}`
      );
      if (res.verified && res.record) {
        setSearchResult(res.record);
      } else {
        setSearchResult(null);
      }
    } catch {
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
              carverName: match.carverName,
              image: match.images[0] || '',
              permitRef: match.permitRef,
            }
          : null
      );
    } finally {
      setSearched(true);
      setSearching(false);
    }
  };

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
          Certified Provenance & Heritage Tracking
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C]">
          Authenticity & Origin Verification
        </h1>
        <p className="text-[#526058] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Under the Ngāi Tahu (Pounamu Vesting) Act 1997, all natural greenstone in New Zealand’s South Island is legally owned and guarded by Te Rūnanga o Ngāi Tahu. Every carving from our studio carries an individual authentication serial number guaranteeing ethical collection and true origin.
        </p>
      </div>

      {/* Real-time Code Lookup System with Glass Panel */}
      <div className="relative z-10 glass-panel p-6 sm:p-10 rounded-3xl shadow-xl space-y-6">
        <div className="max-w-xl mx-auto space-y-2 text-center">
          <h2 className="font-display text-lg font-bold text-[#18231C]">
            Verify Your Piece’s Authentication Code
          </h2>
          <p className="text-xs text-[#526058]">
            Enter the unique Ngāi Tahu serial code printed on your certificate, packing slip, or tax receipt.
          </p>

          <form onSubmit={handleLookup} className="flex gap-2 pt-2">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Enter authentication code (e.g. NT-89210-AR)"
              className="flex-1 p-3.5 border border-white/80 bg-white/90 rounded-2xl text-xs font-mono uppercase focus:outline-none focus:border-[#1B382B] shadow-xs"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white text-xs font-semibold rounded-2xl flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
            >
              <Search className="w-4 h-4 text-[#7FA892]" />
              <span>{searching ? 'Checking...' : 'Verify Code'}</span>
            </button>
          </form>
        </div>

        {searched && (
          <div className="mt-6 pt-6 border-t border-[#E8E2D6]/80">
            {searchResult ? (
              <div className="p-6 bg-white/70 rounded-2xl border border-white grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-xs">
                <div className="md:col-span-3">
                  <img
                    src={searchResult.image}
                    alt={searchResult.title}
                    className="w-full h-32 object-cover rounded-xl border border-white shadow-xs"
                  />
                </div>
                <div className="md:col-span-9 space-y-2 text-xs font-sans-ui">
                  <div className="inline-flex items-center gap-1.5 text-xs text-[#2D5A46] font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>VERIFIED AUTHENTIC NEW ZEALAND GREENSTONE</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[#18231C]">
                    {searchResult.title}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
                    <div>
                      <span className="text-[#526058] block">Serial Number:</span>
                      <strong className="font-mono text-[#18231C]">{searchResult.authenticityCode}</strong>
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
                      <span className="text-[#526058] block">Attributed Carver:</span>
                      <strong className="text-[#18231C]">{searchResult.carverName} (Napier, NZ)</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-red-50/80 text-red-900 rounded-2xl border border-red-200 text-xs text-center space-y-1">
                <div className="font-bold flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Code Not Found in Central Studio Registry</span>
                </div>
                <p className="text-[#526058]">
                  Please double-check the digits entered. If this piece was carved prior to 2024, please reach out to Jesse directly at our Napier studio.
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
            <span>DOC Marine Mammal & Bone Rules</span>
          </div>
          <p className="text-[#526058] leading-relaxed">
            The New Zealand Department of Conservation (DOC) enforces strict permits for possessing or working marine mammal bones or teeth. Our studio records permit numbers and restricts international shipping on bone artifacts to ensure full CITES treaty compliance.
          </p>
        </div>

        <div className="p-6 glass-panel rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center gap-2 font-display font-bold text-sm text-[#18231C]">
            <FileText className="w-4 h-4 text-[#1B382B]" />
            <span>Fair Trading & Raw Stone Laws</span>
          </div>
          <p className="text-[#526058] leading-relaxed">
            Under New Zealand Fair Trading law, it is strictly prohibited to label imported nephrite jade as New Zealand pounamu. In addition, raw uncarved stone over 5kg cannot be exported without ministerial consent. We only retail finished, hand-crafted heirloom pieces.
          </p>
        </div>
      </div>
    </div>
  );
};
