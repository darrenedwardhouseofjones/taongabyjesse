import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  User,
  ChevronDown,
  LayoutDashboard,
  Package,
  LogOut,
  LogIn,
  Truck,
  Heart,
  Gift,
} from 'lucide-react';
import { SiteSettings, UserProfile } from '../types';

export type AppTab =
  | 'store'
  | 'gallery'
  | 'story'
  | 'custom'
  | 'provenance'
  | 'gift-cards'
  | 'orders'
  | 'policies'
  | 'dashboard';

export type DashboardSection =
  | 'client-overview'
  | 'client-orders'
  | 'client-tracking'
  | 'client-wishlist'
  | 'client-gift-cards'
  | 'client-commissions'
  | 'client-profile'
  | 'admin-kpis'
  | 'admin-orders'
  | 'admin-commissions'
  | 'admin-couriers'
  | 'admin-catalogue'
  | 'admin-settings'
  | 'admin-payments'
  | 'admin-seo'
  | 'admin-seo-audit';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  cartCount: number;
  wishlistCount?: number;
  openCart: () => void;
  settings: SiteSettings;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenDashboard: (section?: DashboardSection) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  cartCount,
  wishlistCount = 0,
  openCart,
  settings,
  currentUser,
  onOpenAuth,
  onOpenDashboard,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/80 backdrop-blur-xl border-b border-white/60 shadow-xs">
      {/* Announcement Banner with subtle glass touch */}
      {settings.announcementEnabled && settings.announcementBanner && (
        <div className="bg-[#12241B]/90 backdrop-blur-md text-[#FAF9F6] px-4 py-2 text-xs font-sans-ui text-center tracking-wide flex items-center justify-center gap-2 border-b border-white/10">
          <ShieldCheck className="w-3.5 h-3.5 text-[#7FA892]" />
          <span>{settings.announcementBanner}</span>
        </div>
      )}

      {/* Top Bar: Clean 3-zone contract with English-first navigation */}
      <div className="max-w-7xl mx-auto px-6 h-20 sm:h-24 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Brand Logo + Site Name & Tagline */}
        <button
          onClick={() => setCurrentTab('store')}
          className="text-left group cursor-pointer focus:outline-none flex items-center gap-3.5 shrink-0"
          title={settings.siteName}
          aria-label={settings.siteName}
        >
          {settings.logoUrl ? (
            <div className="h-16 sm:h-[76px] max-w-[150px] flex items-center justify-center shrink-0">
              <img
                src={settings.logoUrl}
                alt={settings.siteName}
                className="h-16 sm:h-[76px] w-auto max-w-full object-contain filter drop-shadow-xs transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1B382B] to-[#2D5A46] flex items-center justify-center text-white shadow-sm border border-white/30 shrink-0">
              <span className="font-display font-bold text-base">
                {settings.siteName?.charAt(0)?.toUpperCase() || 'P'}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <span className="font-display text-base sm:text-xl tracking-[0.15em] font-bold text-[#18231C] group-hover:text-[#1B382B] transition-colors whitespace-nowrap block leading-tight">
              {settings.siteName.toUpperCase()}
            </span>
            <span className="text-[10px] sm:text-[11px] tracking-[0.06em] text-[#526058] font-sans-ui block leading-tight mt-0.5 truncate max-w-[190px] sm:max-w-[270px]">
              {settings.tagline || 'New Zealand Greenstone'}
            </span>
          </div>
        </button>

        {/* Zone 2: English-first clear navigation links */}
        <nav className="hidden lg:flex items-center gap-3 xl:gap-5 text-sm font-sans-ui font-medium text-[#526058]">
          <button
            onClick={() => setCurrentTab('store')}
            className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2.5 rounded-lg cursor-pointer ${
              currentTab === 'store'
                ? 'text-[#1B382B] font-semibold bg-white/70 shadow-xs border border-white'
                : 'hover:text-[#18231C] hover:bg-white/40'
            }`}
          >
            Collection
          </button>
          <button
            onClick={() => setCurrentTab('gallery')}
            className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2.5 rounded-lg cursor-pointer ${
              currentTab === 'gallery'
                ? 'text-[#1B382B] font-semibold bg-white/70 shadow-xs border border-white'
                : 'hover:text-[#18231C] hover:bg-white/40'
            }`}
          >
            Gallery
          </button>
          <button
            onClick={() => setCurrentTab('story')}
            className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2.5 rounded-lg cursor-pointer ${
              currentTab === 'story'
                ? 'text-[#1B382B] font-semibold bg-white/70 shadow-xs border border-white'
                : 'hover:text-[#18231C] hover:bg-white/40'
            }`}
          >
            About Jesse
          </button>
          <button
            onClick={() => setCurrentTab('custom')}
            className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'custom'
                ? 'text-[#1B382B] font-semibold bg-white/70 shadow-xs border border-white'
                : 'hover:text-[#18231C] hover:bg-white/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
            Custom Carvings
          </button>
          <button
            onClick={() => setCurrentTab('provenance')}
            className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2.5 rounded-lg cursor-pointer ${
              currentTab === 'provenance'
                ? 'text-[#1B382B] font-semibold bg-white/70 shadow-xs border border-white'
                : 'hover:text-[#18231C] hover:bg-white/40'
            }`}
          >
            Authenticity
          </button>
        </nav>

        {/* Zone 3: Account Login / Profile Dropdown & Cart */}
        <div className="flex items-center gap-3 shrink-0">
          {!currentUser ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-2 rounded-xl text-xs font-sans-ui font-semibold glass-panel text-[#18231C] hover:bg-white flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border border-[#E8E2D6]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#1B382B]" />
              <span>Login</span>
            </button>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className={`px-3.5 py-2 rounded-xl text-xs font-sans-ui font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'dashboard' || isMenuOpen
                    ? 'bg-[#1B382B] text-white shadow-sm'
                    : 'glass-panel text-[#18231C] hover:bg-white border border-[#E8E2D6]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    currentTab === 'dashboard' || isMenuOpen
                      ? 'bg-white/20 text-white'
                      : 'bg-[#1B382B]/10 text-[#1B382B]'
                  }`}
                >
                  <User className="w-3 h-3" />
                </span>
                <span>{currentUser.firstName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-2xl bg-white/95 backdrop-blur-xl border border-[#E8E2D6] shadow-xl py-2 z-50 text-xs font-sans-ui"
                >
                  <div className="px-4 py-2.5 border-b border-[#E8E2D6]/80 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#18231C] truncate">
                        {currentUser.firstName} {currentUser.lastName}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                          currentUser.role === 'ADMIN'
                            ? 'bg-[#1B382B] text-white'
                            : 'bg-[#2D5A46]/15 text-[#2D5A46]'
                        }`}
                      >
                        {currentUser.role === 'ADMIN' ? 'Admin' : 'Client'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#526058] truncate">{currentUser.email}</div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard(
                          currentUser.role === 'ADMIN' ? 'admin-kpis' : 'client-overview'
                        );
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-[#1B382B]" />
                      <span className="font-medium">Dashboard</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard('client-orders');
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-[#1B382B]" />
                      <span className="font-medium">Order History & Receipts</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard('client-tracking');
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 text-[#1B382B]" />
                      <span className="font-medium">Order Tracking</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard('client-wishlist');
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Heart className="w-3.5 h-3.5 text-[#A63A2A]" />
                        <span className="font-medium">Saved Wishlist</span>
                      </span>
                      {wishlistCount > 0 && (
                        <span className="font-mono text-[10px] font-bold text-[#1B382B]">
                          {wishlistCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard('client-gift-cards');
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5 text-[#1B382B]" />
                      <span className="font-medium">My Gift Cards</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDashboard('client-commissions');
                      }}
                      className="w-full px-4 py-2 text-left text-[#18231C] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                      <span className="font-medium">My Custom Requests</span>
                    </button>

                    {currentUser.role === 'ADMIN' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenDashboard('admin-kpis');
                        }}
                        className="w-full px-4 py-2 text-left text-[#1B382B] hover:bg-[#F7F5F0] flex items-center gap-2.5 cursor-pointer font-semibold"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2D5A46]" />
                        <span>Studio Admin Panel</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-1 border-t border-[#E8E2D6]/80">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-[#A63A2A] hover:bg-[#A63A2A]/10 flex items-center gap-2.5 cursor-pointer font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={openCart}
            className="relative px-4 py-2 text-xs font-sans-ui font-medium text-white bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-md hover:shadow-lg border border-white/20"
          >
            <ShoppingCart className="w-4 h-4 text-[#7FA892]" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="bg-[#C29B38] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full tabular-nums shadow-xs">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile subnavigation bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-white/60 px-4 py-2 bg-white/70 backdrop-blur-md text-xs font-sans-ui overflow-x-auto">
        <button
          onClick={() => setCurrentTab('store')}
          className={`py-1 px-2 whitespace-nowrap ${
            currentTab === 'store' ? 'text-[#1B382B] font-bold' : 'text-[#526058]'
          }`}
        >
          Collection
        </button>
        <button
          onClick={() => setCurrentTab('gallery')}
          className={`py-1 px-2 whitespace-nowrap ${
            currentTab === 'gallery' ? 'text-[#1B382B] font-bold' : 'text-[#526058]'
          }`}
        >
          Gallery
        </button>
        <button
          onClick={() => setCurrentTab('story')}
          className={`py-1 px-2 whitespace-nowrap ${
            currentTab === 'story' ? 'text-[#1B382B] font-bold' : 'text-[#526058]'
          }`}
        >
          About Jesse
        </button>
        <button
          onClick={() => setCurrentTab('custom')}
          className={`py-1 px-2 whitespace-nowrap ${
            currentTab === 'custom' ? 'text-[#1B382B] font-bold' : 'text-[#526058]'
          }`}
        >
          Custom
        </button>
        <button
          onClick={() => setCurrentTab('provenance')}
          className={`py-1 px-2 whitespace-nowrap ${
            currentTab === 'provenance' ? 'text-[#1B382B] font-bold' : 'text-[#526058]'
          }`}
        >
          Authenticity
        </button>
      </div>
    </header>
  );
};
