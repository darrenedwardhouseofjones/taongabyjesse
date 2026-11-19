import React, { useEffect, useState } from 'react';
import {
  FileText,
  Lock,
  Truck,
  Sparkles,
  ShieldCheck,
  Mail,
  MapPin,
  Phone,
  Edit3,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { PolicySectionKey, SiteSettings } from '../types';
import { DEFAULT_SITE_SETTINGS } from '../utils/defaults';

interface PoliciesViewProps {
  settings: SiteSettings;
  initialSection?: PolicySectionKey;
  isAdmin?: boolean;
  onBackToStore?: () => void;
  onOpenAdminSettings?: () => void;
}

interface PolicyDocumentMeta {
  key: PolicySectionKey;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  content: string;
}

function renderFormattedPolicyText(rawText: string) {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return (
      <p className="text-sm text-[#526058] italic">
        No policy content has been published for this section yet.
      </p>
    );
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        const lines = block
          .split('\n')
          .map((l) => l.trimEnd())
          .filter((l) => l.trim().length > 0);

        if (lines.length === 0) return null;

        const firstLine = lines[0].trim();
        const isNumberedOrTitled =
          /^\d+\.\s+/.test(firstLine) ||
          (lines.length > 1 && firstLine.length <= 90 && !/[.;]$/.test(firstLine));

        if (isNumberedOrTitled && lines.length > 1) {
          const bodyLines = lines.slice(1);
          const bulletLines = bodyLines.filter((l) => /^[-•*]\s+/.test(l.trim()));
          const hasBullets = bulletLines.length === bodyLines.length && bulletLines.length > 0;

          return (
            <section key={idx} className="space-y-2.5">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#18231C]">
                {firstLine}
              </h3>
              {hasBullets ? (
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#39483F] leading-relaxed">
                  {bodyLines.map((line, lIdx) => (
                    <li key={lIdx}>{line.trim().replace(/^[-•*]\s+/, '')}</li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2 text-sm text-[#39483F] leading-relaxed">
                  {bodyLines.map((line, lIdx) => (
                    <p key={lIdx}>{line.trim()}</p>
                  ))}
                </div>
              )}
            </section>
          );
        }

        const allBullets = lines.every((l) => /^[-•*]\s+/.test(l.trim()));
        if (allBullets) {
          return (
            <ul
              key={idx}
              className="list-disc pl-5 space-y-1.5 text-sm text-[#39483F] leading-relaxed"
            >
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{line.trim().replace(/^[-•*]\s+/, '')}</li>
              ))}
            </ul>
          );
        }

        return (
          <div key={idx} className="space-y-2 text-sm text-[#39483F] leading-relaxed">
            {lines.map((line, lIdx) => (
              <p key={lIdx}>{line.trim()}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  settings,
  initialSection = 'terms',
  isAdmin = false,
  onBackToStore,
  onOpenAdminSettings,
}) => {
  const [activeSection, setActiveSection] = useState<PolicySectionKey>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const documents: PolicyDocumentMeta[] = [
    {
      key: 'terms',
      title: 'Terms & Conditions',
      subtitle: 'Store terms, Consumer Guarantees Act 1993 & NZD GST',
      badge: 'Statutory Compliance',
      icon: <FileText className="w-4 h-4" />,
      content:
        settings.termsAndConditionsText || DEFAULT_SITE_SETTINGS.termsAndConditionsText,
    },
    {
      key: 'privacy',
      title: 'Privacy Policy',
      subtitle: 'NZ Privacy Act 2020, IPP 12 & PCI SAQ A card security',
      badge: 'Privacy Act 2020',
      icon: <Lock className="w-4 h-4" />,
      content: settings.privacyPolicyText || DEFAULT_SITE_SETTINGS.privacyPolicyText,
    },
    {
      key: 'shipping',
      title: 'Shipping & Returns',
      subtitle: `${settings.returnPolicyDays}-day returns, couriers & DOC export rules`,
      badge: `${settings.returnPolicyDays}-Day Returns`,
      icon: <Truck className="w-4 h-4" />,
      content:
        settings.shippingAndReturnsPolicyText ||
        DEFAULT_SITE_SETTINGS.shippingAndReturnsPolicyText,
    },
    {
      key: 'custom',
      title: 'Custom Commissions',
      subtitle: 'Bespoke carving quotes, slab cutting & deposits',
      badge: 'Atelier Terms',
      icon: <Sparkles className="w-4 h-4" />,
      content:
        settings.customCommissionsPolicyText ||
        DEFAULT_SITE_SETTINGS.customCommissionsPolicyText,
    },
    {
      key: 'authenticity',
      title: 'Authenticity & Provenance',
      subtitle: 'Ngāi Tahu (Pounamu Vesting) Act 1997 & traceability',
      badge: 'Ngāi Tahu Act 1997',
      icon: <ShieldCheck className="w-4 h-4" />,
      content:
        settings.authenticityPolicyText || DEFAULT_SITE_SETTINGS.authenticityPolicyText,
    },
  ];

  const activeDoc = documents.find((d) => d.key === activeSection) || documents[0];

  const updatedLabel = settings.legalNoticeUpdatedAt
    ? new Date(settings.legalNoticeUpdatedAt).toLocaleDateString('en-NZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Current Studio Edition';

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E8E2D6] pb-8">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-sans-ui font-bold uppercase tracking-[0.18em] text-[#2D5A46]">
            <span>Atelier Legal &amp; Policy Directory</span>
            <span aria-hidden="true">·</span>
            <span>NZ GST {settings.gstNumber}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#18231C]">
            Terms, Privacy &amp; Studio Policies
          </h1>
          <p className="text-sm text-[#526058] leading-relaxed">
            Clear, transparent policies governing purchases, bespoke commissions, tracked courier delivery, and personal data stewardship at{' '}
            <strong className="text-[#18231C]">{settings.siteName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onBackToStore && (
            <button
              type="button"
              onClick={onBackToStore}
              className="px-4 py-2 rounded-xl border border-[#E8E2D6] bg-white text-xs font-sans-ui font-semibold text-[#18231C] hover:border-[#1B382B] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Collection
            </button>
          )}
          {isAdmin && onOpenAdminSettings && (
            <button
              type="button"
              onClick={onOpenAdminSettings}
              className="px-4 py-2 rounded-xl bg-[#1B382B] text-white text-xs font-sans-ui font-semibold hover:bg-[#2D5A46] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Policies in Admin
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Document Navigation + Active Policy Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation Column */}
        <aside className="lg:col-span-4 space-y-4">
          <nav
            aria-label="Policy Documents"
            className="bg-white rounded-2xl border border-[#E8E2D6] p-2.5 space-y-1.5 shadow-xs"
          >
            {documents.map((doc) => {
              const isSelected = doc.key === activeDoc.key;
              return (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setActiveSection(doc.key)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-[#1B382B] text-white shadow-sm'
                      : 'text-[#18231C] hover:bg-[#F7F5F0]'
                  }`}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${
                      isSelected ? 'text-[#7FA892]' : 'text-[#2D5A46]'
                    }`}
                  >
                    {doc.icon}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-display text-sm font-bold leading-snug">
                      {doc.title}
                    </div>
                    <div
                      className={`text-[11px] leading-snug ${
                        isSelected ? 'text-[#E8E2D6]/90' : 'text-[#526058]'
                      }`}
                    >
                      {doc.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Studio Privacy & Consumer Rights Quick Contact */}
          <div className="bg-[#F7F9F8] rounded-2xl border border-[#D8E2DC] p-5 space-y-3 text-xs">
            <h2 className="font-display text-sm font-bold text-[#18231C]">
              Privacy &amp; Consumer Inquiries
            </h2>
            <p className="text-[#526058] leading-relaxed">
              To request access or correction under the Privacy Act 2020, report a courier issue, or arrange a return within {settings.returnPolicyDays} days, reach our workshop directly:
            </p>
            <div className="space-y-2 pt-1 text-[#18231C]">
              <a
                href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(
                  `[${settings.siteName}] Policy / Privacy Inquiry`
                )}`}
                className="flex items-center gap-2 font-semibold text-[#1B382B] hover:underline break-all"
              >
                <Mail className="w-3.5 h-3.5 text-[#2D5A46] shrink-0" />
                <span>{settings.contactEmail}</span>
              </a>
              <div className="flex items-center gap-2 text-[#526058]">
                <Phone className="w-3.5 h-3.5 text-[#2D5A46] shrink-0" />
                <span>{settings.contactPhone}</span>
              </div>
              <div className="flex items-start gap-2 text-[#526058]">
                <MapPin className="w-3.5 h-3.5 text-[#2D5A46] shrink-0 mt-0.5" />
                <span>{settings.workshopAddress}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Policy Article Card */}
        <article className="lg:col-span-8 bg-white rounded-3xl border border-[#E8E2D6] p-6 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E2D6] pb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-sans-ui font-bold uppercase tracking-wider text-[#2D5A46]">
                {activeDoc.icon}
                <span>{activeDoc.badge}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#18231C]">
                {activeDoc.title}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-[#526058] bg-[#FAF9F6] border border-[#E8E2D6] px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-[#2D5A46]" />
              <span>Updated: {updatedLabel}</span>
            </div>
          </div>

          <div className="font-sans-ui">{renderFormattedPolicyText(activeDoc.content)}</div>
        </article>
      </div>
    </div>
  );
};
