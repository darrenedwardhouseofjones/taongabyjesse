import React from 'react';
import { ShieldCheck, MapPin, Mail, Phone } from 'lucide-react';
import { PolicySectionKey, SiteSettings } from '../types';
import type { AppTab } from './Navbar';

interface FooterProps {
  onNavigate: (tab: AppTab, policySection?: PolicySectionKey) => void;
  settings: SiteSettings;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, settings }) => {
  return (
    <footer className="relative bg-[#12241B] text-[#FAF9F6] border-t border-white/10 overflow-hidden">
      {/* Subtle Opaque Texture in Footer */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-5 bg-cover bg-center"
        style={{
          backgroundImage: `url('/src/assets/images/hero_pounamu_river_1794468029445.jpg')`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-xs font-sans-ui">
          {/* Brand & Carver */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-4">
              {settings.logoUrl && (
                <div className="h-20 sm:h-24 max-w-[160px] flex items-center justify-center shrink-0">
                  <img
                    src={settings.logoUrl}
                    alt={settings.siteName}
                    className="h-20 sm:h-24 w-auto max-w-full object-contain drop-shadow-md"
                  />
                </div>
              )}
              <div>
                <span className="font-display text-xl sm:text-2xl tracking-[0.18em] font-bold text-white block leading-tight">
                  {settings.siteName.toUpperCase()}
                </span>
                {settings.tagline && (
                  <span className="text-[11px] tracking-[0.06em] text-[#7FA892] font-sans-ui block mt-1">
                    {settings.tagline}
                  </span>
                )}
              </div>
            </div>
            <p className="font-serif-body text-sm text-[#E8E2D6] leading-relaxed italic max-w-sm">
              "He taonga nō te whenua, he tohu nō te wairua."
              <br />
              Sacred treasures sculpted from the glacial river stones of Te Wai Pounamu (New Zealand’s South Island), hand-carved in Napier, Hawke’s Bay by artisan Jesse.
            </p>
            <div className="space-y-1.5 text-[#7FA892]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>{settings.workshopAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                <span>{settings.contactEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" />
                <span>{settings.contactPhone}</span>
              </div>
            </div>
          </div>

          {/* Navigation with English clarity */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#7FA892]">
              Explore Atelier
            </h4>
            <ul className="space-y-2 text-[#E8E2D6]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('store')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Greenstone Collection
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('gallery')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Past &amp; Present Gallery
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('story')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About Jesse
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('custom')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Custom Carving Studio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('provenance')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Authenticity &amp; Origin
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('gift-cards')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Digital Gift Cards
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('orders')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Order Tracking
                </button>
              </li>
            </ul>
          </div>

          {/* Cultural & Legal Notice */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#7FA892] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C29B38]" />
              Authenticity &amp; Legal Protection
            </h4>
            <p className="text-[#E8E2D6] leading-relaxed text-[11px]">
              {settings.authenticityPolicyText}
            </p>
            <div className="text-[11px] text-[#7FA892]">
              GST Registration: <strong>{settings.gstNumber}</strong> · 15% NZ GST Included in All Stated Prices · {settings.returnPolicyDays}-Day Returns
            </div>
            <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#E8E2D6]">
              <button
                type="button"
                onClick={() => onNavigate('policies', 'terms')}
                className="underline decoration-[#7FA892]/60 hover:text-white cursor-pointer"
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => onNavigate('policies', 'privacy')}
                className="underline decoration-[#7FA892]/60 hover:text-white cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => onNavigate('policies', 'shipping')}
                className="underline decoration-[#7FA892]/60 hover:text-white cursor-pointer"
              >
                Shipping &amp; Returns
              </button>
              <button
                type="button"
                onClick={() => onNavigate('policies', 'custom')}
                className="underline decoration-[#7FA892]/60 hover:text-white cursor-pointer"
              >
                Custom Commission Terms
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#7FA892] font-sans-ui">
          <div className="text-[#E8E2D6]/70">
            © {new Date().getFullYear()} {settings.siteName} · All rights reserved · Handcrafted in Aotearoa New Zealand
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="text-[#7FA892] hover:text-white transition-colors cursor-pointer"
            >
              Client &amp; Member Dashboard
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('policies', 'terms')}
              className="text-[#7FA892] hover:text-white transition-colors cursor-pointer"
            >
              Terms
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('policies', 'privacy')}
              className="text-[#7FA892] hover:text-white transition-colors cursor-pointer"
            >
              Privacy Act 2020
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
