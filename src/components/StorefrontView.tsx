import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  MapPin,
  Truck,
  Heart,
  ArrowRight,
  Eye,
  Check,
  X,
  FileCheck,
  Search,
  Gift,
} from 'lucide-react';
import { CartItem, Product, UserProfile, WishlistItem } from '../types';
import { formatNZD } from '../utils/pricing';
import type { WishlistToggleInput } from './GalleryView';

interface StorefrontViewProps {
  products: Product[];
  cartItems?: CartItem[];
  wishlist?: WishlistItem[];
  currentUser?: UserProfile | null;
  initialProductId?: string | null;
  onClearInitialProduct?: () => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist?: (input: WishlistToggleInput) => void;
  onOpenCustom: () => void;
  onOpenGallery?: () => void;
  onOpenGiftCards?: () => void;
  onOpenStory: () => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  products,
  cartItems = [],
  wishlist = [],
  currentUser = null,
  initialProductId = null,
  onClearInitialProduct,
  onAddToCart,
  onToggleWishlist,
  onOpenCustom,
  onOpenGallery,
  onOpenGiftCards,
  onOpenStory,
}) => {
  const [selectedVariety, setSelectedVariety] = useState<string>('All');
  const [selectedMotif, setSelectedMotif] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(null);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  useEffect(() => {
    if (!initialProductId || products.length === 0) return;
    const match = products.find((p) => p.id === initialProductId);
    if (match) {
      setActiveProductModal(match);
    }
    onClearInitialProduct?.();
  }, [initialProductId, products, onClearInitialProduct]);

  const wishlistIdSet = new Set(wishlist.map((w) => w.itemId));

  // Filter storefront strictly to published & currently in-stock (or made-to-order) pieces.
  // Once a piece is sold out, it automatically retires from Storefront into the Past & Present Gallery.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (!p.published) return false;
    if (!p.isMadeToOrder && p.quantity <= 0) return false;
    const matchVariety = selectedVariety === 'All' || p.material === selectedVariety;
    const matchMotif = selectedMotif === 'All' || p.designType === selectedMotif;
    const matchSearch =
      normalizedQuery === '' ||
      p.title.toLowerCase().includes(normalizedQuery) ||
      p.material.toLowerCase().includes(normalizedQuery);
    return matchVariety && matchMotif && matchSearch;
  });

  const handleAdd = (product: Product) => {
    onAddToCart(product);
    setAddedToast(`Added "${product.title}" to your cart`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  return (
    <div className="relative space-y-16 pb-24 overflow-hidden">
      {/* Subtle Atmospheric Background Stone Texture (Opaque / Low Opacity) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] bg-repeat bg-cover"
        style={{
          backgroundImage: `url('/src/assets/images/hero_pounamu_river_1794468029445.jpg')`,
        }}
      />

      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 glass-dark text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-sans-ui flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 text-[#7FA892]" />
          <span>{addedToast}</span>
        </div>
      )}

      {/* FULL-WIDTH ATMOSPHERIC ARTISAN HERO WITH COMPACT GLASS-PANEL OVERLAY */}
      <section className="relative w-full h-[75vh] min-h-[500px] max-h-[680px] overflow-hidden flex items-center">
        {/* Full-width High-Quality Background Image: Master carver actively shaping the greenstone piece */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/jesse_carving_hero_1794557997280.jpg"
            alt="Jesse hand-carving a glowing green New Zealand pounamu pendant with a diamond rotary tool in his Napier workshop"
            className="w-full h-full object-cover object-right filter brightness-[0.96] contrast-105"
            referrerPolicy="no-referrer"
          />
          {/* Subtle directional gradient scrim preserving the workshop light and the greenstone carving */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent lg:w-[55%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111C16]/50 via-transparent to-black/20" />
        </div>

        {/* Primary Hero Content Area Styled with Compact .glass-panel Utility */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex justify-start">
          <div className="glass-panel max-w-md lg:max-w-lg p-6 sm:p-7 rounded-2xl shadow-xl space-y-3.5 text-[#18231C] animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Subtle Frosted Kicker Pill */}
            <div className="inline-flex items-center gap-1.5 text-[11px] font-sans-ui uppercase tracking-wider text-[#1B382B] px-3 py-1 rounded-full bg-white/70 backdrop-blur-md border border-[#1B382B]/15 shadow-2xs font-semibold">
              <Sparkles className="w-3 h-3 text-[#C29B38]" />
              <span>Hand-Carved in Napier · Jesse</span>
            </div>

            {/* Refined Headline (Scaled down from 6xl to elegant 3xl-4xl) */}
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#18231C] leading-tight text-balance">
              Sculpted by Hand. Honed with Water.
            </h1>

            {/* Concise Subtitle */}
            <p className="font-serif-body text-sm sm:text-base text-[#3D4C43] leading-relaxed italic">
              Authentic New Zealand Pounamu taonga, precision-carved with diamond tools by Jesse in his Napier studio. Certified Ngāi Tahu origin.
            </p>

            {/* Slimmer, Modern Call-to-Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#collection-grid"
                className="px-5 py-2.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg hover:translate-y-[-1px]"
              >
                <span>Explore Collection</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#7FA892]" />
              </a>
              <button
                onClick={onOpenCustom}
                className="px-4 py-2.5 glass-button hover:bg-white text-[#18231C] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-[#18231C]/15 shadow-2xs hover:translate-y-[-1px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                <span>Custom Order</span>
              </button>
              {onOpenGiftCards && (
                <button
                  type="button"
                  onClick={onOpenGiftCards}
                  className="px-4 py-2.5 glass-button hover:bg-white text-[#18231C] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-[#18231C]/15 shadow-2xs hover:translate-y-[-1px]"
                >
                  <Gift className="w-3.5 h-3.5 text-[#1B382B]" />
                  <span>Gift Cards</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modern Glass Trust Bar */}
      <section className="max-w-7xl mx-auto px-6 relative z-10 -mt-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 glass-panel rounded-2xl shadow-xl">
          <div className="flex items-center gap-3.5 p-2">
            <div className="w-10 h-10 rounded-xl bg-[#1B382B]/10 flex items-center justify-center text-[#1B382B] shrink-0 border border-[#1B382B]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xs text-[#18231C]">
                Certified Provenance
              </div>
              <div className="text-[11px] text-[#526058]">Ngāi Tahu Act 1997 Registered</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2">
            <div className="w-10 h-10 rounded-xl bg-[#1B382B]/10 flex items-center justify-center text-[#1B382B] shrink-0 border border-[#1B382B]/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xs text-[#18231C]">
                100% NZ River Jade
              </div>
              <div className="text-[11px] text-[#526058]">Zero imported counterfeit stone</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2">
            <div className="w-10 h-10 rounded-xl bg-[#1B382B]/10 flex items-center justify-center text-[#1B382B] shrink-0 border border-[#1B382B]/20">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xs text-[#18231C]">
                Hand-Carved by Jesse
              </div>
              <div className="text-[11px] text-[#526058]">Traditional West Coast artisan</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2">
            <div className="w-10 h-10 rounded-xl bg-[#1B382B]/10 flex items-center justify-center text-[#1B382B] shrink-0 border border-[#1B382B]/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xs text-[#18231C]">
                Insured Fast Courier
              </div>
              <div className="text-[11px] text-[#526058]">Tracked signature delivery</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Collection Grid Section */}
      <section id="collection-grid" className="max-w-7xl mx-auto px-6 space-y-8 relative z-10">
        {/* Section Header & English-first descriptions */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] font-sans-ui text-[#2D5A46] font-semibold">
                Curated Studio Pieces · Nga Taonga Whakairo
              </span>
              <h2 className="font-display text-3xl font-bold text-[#18231C]">
                Handcrafted Greenstone Collection
              </h2>
              <p className="text-xs sm:text-sm text-[#526058] mt-1">
                Each piece is carved from a specific New Zealand glacial boulder, blessed, and ready to be gifted.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#526058] font-medium">
              <span>Showing {filteredProducts.length} available pieces</span>
              {onOpenGiftCards && (
                <button
                  type="button"
                  onClick={onOpenGiftCards}
                  className="text-[#1B382B] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Digital Gift Cards</span>
                </button>
              )}
              {onOpenGallery && (
                <button
                  type="button"
                  onClick={onOpenGallery}
                  className="text-[#1B382B] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Browse Past &amp; Sold Gallery</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Frosted Glass Filter & Search Controls */}
          <div className="p-3.5 glass-panel rounded-2xl space-y-3">
            {/* Real-time Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#526058] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pieces by name or greenstone material (e.g., Toki, Kawakawa, Kahurangi)..."
                aria-label="Search products by name or material type"
                className="w-full pl-10 pr-10 py-2.5 bg-white/80 hover:bg-white focus:bg-white border border-[#E8E2D6] focus:border-[#1B382B] rounded-xl text-xs sm:text-sm text-[#18231C] placeholder:text-[#7D8B82] outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#526058] hover:text-[#18231C] rounded-lg hover:bg-[#E8E2D6]/50 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(() => {
              const STONE_DESC: Record<string, string> = {
                Kawakawa: 'Kawakawa (Deep Forest Green)',
                Kahurangi: 'Kahurangi (Clear Apple Green)',
                Inanga: 'Inanga (Pearlescent Celadon)',
                Tangiwai: 'Tangiwai (Fiord Water Tear)',
              };
              const MOTIF_DESC: Record<string, string> = {
                Toki: 'Toki (Adze of Strength)',
                Koru: 'Koru (Spiral of New Beginnings)',
                'Pikorua (Twist)': 'Twist (Eternal Friendship)',
                Roimata: 'Roimata (Drop of Healing)',
                Manaia: 'Manaia (Guardian Angel)',
                Mere: 'Mere (Chieftain Club)',
              };
              const activeCatalog = products.filter(
                (p) => p.published && (p.isMadeToOrder || p.quantity > 0)
              );
              const varieties = Array.from(
                new Set([
                  'Kawakawa',
                  'Kahurangi',
                  'Inanga',
                  'Tangiwai',
                  ...activeCatalog.map((p) => p.material),
                ])
              ).filter(Boolean);
              const motifs = Array.from(
                new Set([
                  'Toki',
                  'Koru',
                  'Pikorua (Twist)',
                  'Roimata',
                  'Manaia',
                  'Mere',
                  ...activeCatalog.map((p) => p.designType),
                ])
              ).filter(Boolean);

              return (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs font-semibold text-[#18231C] px-2.5">Stone Variety:</span>
                    {[{ key: 'All', label: 'All Varieties' }, ...varieties.map((v) => ({ key: v, label: STONE_DESC[v] || v }))].map(
                      (item) => (
                        <button
                          key={item.key}
                          onClick={() => setSelectedVariety(item.key)}
                          className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                            selectedVariety === item.key
                              ? 'bg-[#1B382B] text-white shadow-sm'
                              : 'text-[#526058] hover:text-[#18231C] hover:bg-white/60'
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    )}
                  </div>

                  {/* Frosted Glass Filter Controls: Design Motif */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E8E2D6]/60">
                    <span className="text-xs font-semibold text-[#18231C] px-2.5">Design Shape:</span>
                    {[{ key: 'All', label: 'All Shapes' }, ...motifs.map((m) => ({ key: m, label: MOTIF_DESC[m] || m }))].map(
                      (item) => (
                        <button
                          key={item.key}
                          onClick={() => setSelectedMotif(item.key)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                            selectedMotif === item.key
                              ? 'bg-[#1B382B] text-white shadow-sm'
                              : 'text-[#526058] hover:text-[#18231C] hover:bg-white/60'
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* 3-Column Modern Glass Cards or Empty Search State */}
        {filteredProducts.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1B382B]/10 text-[#1B382B] flex items-center justify-center mx-auto">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#18231C]">
              No matching pieces found
            </h3>
            <p className="text-xs sm:text-sm text-[#526058] max-w-md mx-auto">
              Try searching for a different piece name or greenstone material (such as Kawakawa, Kahurangi, Inanga, or Tangiwai), or reset your active filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedVariety('All');
                setSelectedMotif('All');
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B382B] text-white text-xs font-semibold rounded-xl hover:bg-[#2D5A46] transition-colors cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => {
              const inCartQty = cartItems.find((i) => i.product.id === product.id)?.quantity || 0;
              const isOutOfStock = !product.isMadeToOrder && product.quantity <= 0;
              const isAtCartMax =
                !product.isMadeToOrder &&
                (product.isUniquePiece ? inCartQty >= 1 : inCartQty >= product.quantity);

              return (
                <div
                  key={product.id}
                  className="group glass-card rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  {/* Product Image Container */}
                  <div className="relative aspect-4/3 bg-[#FAF9F6] overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />

                    {/* Stock & Piece Type Badge */}
                    {isOutOfStock ? (
                      <div className="absolute top-3 left-3 bg-[#A63A2A]/90 backdrop-blur-md text-white text-[10px] font-sans-ui tracking-wider uppercase px-2.5 py-1 rounded-full border border-white/20">
                        Sold Out
                      </div>
                    ) : product.isUniquePiece ? (
                      <div className="absolute top-3 left-3 bg-[#111C16]/80 backdrop-blur-md text-white text-[10px] font-sans-ui tracking-wider uppercase px-2.5 py-1 rounded-full border border-white/20">
                        Unique 1-of-1 Piece
                      </div>
                    ) : product.isMadeToOrder ? (
                      <div className="absolute top-3 left-3 bg-[#2D5A46]/90 backdrop-blur-md text-white text-[10px] font-sans-ui tracking-wider uppercase px-2.5 py-1 rounded-full border border-white/20">
                        Carved to Order
                      </div>
                    ) : (
                      <div className="absolute top-3 left-3 bg-white/85 backdrop-blur-md text-[#1B382B] text-[10px] font-sans-ui tracking-wider uppercase px-2.5 py-1 rounded-full border border-white">
                        {product.quantity} in Stock
                      </div>
                    )}

                    {/* Wishlist toggle button */}
                    {onToggleWishlist && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleWishlist({
                            itemId: product.id,
                            itemKind: 'product',
                            title: product.title,
                            material: product.material,
                            designType: product.designType,
                            priceCents: product.priceCents,
                            image: product.images[0] || '',
                            authenticityCode: product.authenticityCode,
                            originRiver: product.originRiver,
                          })
                        }
                        title={
                          !currentUser
                            ? 'Join & sign in to save to Wishlist'
                            : wishlistIdSet.has(product.id)
                            ? 'Remove from Wishlist'
                            : 'Save to Wishlist'
                        }
                        aria-label={
                          wishlistIdSet.has(product.id)
                            ? `Remove ${product.title} from wishlist`
                            : `Save ${product.title} to wishlist`
                        }
                        className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
                          wishlistIdSet.has(product.id)
                            ? 'bg-[#1B382B] text-white'
                            : 'bg-white/90 text-[#18231C] hover:bg-white'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            wishlistIdSet.has(product.id)
                              ? 'fill-[#C29B38] text-[#C29B38]'
                              : ''
                          }`}
                        />
                      </button>
                    )}

                    {/* Quick view button */}
                    <button
                      onClick={() => setActiveProductModal(product)}
                      className="absolute bottom-3 right-3 p-2.5 bg-white/90 backdrop-blur-md text-[#1B382B] rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white cursor-pointer"
                      title="View full details and certificate"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Clean unboxed metadata with separators */}
                      <div className="flex items-center gap-1.5 text-[11px] text-[#526058]">
                        <span>{product.material} Greenstone</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.designType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[#2D5A46]">{product.originRiver.split(',')[0]}</span>
                      </div>

                      <h3 className="font-display text-base font-bold text-[#18231C] group-hover:text-[#1B382B] transition-colors leading-snug">
                        {product.title}
                      </h3>

                      <p className="text-xs text-[#526058] line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#E8E2D6]/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] text-[#526058]">Price (GST included)</div>
                        <div className="flex items-baseline gap-2">
                          <div className="font-display text-lg font-bold text-[#1B382B] tabular-nums">
                            {formatNZD(product.priceCents)}
                          </div>
                          {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                            <span className="text-[11px] text-[#7D8B82] line-through tabular-nums">
                              {formatNZD(product.compareAtPriceCents)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveProductModal(product)}
                          className="px-3 py-2 glass-button text-xs font-semibold rounded-xl text-[#18231C] hover:bg-white cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          disabled={isOutOfStock || isAtCartMax}
                          onClick={() => handleAdd(product)}
                          className="px-4 py-2 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md"
                        >
                          <span>
                            {isOutOfStock
                              ? 'Sold Out'
                              : isAtCartMax
                              ? 'In Cart'
                              : 'Add to Cart'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Carver Jesse Glass Feature Banner */}
      <section className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="rounded-3xl glass-panel-dark text-white p-8 lg:p-14 overflow-hidden relative shadow-2xl">
          {/* Subtle opaque workshop image texture */}
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url('/src/assets/images/jesse_studio_portrait_1794557999104.jpg')`,
            }}
          />

          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="text-xs uppercase tracking-[0.25em] text-[#7FA892] font-semibold">
              Artisan & Family Story
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Jesse’s Carving Studio
            </h2>
            <p className="font-serif-body text-base sm:text-lg text-[#E8E2D6] leading-relaxed">
              Based in coastal Napier, Hawke’s Bay, Jesse is an artisan carver in his 30s. A devoted father of two young children (5 and under) and married to Samantha, Jesse pours his heart into shaping genuine South Island greenstone into generational family heirlooms.
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenStory}
                className="px-6 py-3.5 bg-white text-[#18231C] hover:bg-[#FAF9F6] rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <span>Read Jesse’s Full Story & Heritage</span>
                <ArrowRight className="w-4 h-4 text-[#1B382B]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT DETAIL MODAL (PDP) with Glassmorphism */}
      {activeProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111C16]/65 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
            <div className="p-4 border-b border-white/60 flex justify-between items-center bg-white/60">
              <span className="font-display text-sm font-bold text-[#18231C]">
                Taonga Specifications & Authenticity
              </span>
              <button
                onClick={() => setActiveProductModal(null)}
                className="p-1.5 text-[#526058] hover:text-[#18231C] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
              {/* Left Image */}
              <div className="md:col-span-6 space-y-3">
                <div className="aspect-4/3 rounded-2xl overflow-hidden border border-white/80 bg-[#FAF9F6] shadow-sm">
                  <img
                    src={activeProductModal.images[0]}
                    alt={activeProductModal.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Provenance Badge Box */}
                <div className="p-4 bg-white/75 rounded-2xl border border-white space-y-1.5 text-xs shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#1B382B]">
                    <FileCheck className="w-4 h-4 text-[#2D5A46]" />
                    <span>Te Rūnanga o Ngāi Tahu Registered Traceability</span>
                  </div>
                  <div className="text-[#526058] text-[11px]">
                    Authentication Code: <strong className="font-mono text-[#18231C]">{activeProductModal.authenticityCode}</strong>
                  </div>
                  <div className="text-[#526058] text-[11px]">
                    Glacial River Origin: <strong className="text-[#18231C]">{activeProductModal.originRiver}</strong>
                  </div>
                </div>
              </div>

              {/* Right Details */}
              <div className="md:col-span-6 space-y-4 text-xs font-sans-ui">
                <div className="space-y-1">
                  <span className="text-[11px] text-[#2D5A46] font-semibold uppercase tracking-wider">
                    {activeProductModal.material} Greenstone · {activeProductModal.designType}
                  </span>
                  <h3 className="font-display text-xl font-bold text-[#18231C]">
                    {activeProductModal.title}
                  </h3>
                  <div className="font-display text-2xl font-bold text-[#1B382B] pt-1">
                    {formatNZD(activeProductModal.priceCents)}
                  </div>
                </div>

                <div className="space-y-1 text-[#526058] leading-relaxed">
                  <strong className="text-[#18231C]">Description:</strong>
                  <p>{activeProductModal.description}</p>
                </div>

                <div className="p-3.5 bg-white/60 rounded-xl border border-white space-y-1">
                  <strong className="text-[#18231C] block">Cultural & Spiritual Meaning:</strong>
                  <p className="text-[#526058] leading-relaxed">
                    {activeProductModal.spiritualMeaning}
                  </p>
                </div>

                <div className="space-y-1 text-[11px] text-[#526058]">
                  <div>Dimensions: <strong className="text-[#18231C]">{activeProductModal.dimensions}</strong></div>
                  <div>Cord: <strong className="text-[#18231C]">{activeProductModal.cordDetails}</strong></div>
                  <div>Carver: <strong className="text-[#18231C]">{activeProductModal.carverName} (Napier, NZ)</strong></div>
                </div>

                <div className="pt-2 space-y-2">
                  {(() => {
                    const modalInCartQty =
                      cartItems.find((i) => i.product.id === activeProductModal.id)?.quantity || 0;
                    const modalOutOfStock =
                      !activeProductModal.isMadeToOrder && activeProductModal.quantity <= 0;
                    const modalAtMax =
                      !activeProductModal.isMadeToOrder &&
                      (activeProductModal.isUniquePiece
                        ? modalInCartQty >= 1
                        : modalInCartQty >= activeProductModal.quantity);
                    return (
                      <button
                        disabled={modalOutOfStock || modalAtMax}
                        onClick={() => {
                          handleAdd(activeProductModal);
                          setActiveProductModal(null);
                        }}
                        className="w-full py-3.5 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>
                          {modalOutOfStock
                            ? 'Sold Out'
                            : modalAtMax
                            ? 'Maximum Available Already in Cart'
                            : 'Add to Cart'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#7FA892]" />
                      </button>
                    );
                  })()}

                  {onToggleWishlist && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleWishlist({
                          itemId: activeProductModal.id,
                          itemKind: 'product',
                          title: activeProductModal.title,
                          material: activeProductModal.material,
                          designType: activeProductModal.designType,
                          priceCents: activeProductModal.priceCents,
                          image: activeProductModal.images[0] || '',
                          authenticityCode: activeProductModal.authenticityCode,
                          originRiver: activeProductModal.originRiver,
                        })
                      }
                      className="w-full py-2.5 border border-[#E8E2D6] hover:bg-white text-[#18231C] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          wishlistIdSet.has(activeProductModal.id)
                            ? 'fill-[#C29B38] text-[#C29B38]'
                            : 'text-[#526058]'
                        }`}
                      />
                      <span>
                        {!currentUser
                          ? 'Join & Sign In to Save to Wishlist'
                          : wishlistIdSet.has(activeProductModal.id)
                          ? 'Saved in Wishlist (Remove)'
                          : 'Save to Wishlist'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
