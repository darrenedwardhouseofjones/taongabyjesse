import React from 'react';
import { ShieldCheck, Compass, Sparkles, Feather, Heart, ArrowRight } from 'lucide-react';

interface StoryViewProps {
  onStartCustom: () => void;
  onBrowseCollection: () => void;
}

export const StoryView: React.FC<StoryViewProps> = ({
  onStartCustom,
  onBrowseCollection,
}) => {
  return (
    <div className="relative text-[#18231C] overflow-hidden space-y-16 pb-24">
      {/* Subtle Opaque River Stone Texture Background */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] bg-cover bg-fixed"
        style={{
          backgroundImage: `url('/src/assets/images/hero_pounamu_river_1794468029445.jpg')`,
        }}
      />

      {/* Hero Header with Modern Glass Accents */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#18231C] via-[#1B382B] to-[#12241B] text-[#FAF9F6] py-24 px-6 sm:px-12">
        {/* Modern hero backdrop at low opacity */}
        <div className="absolute inset-0 z-0 opacity-25">
          <img
            src="/src/assets/images/modern_hero_pounamu_1794472502033.jpg"
            alt="Pounamu exhibition backdrop"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 text-xs font-sans-ui tracking-[0.25em] uppercase text-[#E8E2D6] px-4 py-1.5 rounded-full glass-button">
            <span>The Spirit of Greenstone · Te Wairua o Te Pounamu</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white max-w-3xl mx-auto text-balance">
            Jesse’s Carving Story & Sacred New Zealand Jade
          </h1>

          <p className="font-serif-body text-lg sm:text-2xl text-[#E8E2D6] max-w-2xl mx-auto italic leading-relaxed">
            "We do not truly own the pounamu. We are its guardians for a short breath in time, shaping the stone to uncover the spirit already resting within."
          </p>
        </div>
      </section>

      {/* Jesse's Personal Carver Narrative with Glass Cards */}
      <section className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Carver Portrait */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl glass-panel p-2">
              <img
                src="/src/assets/images/jesse_studio_portrait_1794557999104.jpg"
                alt="Artisan carver Jesse in his 30s inspecting a hand-carved greenstone pendant at his Napier studio bench"
                className="w-full h-[460px] object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="p-4 bg-white/80 backdrop-blur-md rounded-xl mt-2 text-xs text-[#526058] flex items-center justify-between border border-white">
                <span className="font-semibold text-[#18231C]">Jesse · Artisan Carver</span>
                <span className="font-mono text-[#1B382B]">Napier, Hawke’s Bay NZ</span>
              </div>
            </div>
          </div>

          {/* Bio & Philosophy with Personal & Family Story */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-sans-ui uppercase tracking-widest text-[#1B382B] font-semibold">
              <Compass className="w-4 h-4 text-[#C29B38]" />
              <span>Artisan & Family Story</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#18231C]">
              Crafting Family Heirlooms in Napier, Hawke’s Bay
            </h2>

            <div className="font-sans-ui text-sm sm:text-base text-[#526058] space-y-4 leading-relaxed">
              <p>
                <strong>Jesse</strong> is an artisan carver in his 30s based in sunny coastal Napier, Hawke’s Bay. Married to his wife <strong>Samantha</strong> and a proud, devoted father of two young children (both aged 5 and under), Jesse brings a heartfelt warmth and generational purpose to every piece he carves.
              </p>
              <p>
                For Jesse, carving greenstone is an extension of family and connection. Balancing busy studio days with family life, he crafts each piece with the awareness that pounamu is an heirloom that will outlive us all—a tangible vessel of love, protection, and memory to be gifted and handed down to children and grandchildren.
              </p>
              <p>
                From his coastal workshop in Napier, Jesse works exclusively with authentic, certified South Island pounamu sourced ethically from the sacred riverbeds of Te Wai Pounamu (Arahura, Cascade, and Greenstone rivers) under Ngāi Tahu legal vesting. Shaping each stone under freshwater with high-precision diamond rotary tools and patient hand-polishing, Jesse brings out the unique spirit and crystalline luster of genuine New Zealand jade.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-4">
              <button
                onClick={onStartCustom}
                className="px-6 py-3 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
              >
                <span>Commission a Custom Piece</span>
                <ArrowRight className="w-4 h-4 text-[#7FA892]" />
              </button>
              <button
                onClick={onBrowseCollection}
                className="px-6 py-3 glass-button hover:bg-white text-[#18231C] rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-xs"
              >
                Explore Current Collection
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cultural Meaning & The Gifting Tradition (Clear English Explanations) */}
      <section className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl space-y-10 shadow-xl">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs uppercase tracking-[0.2em] font-sans-ui text-[#2D5A46] font-semibold">
              Cultural Traditions & Meaning · Tikanga Māori
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#18231C]">
              Why Greenstone is Sacred & Why It Is Gifted
            </h2>
            <p className="text-[#526058] text-sm sm:text-base">
              In New Zealand, greenstone isn’t simply jewelry; it is a sacred treasure (<em>taonga</em>) carrying connection, memory, and life-force.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/70 border border-white space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#1B382B] text-[#7FA892] flex items-center justify-center font-bold">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display text-base font-bold text-[#18231C]">
                The Tradition of Gifting
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                In Māori custom, pounamu is traditionally gifted rather than bought for oneself. It honors the bond between the giver and the recipient. Over time, the stone absorbs the natural warmth and spiritual presence (<em>wairua</em>) of the wearer, becoming an heirloom passed down through generations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/70 border border-white space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#1B382B] text-[#7FA892] flex items-center justify-center font-bold">
                <Feather className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display text-base font-bold text-[#18231C]">
                Blessing & Karakia
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                Before any carving leaves Jesse’s workshop, it is washed in clean river water and dedicated with a quiet blessing (<em>karakia</em>). This blessing brings safe travels, strength, and positive energy to whoever wears the pendant.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/70 border border-white space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#1B382B] text-[#7FA892] flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display text-base font-bold text-[#18231C]">
                Ngāi Tahu Act 1997
              </h3>
              <p className="text-xs text-[#526058] leading-relaxed">
                Under New Zealand law, all natural pounamu in the South Island is legally owned and guarded by the indigenous tribe, Te Rūnanga o Ngāi Tahu. Exporting unworked raw stone is illegal. Every piece in our studio carries an individual authentication serial number.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Guide to the 4 Pounamu Varieties with Frosted Cards */}
      <section className="max-w-6xl mx-auto px-6 space-y-10 relative z-10">
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-[0.2em] font-sans-ui text-[#2D5A46] font-semibold">
            Stone Varieties & Colors
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#18231C]">
            The Four Main New Zealand Greenstone Varieties
          </h2>
          <p className="text-sm text-[#526058] max-w-xl mx-auto">
            Depending on the riverbed or alpine valley where it is discovered, greenstone displays distinct shades, clarity, and textures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 glass-card rounded-2xl space-y-3">
            <div className="h-3 bg-[#1B382B] rounded-full shadow-xs" />
            <h4 className="font-display text-base font-bold text-[#18231C]">
              Kawakawa
              <span className="block text-xs font-sans-ui font-normal text-[#526058]">Deep Forest Green</span>
            </h4>
            <p className="text-xs text-[#526058] leading-relaxed">
              Named after the native Kawakawa pepper tree leaf. Rich, dark green, often featuring small dark mineral flecks. The most iconic traditional stone for adze blades and pendants.
            </p>
          </div>

          <div className="p-6 glass-card rounded-2xl space-y-3">
            <div className="h-3 bg-[#2D5A46] rounded-full shadow-xs" />
            <h4 className="font-display text-base font-bold text-[#18231C]">
              Kahurangi
              <span className="block text-xs font-sans-ui font-normal text-[#526058]">Translucent Apple Green</span>
            </h4>
            <p className="text-xs text-[#526058] leading-relaxed">
              Named after the cloudless clarity of the sky. Highly translucent, bright apple green with minimal flaws. The rarest and most precious grade of New Zealand nephrite jade.
            </p>
          </div>

          <div className="p-6 glass-card rounded-2xl space-y-3">
            <div className="h-3 bg-[#7FA892] rounded-full shadow-xs" />
            <h4 className="font-display text-base font-bold text-[#18231C]">
              Inanga
              <span className="block text-xs font-sans-ui font-normal text-[#526058]">Pearlescent Pale Celadon</span>
            </h4>
            <p className="text-xs text-[#526058] leading-relaxed">
              Named for the silvery-white appearance of native whitebait fish. Prized for its soft, milky-white translucency that glows like moonlight when held to sunlight.
            </p>
          </div>

          <div className="p-6 glass-card rounded-2xl space-y-3">
            <div className="h-3 bg-[#9E8B62] rounded-full shadow-xs" />
            <h4 className="font-display text-base font-bold text-[#18231C]">
              Tangiwai (Bowenite)
              <span className="block text-xs font-sans-ui font-normal text-[#526058]">Fiord Water Tear</span>
            </h4>
            <p className="text-xs text-[#526058] leading-relaxed">
              Translates to "tears of weeping water." Found in remote fiords of Milford Sound (*Piopiotahi*). Known for striking, glass-like clarity and olive-green depth.
            </p>
          </div>
        </div>
      </section>

      {/* Traditional Design Shapes & Meanings in Plain English */}
      <section className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl space-y-8 shadow-xl">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#18231C]">
              Traditional Shapes & What They Symbolize
            </h2>
            <p className="text-xs sm:text-sm text-[#526058]">
              Each shape carries a specific intention, making it easy to choose the right gift for graduations, weddings, milestones, or remembrance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="p-5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[#1B382B]">Toki (The Adze Blade)</span>
                <span className="text-xs text-[#2D5A46] font-semibold">Courage & Leadership</span>
              </div>
              <p className="text-xs text-[#526058] leading-relaxed">
                Originally a functional stone working blade and weapon. Worn today to symbolize inner strength, perseverance, leadership, and overcoming life challenges.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[#1B382B]">Koru (The Unfurling Fern Spiral)</span>
                <span className="text-xs text-[#2D5A46] font-semibold">New Beginnings & Peace</span>
              </div>
              <p className="text-xs text-[#526058] leading-relaxed">
                Modeled after the baby silver fern frond unfurling in the forest. Represents new beginnings, personal growth, harmony, and the cycle of renewal.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[#1B382B]">Pikorua (The Double or Triple Twist)</span>
                <span className="text-xs text-[#2D5A46] font-semibold">Eternal Friendship & Love</span>
              </div>
              <p className="text-xs text-[#526058] leading-relaxed">
                Symbolizes two lives or cultures forever joined together. Even when life pathways diverge geographically, they always twist back together through shared love.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[#1B382B]">Roimata (The Drop of Comfort)</span>
                <span className="text-xs text-[#2D5A46] font-semibold">Empathy & Emotional Healing</span>
              </div>
              <p className="text-xs text-[#526058] leading-relaxed">
                An elongated teardrop shape worn as a comforting token of reassurance, shared grief, recovery, and quiet emotional solace.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
