import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Search,
  Sparkles,
  Eye,
  X,
  ArrowRight,
  FileCheck,
  Lock,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import {
  CustomInspirationTemplate,
  DesignMotif,
  GalleryItem,
  Product,
  StoneVariety,
  UserProfile,
  WishlistItem,
} from '../types';

export interface WishlistToggleInput {
  itemId: string;
  itemKind: 'product' | 'gallery';
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  priceCents?: number;
  image: string;
  authenticityCode?: string;
  originRiver?: string;
}

interface UnifiedGalleryEntry {
  id: string;
  kind: 'product' | 'gallery';
  status: 'PRESENT' | 'PAST_SOLD';
  title: string;
  material: StoneVariety;
  designType: DesignMotif;
  originRiver: string;
  authenticityCode: string;
  dimensions: string;
  description: string;
  storyNote?: string;
  image: string;
  carverName: string;
  yearLabel: string;
}

interface GalleryViewProps {
  products: Product[];
  galleryItems: GalleryItem[];
  wishlist: WishlistItem[];
  currentUser: UserProfile | null;
  initialPieceId?: string | null;
  onClearInitialPiece?: () => void;
  onToggleWishlist: (input: WishlistToggleInput) => void;
  onOpenWishlistOrAuth: () => void;
  onChooseForCustom: (template: CustomInspirationTemplate) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  products,
  galleryItems,
  wishlist,
  currentUser,
  initialPieceId = null,
  onClearInitialPiece,
  onToggleWishlist,
  onOpenWishlistOrAuth,
  onChooseForCustom,
}) => {
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'PRESENT' | 'PAST_SOLD'>('ALL');
  const [varietyFilter, setVarietyFilter] = useState<string>('All');
  const [motifFilter, setMotifFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<UnifiedGalleryEntry | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  const getPieceShareUrl = (entry: UnifiedGalleryEntry): string => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?tab=gallery&piece=${encodeURIComponent(entry.id)}`;
  };

  const handleCopyShareLink = async (entry: UnifiedGalleryEntry) => {
    const shareUrl = getPieceShareUrl(entry);
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = shareUrl;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedShareId(entry.id);
      setTimeout(() => {
        setCopiedShareId((prev) => (prev === entry.id ? null : prev));
      }, 2500);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const wishlistIdSet = useMemo(
    () => new Set(wishlist.map((w) => w.itemId)),
    [wishlist]
  );

  // Merge live present products, sold-out products (no longer in storefront), and curated past gallery items
  const allEntries: UnifiedGalleryEntry[] = useMemo(() => {
    const productEntries: UnifiedGalleryEntry[] = products
      .filter((p) => p.published)
      .map((p) => {
        const isAvailable = p.isMadeToOrder || p.quantity > 0;
        return {
          id: p.id,
          kind: 'product',
          status: isAvailable ? 'PRESENT' : 'PAST_SOLD',
          title: p.title,
          material: p.material,
          designType: p.designType,
          originRiver: p.originRiver,
          authenticityCode: p.authenticityCode,
          dimensions: p.dimensions,
          description: p.description,
          storyNote: p.spiritualMeaning,
          image: p.images[0] || '',
          carverName: p.carverName || 'Jesse',
          yearLabel: isAvailable ? 'Current Design' : 'Past Carving',
        };
      });

    const archiveEntries: UnifiedGalleryEntry[] = galleryItems.map((g) => ({
      id: g.id,
      kind: 'gallery',
      status: 'PAST_SOLD',
      title: g.title,
      material: g.material,
      designType: g.designType,
      originRiver: g.originRiver,
      authenticityCode: g.authenticityCode,
      dimensions: g.dimensions,
      description: g.description,
      storyNote: g.storyNote,
      image: g.imageUrl,
      carverName: g.carverName || 'Jesse',
      yearLabel: `Carved ${g.carvedYear}`,
    }));

    // Order: Present works first, then recently sold products, then curated past carvings
    const present = productEntries.filter((e) => e.status === 'PRESENT');
    const soldProducts = productEntries.filter((e) => e.status === 'PAST_SOLD');
    return [...present, ...soldProducts, ...archiveEntries];
  }, [products, galleryItems]);

  useEffect(() => {
    if (!initialPieceId || allEntries.length === 0) return;
    const match = allEntries.find((entry) => entry.id === initialPieceId);
    if (match) {
      setSelectedEntry(match);
    }
    onClearInitialPiece?.();
  }, [initialPieceId, allEntries, onClearInitialPiece]);

  const presentCount = allEntries.filter((e) => e.status === 'PRESENT').length;
  const pastCount = allEntries.filter((e) => e.status === 'PAST_SOLD').length;

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (availabilityFilter !== 'ALL' && entry.status !== availabilityFilter) return false;
      if (varietyFilter !== 'All' && entry.material !== varietyFilter) return false;
      if (motifFilter !== 'All' && entry.designType !== motifFilter) return false;
      if (q) {
        const hay = `${entry.title} ${entry.material} ${entry.designType} ${entry.originRiver} ${entry.authenticityCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEntries, availabilityFilter, varietyFilter, motifFilter, searchQuery]);

  const toWishlistInput = (entry: UnifiedGalleryEntry): WishlistToggleInput => ({
    itemId: entry.id,
    itemKind: entry.kind,
    title: entry.title,
    material: entry.material,
    designType: entry.designType,
    image: entry.image,
    authenticityCode: entry.authenticityCode,
    originRiver: entry.originRiver,
  });

  const handleChooseCustom = (entry: UnifiedGalleryEntry) => {
    onChooseForCustom({
      sourceId: entry.id,
      title: entry.title,
      material: entry.material,
      designType: entry.designType,
      authenticityCode: entry.authenticityCode,
      originRiver: entry.originRiver,
      imageUrl: entry.image || undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      {/* Editorial Header + Wishlist Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#E8E2D6] pb-8">
        <div className="space-y-2.5 max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] font-sans-ui text-[#2D5A46] font-semibold">
            Studio Portfolio &amp; Archive · Ngā Āhua Pounamu
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C] text-balance">
            Gallery of Past &amp; Present Designs
          </h1>
          <p className="text-sm text-[#526058] leading-relaxed">
            Explore the shapes, traditional motifs, and stone varieties Jesse has carved across past heirlooms and present works. Because each piece is one-of-a-kind and stone availability changes over time, select any design below to request a custom carving inspired by it or save favourites to your personal wishlist.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenWishlistOrAuth}
            className="px-4 py-2.5 rounded-xl border border-[#1B382B]/25 bg-white hover:bg-[#FAF9F6] text-xs font-sans-ui font-semibold text-[#18231C] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
          >
            <Heart
              className={`w-4 h-4 ${
                currentUser && wishlist.length > 0
                  ? 'text-[#A63A2A] fill-[#A63A2A]'
                  : 'text-[#1B382B]'
              }`}
            />
            {currentUser ? (
              <span>My Saved Wishlist ({wishlist.length})</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#2D5A46]" />
                <span>Join &amp; Sign In for Wishlist</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E8E2D6] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Segmented Tabs */}
          <div className="inline-flex p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setAvailabilityFilter('ALL')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                availabilityFilter === 'ALL'
                  ? 'bg-[#1B382B] text-white shadow-xs'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              All Works ({allEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('PRESENT')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                availabilityFilter === 'PRESENT'
                  ? 'bg-[#1B382B] text-white shadow-xs'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Present Designs ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('PAST_SOLD')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                availabilityFilter === 'PAST_SOLD'
                  ? 'bg-[#1B382B] text-white shadow-xs'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Past Archive ({pastCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#526058] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gallery by title, river, code, or design..."
              aria-label="Search past and present carvings"
              className="w-full pl-10 pr-9 py-2 bg-[#FAF9F6] border border-[#E8E2D6] focus:bg-white focus:border-[#1B382B] rounded-xl text-xs text-[#18231C] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526058] hover:text-[#18231C] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stone Variety & Motif Filters */}
        {(() => {
          const galleryStones = Array.from(
            new Set([
              'All',
              'Kawakawa',
              'Kahurangi',
              'Inanga',
              'Tangiwai',
              'Whale Bone',
              ...allEntries.map((e) => e.material),
            ])
          ).filter(Boolean);
          const galleryShapes = Array.from(
            new Set([
              'All',
              'Toki',
              'Koru',
              'Pikorua (Twist)',
              'Roimata',
              'Manaia',
              'Mere',
              ...allEntries.map((e) => e.designType),
            ])
          ).filter(Boolean);

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#E8E2D6]/70 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-[#18231C] mr-1">Stone:</span>
                {galleryStones.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVarietyFilter(v)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      varietyFilter === v
                        ? 'bg-[#1B382B] text-white font-semibold'
                        : 'bg-[#FAF9F6] text-[#526058] hover:text-[#18231C]'
                    }`}
                  >
                    {v === 'All' ? 'All Stones' : v}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-[#18231C] mr-1">Shape:</span>
                {galleryShapes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotifFilter(m)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      motifFilter === m
                        ? 'bg-[#1B382B] text-white font-semibold'
                        : 'bg-[#FAF9F6] text-[#526058] hover:text-[#18231C]'
                    }`}
                  >
                    {m === 'All' ? 'All Shapes' : m === 'Pikorua (Twist)' ? 'Pikorua' : m}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Gallery Grid */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E2D6] p-12 text-center space-y-3">
          <h2 className="font-display text-lg font-bold text-[#18231C]">
            No carvings match those filters
          </h2>
          <p className="text-xs text-[#526058] max-w-md mx-auto">
            Try switching between Present and Past Works or clearing your stone and design filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setAvailabilityFilter('ALL');
              setVarietyFilter('All');
              setMotifFilter('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] cursor-pointer"
          >
            Show All Archive &amp; Current Carvings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEntries.map((entry) => {
            const isSaved = wishlistIdSet.has(entry.id);
            const showFallback = !entry.image || failedImages[entry.id];

            return (
              <article
                key={entry.id}
                className="group bg-white rounded-2xl border border-[#E8E2D6] overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Media Frame */}
                <div className="relative aspect-4/3 bg-[#FAF9F6] overflow-hidden">
                  {showFallback ? (
                    <div className="w-full h-full bg-gradient-to-br from-[#1B382B]/15 via-[#FAF9F6] to-[#7FA892]/20 flex flex-col items-center justify-center p-6 text-center">
                      <Sparkles className="w-6 h-6 text-[#1B382B] mb-2" />
                      <span className="font-display text-sm font-bold text-[#18231C]">
                        {entry.title}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={entry.image}
                      alt={entry.title}
                      referrerPolicy="no-referrer"
                      onClick={() => setSelectedEntry(entry)}
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [entry.id]: true }))
                      }
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 cursor-pointer"
                    />
                  )}

                  {/* Top-Right Wishlist Button (40px touch target) */}
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(toWishlistInput(entry))}
                    title={
                      !currentUser
                        ? 'Join & sign in to save to your Wishlist'
                        : isSaved
                        ? 'Remove from Wishlist'
                        : 'Save to Wishlist'
                    }
                    aria-label={isSaved ? `Remove ${entry.title} from wishlist` : `Save ${entry.title} to wishlist`}
                    className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-[#1B382B] text-white'
                        : 'bg-white/90 text-[#18231C] hover:bg-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isSaved ? 'fill-[#C29B38] text-[#C29B38]' : ''}`}
                    />
                  </button>

                  {/* Bottom-Right Quick Detail Lightbox Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    aria-label={`Inspect ${entry.title}`}
                    className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 text-[#1B382B] rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-white cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Card Copy: Shape, Stone & Origin Showcase (No Prices) */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#526058]">
                      <span
                        className={`font-semibold ${
                          entry.status === 'PRESENT' ? 'text-[#2D5A46]' : 'text-[#8C6D1F]'
                        }`}
                      >
                        {entry.yearLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.material}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.designType}</span>
                    </div>

                    <h3 className="font-display text-base font-bold text-[#18231C] leading-snug">
                      {entry.title}
                    </h3>

                    <p className="text-xs text-[#526058] line-clamp-2 leading-relaxed">
                      {entry.description}
                    </p>
                  </div>

                  {/* Card Footer: Inspect & Request Custom Design */}
                  <div className="pt-4 border-t border-[#E8E2D6] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className="px-3 py-2 border border-[#E8E2D6] rounded-xl text-xs font-semibold text-[#18231C] hover:bg-[#FAF9F6] cursor-pointer whitespace-nowrap"
                    >
                      Details
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChooseCustom(entry)}
                      className="flex-1 py-2 px-3.5 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#12241B] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                      <span>Request This Design</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111C16]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-[#E8E2D6] my-8">
            <div className="px-6 py-4 border-b border-[#E8E2D6] flex items-center justify-between bg-[#FAF9F6]">
              <div className="flex items-center gap-2 text-xs text-[#526058]">
                <span className="font-display font-bold text-sm text-[#18231C]">
                  {selectedEntry.title}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntry.yearLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                aria-label="Close gallery detail"
                className="p-2 text-[#526058] hover:text-[#18231C] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
              <div className="md:col-span-6 space-y-4">
                <div className="aspect-4/3 rounded-2xl overflow-hidden bg-[#FAF9F6] border border-[#E8E2D6]">
                  {selectedEntry.image && !failedImages[selectedEntry.id] ? (
                    <img
                      src={selectedEntry.image}
                      alt={selectedEntry.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#526058] text-xs">
                      Studio Archive Photography
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#1B382B]">
                    <FileCheck className="w-4 h-4 text-[#2D5A46]" />
                    <span>Carving Provenance Record</span>
                  </div>
                  <div className="text-[#526058]">
                    Code:{' '}
                    <span className="font-mono font-semibold text-[#18231C]">
                      {selectedEntry.authenticityCode}
                    </span>
                  </div>
                  <div className="text-[#526058]">
                    Origin: <span className="text-[#18231C] font-medium">{selectedEntry.originRiver}</span>
                  </div>
                  <div className="text-[#526058]">
                    Dimensions: <span className="text-[#18231C] font-medium">{selectedEntry.dimensions}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 flex flex-col justify-between space-y-5 text-xs">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#2D5A46]">
                    <span>{selectedEntry.material} Greenstone</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedEntry.designType}</span>
                    <span aria-hidden="true">·</span>
                    <span>By {selectedEntry.carverName}</span>
                  </div>

                  <h2 className="font-display text-2xl font-bold text-[#18231C]">
                    {selectedEntry.title}
                  </h2>

                  <p className="text-[#526058] leading-relaxed">{selectedEntry.description}</p>

                  {selectedEntry.storyNote && (
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-[#3D4C43] leading-relaxed">
                      {selectedEntry.storyNote}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleChooseCustom(selectedEntry);
                      setSelectedEntry(null);
                    }}
                    className="w-full py-3 bg-[#1B382B] hover:bg-[#12241B] text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#C29B38]" />
                    <span>Request a Custom Carving in This Design</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleWishlist(toWishlistInput(selectedEntry))}
                    className="w-full py-2.5 border border-[#E8E2D6] hover:bg-[#FAF9F6] text-[#18231C] font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wishlistIdSet.has(selectedEntry.id)
                          ? 'fill-[#C29B38] text-[#C29B38]'
                          : 'text-[#526058]'
                      }`}
                    />
                    <span>
                      {!currentUser
                        ? 'Join & Sign In to Save to Wishlist'
                        : wishlistIdSet.has(selectedEntry.id)
                        ? 'Saved in My Wishlist (Click to Remove)'
                        : 'Save to My Wishlist'}
                    </span>
                  </button>

                  {/* Social Media Sharing Bar (Twitter, Facebook, Copy Link) */}
                  {(() => {
                    const shareUrl = getPieceShareUrl(selectedEntry);
                    const shareText = `Explore "${selectedEntry.title}" — hand-carved ${selectedEntry.material} ${selectedEntry.designType} by ${selectedEntry.carverName} at Pounamu Atelier`;
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      shareText
                    )}&url=${encodeURIComponent(shareUrl)}`;
                    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      shareUrl
                    )}`;
                    const isCopied = copiedShareId === selectedEntry.id;

                    return (
                      <div className="pt-3 mt-1 border-t border-[#E8E2D6] space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#18231C] flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-[#2D5A46]" />
                            <span>Share This Carving</span>
                          </span>
                          {isCopied && (
                            <span className="text-[#2D5A46] font-semibold">
                              Link copied!
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <a
                            href={twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Share ${selectedEntry.title} on Twitter`}
                            className="h-10 px-2.5 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] hover:bg-white hover:border-[#1B382B] text-[#18231C] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>Twitter</span>
                          </a>

                          <a
                            href={facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Share ${selectedEntry.title} on Facebook`}
                            className="h-10 px-2.5 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] hover:bg-white hover:border-[#1B382B] text-[#18231C] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-3.5 h-3.5 shrink-0 text-[#1877F2]"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                            </svg>
                            <span>Facebook</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => void handleCopyShareLink(selectedEntry)}
                            aria-label={`Copy share link for ${selectedEntry.title}`}
                            className={`h-10 px-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              isCopied
                                ? 'border-[#2D5A46] bg-[#2D5A46]/10 text-[#2D5A46]'
                                : 'border-[#E8E2D6] bg-[#FAF9F6] hover:bg-white hover:border-[#1B382B] text-[#18231C]'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#2D5A46]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#526058]" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
