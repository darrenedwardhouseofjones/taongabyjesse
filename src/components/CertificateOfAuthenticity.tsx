import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Award,
  Camera,
  CheckCircle2,
  Download,
  FlipHorizontal2,
  Printer,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CertificateRecord, SiteSettings } from '../types';
import { generateCertificatePdf } from '../utils/certificatePdf';
import { apiFetch } from '../utils/api';
import { sanitizeSafeMediaUrl } from '../utils/url';
import { certificateOwnerCheckSchema, validateWithSchema } from '../validation/schemas';

export interface CertificateCardData {
  certificateNumber: string;
  productId?: string;
  authenticityCode: string;
  title: string;
  material: string;
  designType?: string;
  dimensions?: string;
  originRiver: string;
  permitRef?: string;
  carverName: string;
  image?: string;
  orderNumber?: string;
  issuedAt?: string;
  hasRecordedSale?: boolean;
}

interface CertificateOfAuthenticityProps {
  certificates: CertificateCardData[];
  settings: SiteSettings;
  orderNumber?: string;
  initialProductId?: string;
  initialVerifyResult?: 'UNCHECKED' | 'MATCHED' | 'MISMATCH';
  showOwnerVerification?: boolean;
  compactHeader?: boolean;
}

function resolveVerifyBaseUrl(settings: SiteSettings): string {
  if (settings.canonicalUrl && /^https?:\/\//i.test(settings.canonicalUrl.trim())) {
    return settings.canonicalUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://taongabyjesse.co.nz';
}

function toFullCertificateRecords(
  cards: CertificateCardData[],
  orderNumber?: string
): CertificateRecord[] {
  const nowIso = new Date().toISOString();
  return cards.map((card, index) => ({
    certificateNumber: card.certificateNumber || card.authenticityCode,
    orderId: orderNumber || card.orderNumber || 'studio-preview',
    orderNumber: card.orderNumber || orderNumber || 'STUDIO-CERT',
    productId: card.authenticityCode,
    itemIndex: index + 1,
    title: card.title,
    sku: card.authenticityCode,
    material: card.material as CertificateRecord['material'],
    designType: card.designType as CertificateRecord['designType'],
    dimensions: card.dimensions,
    authenticityCode: card.authenticityCode,
    originRiver: card.originRiver,
    permitRef: card.permitRef,
    carverName: card.carverName || 'Jesse',
    image: card.image || '',
    buyerName: '',
    buyerEmail: '',
    issuedAt: card.issuedAt || nowIso,
  }));
}

const CornerCropMarks: React.FC = () => (
  <>
    {/* Top-Left */}
    <span className="pointer-events-none absolute -top-2 -left-4 w-3 border-t border-[#9CA7A0]" />
    <span className="pointer-events-none absolute -top-4 -left-2 h-3 border-l border-[#9CA7A0]" />
    {/* Top-Right */}
    <span className="pointer-events-none absolute -top-2 -right-4 w-3 border-t border-[#9CA7A0]" />
    <span className="pointer-events-none absolute -top-4 -right-2 h-3 border-r border-[#9CA7A0]" />
    {/* Bottom-Left */}
    <span className="pointer-events-none absolute -bottom-2 -left-4 w-3 border-t border-[#9CA7A0]" />
    <span className="pointer-events-none absolute -bottom-4 -left-2 h-3 border-l border-[#9CA7A0]" />
    {/* Bottom-Right */}
    <span className="pointer-events-none absolute -bottom-2 -right-4 w-3 border-t border-[#9CA7A0]" />
    <span className="pointer-events-none absolute -bottom-4 -right-2 h-3 border-r border-[#9CA7A0]" />
  </>
);

interface CardFacesProps {
  card: CertificateCardData;
  qrDataUrl: string;
  verifyOrigin: string;
  ownerVerifyLabel?: string;
}

const CardFrontFace: React.FC<{ card: CertificateCardData; issuedStr: string }> = ({
  card,
  issuedStr,
}) => {
  const specsLine = [
    `${card.material} Pounamu`,
    card.designType || '',
    card.dimensions || '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="certificate-card-face relative bg-[#1B382B] text-white overflow-hidden select-none shadow-md"
      style={{ width: '90mm', height: '55mm', fontFamily: 'var(--font-sans)' }}
    >
      {/* Inner Gold Frame */}
      <div className="absolute inset-[2.2mm] border border-[#C29B38] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-[4.5mm] pt-[3.6mm] text-center">
        <div
          className="text-[11px] font-bold tracking-[0.2em] text-white leading-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          TAONGA BY JESSE
        </div>
        <div className="text-[6.5px] font-bold tracking-[0.16em] text-[#C29B38] mt-[1mm]">
          CERTIFICATE OF AUTHENTICITY &amp; PROVENANCE
        </div>
        <div className="mx-auto mt-[1.2mm] w-[58mm] border-b border-[#C29B38]/60" />
      </div>

      {/* Piece Metadata */}
      <div className="relative z-10 px-[5mm] pt-[2mm] text-center space-y-[0.8mm]">
        <div
          className="text-[10.5px] font-bold text-white leading-tight line-clamp-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {card.title}
        </div>
        <div className="text-[7.5px] text-[#DAE8E0] font-medium truncate">{specsLine}</div>
        <div className="text-[7.2px] text-[#DAE8E0] truncate">
          Origin: {card.originRiver} · Carver: {card.carverName || 'Jesse'} (Napier, NZ)
        </div>
        {card.permitRef && (
          <div className="text-[6.8px] font-semibold text-[#F0D486] truncate">
            DOC Permit: {card.permitRef}
          </div>
        )}
      </div>

      {/* Bottom Reference Band */}
      <div className="absolute left-[2.4mm] right-[2.4mm] bottom-[2.4mm] h-[9.2mm] bg-[#12241B] px-[3mm] py-[1.2mm] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 text-[7.5px] leading-none pt-[0.6mm]">
          <span className="font-mono font-bold text-[#F0D486]">
            CERT #: {card.certificateNumber}
          </span>
          <span className="text-[#C8DCD2] font-mono">
            Ngāi Tahu Ref: {card.authenticityCode}
          </span>
        </div>
        <div className="text-center text-[6.4px] text-[#B8CEC2] leading-none pb-[0.5mm]">
          {card.orderNumber ? `Order ${card.orderNumber} · ` : ''}Issued {issuedStr}
        </div>
      </div>
    </div>
  );
};

const CardBackFace: React.FC<CardFacesProps> = ({
  card,
  qrDataUrl,
  verifyOrigin,
  ownerVerifyLabel,
}) => {
  const shortHost = verifyOrigin.replace(/^https?:\/\//, '');
  return (
    <div
      className="certificate-card-face relative bg-[#FAF9F6] text-[#18231C] overflow-hidden select-none shadow-md"
      style={{ width: '90mm', height: '55mm', fontFamily: 'var(--font-sans)' }}
    >
      {/* Double Classic Frame */}
      <div className="absolute inset-[2.2mm] border-[1.2px] border-[#1B382B] pointer-events-none" />
      <div className="absolute inset-[3.1mm] border-[0.5px] border-[#C29B38] pointer-events-none" />

      <div className="relative z-10 h-full px-[5mm] pt-[5mm] pb-[6mm] flex gap-[3.5mm] items-start">
        {/* QR Code Column */}
        <div className="w-[27mm] shrink-0 flex flex-col items-center pt-[2.5mm]">
          <div className="w-[26mm] h-[26mm] bg-[#FAF9F6] border border-[#D8E2DC] p-[0.8mm] flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR verification code for ${card.certificateNumber}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-[7px] text-[#526058]">QR Loading</div>
            )}
          </div>
          <span className="mt-[1.2mm] text-[6.4px] font-bold tracking-[0.14em] text-[#1B382B]">
            SCAN TO VERIFY
          </span>
        </div>

        {/* Right Info & Verification Instructions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full pt-[0.5mm]">
          <div>
            <div
              className="text-[9.5px] font-bold text-[#1B382B] leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              TAONGA BY JESSE
            </div>
            <div className="text-[6.2px] font-bold tracking-[0.1em] text-[#8C6D1F]">
              AUTHENTICITY &amp; PHOTO REGISTRY
            </div>
            <ol className="mt-[1.4mm] space-y-[0.7mm] text-[6.4px] leading-[1.32] text-[#414E46]">
              <li>1. Scan QR or visit Provenance Registry with Certificate #.</li>
              <li>2. Match your stone grain to the studio photo on file.</li>
              <li>3. Confirm original buyer name or email to verify owner.</li>
            </ol>
          </div>

          <div className="bg-[#F0F4F1] border border-[#D2DCD6] px-[2.2mm] py-[1.3mm] space-y-[0.5mm]">
            <div className="font-mono font-bold text-[7px] text-[#1B382B] truncate">
              Cert #: {card.certificateNumber}
            </div>
            <div className="font-mono text-[6.5px] text-[#2D5A46] truncate">
              Provenance #: {card.authenticityCode}
            </div>
            {ownerVerifyLabel && (
              <div className="text-[6px] font-semibold text-[#1B382B] truncate border-t border-[#D2DCD6] pt-[0.4mm]">
                Owner Check: {ownerVerifyLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="absolute left-[4mm] right-[4mm] bottom-[3.6mm] text-center text-[6px] text-[#5F6C64] truncate">
        {shortHost} · Hand-Carved in Napier, NZ
      </div>
    </div>
  );
};

export const CertificateOfAuthenticity: React.FC<CertificateOfAuthenticityProps> = ({
  certificates,
  settings,
  orderNumber,
  initialProductId,
  initialVerifyResult = 'UNCHECKED',
  showOwnerVerification = true,
  compactHeader = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!initialProductId) return 0;
    const foundIdx = certificates.findIndex((c) => c.productId === initialProductId);
    return foundIdx >= 0 ? foundIdx : 0;
  });
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Owner Name / Email verification state
  const [ownerInput, setOwnerInput] = useState('');
  const [verifyingOwner, setVerifyingOwner] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'UNCHECKED' | 'MATCHED' | 'MISMATCH'>(
    initialVerifyResult
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedLabel, setVerifiedLabel] = useState<string>('');

  const verifyOrigin = useMemo(() => resolveVerifyBaseUrl(settings), [settings]);

  const activeCard = certificates[activeIndex] || certificates[0];

  useEffect(() => {
    if (!initialProductId) {
      setActiveIndex(0);
      return;
    }
    const foundIdx = certificates.findIndex((c) => c.productId === initialProductId);
    setActiveIndex(foundIdx >= 0 ? foundIdx : 0);
  }, [certificates, initialProductId]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('printing-certificate-cards');
      }
    };
  }, []);

  useEffect(() => {
    setVerifyStatus(initialVerifyResult);
    setOwnerInput('');
    setVerifyError(null);
    setVerifiedLabel('');
  }, [activeCard?.certificateNumber, activeCard?.authenticityCode, initialVerifyResult]);

  // Generate QR data URLs for all certificates in this deck (supports multi-card printing)
  useEffect(() => {
    let cancelled = false;
    const generateAllQrs = async () => {
      const nextMap: Record<string, string> = {};
      for (const card of certificates) {
        const lookupCode = card.certificateNumber || card.authenticityCode;
        const verifyUrl = `${verifyOrigin}/?tab=provenance&cert=${encodeURIComponent(lookupCode)}`;
        try {
          const dataUrl = await QRCode.toDataURL(verifyUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 260,
            color: { dark: '#1B382B', light: '#FAF9F6' },
          });
          nextMap[lookupCode] = dataUrl;
        } catch {
          // Ignore individual QR error
        }
      }
      if (!cancelled) {
        setQrMap(nextMap);
      }
    };
    void generateAllQrs();
    return () => {
      cancelled = true;
    };
  }, [certificates, verifyOrigin]);

  if (!activeCard) return null;

  const issuedStr = activeCard.issuedAt
    ? new Date(activeCard.issuedAt).toLocaleDateString('en-NZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-NZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const activeLookupKey = activeCard.certificateNumber || activeCard.authenticityCode;
  const activeQrDataUrl = qrMap[activeLookupKey] || '';
  const safePhoto = sanitizeSafeMediaUrl(activeCard.image);

  const handleVerifyOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    const parsed = validateWithSchema(certificateOwnerCheckSchema, {
      owner: ownerInput,
    });
    if (!parsed.success) {
      setVerifyError(parsed.error);
      return;
    }

    setVerifyingOwner(true);
    try {
      const res = await apiFetch<{
        verified: boolean;
        record: { buyerCheckStatus?: 'UNCHECKED' | 'MATCHED' | 'MISMATCH' } | null;
      }>(
        `/api/provenance/verify?code=${encodeURIComponent(
          activeLookupKey
        )}&buyer=${encodeURIComponent(parsed.data.owner)}`
      );
      const status = res.record?.buyerCheckStatus || 'MISMATCH';
      setVerifyStatus(status);
      if (status === 'MATCHED') {
        setVerifiedLabel('Collector Verified');
      } else {
        setVerifiedLabel('');
      }
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Unable to verify collector ownership right now.'
      );
    } finally {
      setVerifyingOwner(false);
    }
  };

  const handlePrintDoubleSided = () => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('printing-certificate-cards');
    const mediaQuery = window.matchMedia ? window.matchMedia('print') : null;
    const cleanup = () => {
      document.body.classList.remove('printing-certificate-cards');
      window.removeEventListener('afterprint', cleanup);
      mediaQuery?.removeEventListener?.('change', handleMediaChange);
    };
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        cleanup();
      }
    };
    window.addEventListener('afterprint', cleanup);
    mediaQuery?.addEventListener?.('change', handleMediaChange);
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await generateCertificatePdf(
        toFullCertificateRecords(certificates, orderNumber),
        settings,
        orderNumber
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const printPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="certificate-print-portal" aria-hidden="true">
            {certificates.map((card, idx) => {
              const cardKey = card.certificateNumber || card.authenticityCode;
              const cardIssued = card.issuedAt
                ? new Date(card.issuedAt).toLocaleDateString('en-NZ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : issuedStr;
              return (
                <React.Fragment key={`${cardKey}-${idx}`}>
                  {/* Page 2k+1: Front Face */}
                  <div className="certificate-print-page">
                    <div className="text-[10px] tracking-[0.14em] text-[#6E7872] mb-6 uppercase">
                      Taonga by Jesse · Certificate {idx + 1} of {certificates.length} · Front (90 × 55 mm)
                    </div>
                    <div className="relative inline-block">
                      <CornerCropMarks />
                      <CardFrontFace card={card} issuedStr={cardIssued} />
                    </div>
                    <div className="mt-8 text-[10px] text-[#6E7872]">
                      Print double-sided on heavy cardstock (Flip on Long Edge) and trim along the corner crop marks.
                    </div>
                  </div>

                  {/* Page 2k+2: Back Face at identical coordinates for duplex flip */}
                  <div className="certificate-print-page">
                    <div className="text-[10px] tracking-[0.14em] text-[#6E7872] mb-6 uppercase">
                      Taonga by Jesse · Certificate {idx + 1} of {certificates.length} · Back (90 × 55 mm)
                    </div>
                    <div className="relative inline-block">
                      <CornerCropMarks />
                      <CardBackFace
                        card={card}
                        qrDataUrl={qrMap[cardKey] || ''}
                        verifyOrigin={verifyOrigin}
                        ownerVerifyLabel={
                          cardKey === activeLookupKey && verifiedLabel ? verifiedLabel : undefined
                        }
                      />
                    </div>
                    <div className="mt-8 text-[10px] text-[#6E7872]">
                      Scan QR or enter {cardKey} at {verifyOrigin.replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-5">
      {printPortal}

      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E2D6]">
        <div>
          {!compactHeader && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#2D5A46] font-bold">
              Taonga by Jesse · Cardstock Authenticity Pass
            </div>
          )}
          <h3 className="font-display text-base sm:text-lg font-bold text-[#18231C] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#C29B38]" />
            <span>Printable Business-Card Certificate (90 × 55 mm)</span>
          </h3>
          <p className="text-[11px] text-[#526058]">
            Double-sided cardstock layout with corner trim guides, unique provenance ID, and QR code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'both' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              Front &amp; Back
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'front' ? 'back' : 'front')}
              className={`px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode !== 'both' ? 'bg-[#1B382B] text-white' : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              <FlipHorizontal2 className="w-3 h-3" />
              <span>{viewMode === 'back' ? 'Back' : 'Front'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintDoubleSided}
            className="px-3.5 py-2 border border-[#1B382B] bg-white text-[#1B382B] hover:bg-[#FAF9F6] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[#1B382B]" />
            <span>Print Double-Sided</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloadingPdf}
            className="px-3.5 py-2 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5 text-[#7FA892]" />
            <span>{downloadingPdf ? 'Generating...' : 'Download Card PDF'}</span>
          </button>
        </div>
      </div>

      {/* Multi-piece switcher if order has multiple certificates */}
      {certificates.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#526058] font-medium">Piece Card:</span>
          {certificates.map((c, idx) => (
            <button
              key={`${c.certificateNumber}-${idx}`}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border cursor-pointer transition-colors ${
                idx === activeIndex
                  ? 'bg-[#1B382B] text-[#F0D486] border-[#1B382B]'
                  : 'bg-white text-[#526058] border-[#E8E2D6] hover:border-[#1B382B]'
              }`}
            >
              #{idx + 1} · {c.certificateNumber}
            </button>
          ))}
        </div>
      )}

      {/* Business Card Visual Preview Canvas */}
      <div className="p-5 sm:p-7 rounded-2xl bg-[#F3EFE6] border border-[#E8E2D6] flex flex-wrap items-center justify-center gap-8 overflow-x-auto">
        {(viewMode === 'both' || viewMode === 'front') && (
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#526058]">
              Side 1 — Front (90 × 55 mm)
            </span>
            <div className="relative p-2">
              <CornerCropMarks />
              <CardFrontFace card={activeCard} issuedStr={issuedStr} />
            </div>
          </div>
        )}

        {(viewMode === 'both' || viewMode === 'back') && (
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#526058]">
              Side 2 — Back / Duplex Flip (90 × 55 mm)
            </span>
            <div className="relative p-2">
              <CornerCropMarks />
              <CardBackFace
                card={activeCard}
                qrDataUrl={activeQrDataUrl}
                verifyOrigin={verifyOrigin}
                ownerVerifyLabel={verifiedLabel || undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* Printing Tip Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6] text-[11px] text-[#526058] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2D5A46] shrink-0" />
          <span>
            <strong>Duplex Print Setup:</strong> Choose A4 paper at 100% scale with{' '}
            <em>Two-Sided · Flip on Long Edge</em> and enable background graphics; trim cleanly along the corner crop marks.
          </span>
        </div>
      </div>

      {/* Built-In Owner Name / Email Verification + Visual Studio Photo Comparison */}
      {showOwnerVerification && (
        <div className="p-4 sm:p-5 rounded-2xl border border-[#D8E2DC] bg-[#F7F9F8] grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {safePhoto && (
            <div className="md:col-span-3">
              <div className="relative rounded-xl overflow-hidden border border-[#E8E2D6] bg-white">
                <img
                  src={safePhoto}
                  alt={activeCard.title}
                  className="w-full h-28 object-cover"
                />
                <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-[#18231C]/80 text-white text-[9px] font-semibold inline-flex items-center gap-1">
                  <Camera className="w-2.5 h-2.5 text-[#C29B38]" />
                  <span>Studio Reference</span>
                </div>
              </div>
            </div>
          )}

          <div className={`${safePhoto ? 'md:col-span-9' : 'md:col-span-12'} space-y-2.5`}>
            <div className="flex items-center gap-2 font-display font-bold text-xs text-[#18231C]">
              <UserCheck className="w-4 h-4 text-[#1B382B]" />
              <span>Owner Name / Email Authenticity Check</span>
            </div>
            <p className="text-[11px] text-[#526058] leading-relaxed">
              Owners and collectors can confirm this card is genuinely tied to the piece’s recorded sale by entering the original buyer’s name or checkout email.
            </p>

            {activeCard.hasRecordedSale === false ? (
              <div className="p-2.5 rounded-xl bg-white border border-[#E8E2D6] text-[11px] text-[#526058]">
                This catalogue preview shows the provenance registration (<span className="font-mono font-semibold">{activeCard.authenticityCode}</span>). Collector name/email binding activates automatically once an order is completed.
              </div>
            ) : (
              <form onSubmit={handleVerifyOwner} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="Enter buyer name or checkout email..."
                  aria-label="Owner name or email for authenticity verification"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-[#D8E2DC] bg-white rounded-xl text-xs focus:outline-none focus:border-[#1B382B]"
                />
                <button
                  type="submit"
                  disabled={verifyingOwner || !ownerInput.trim()}
                  className="px-4 py-2 bg-[#1B382B] hover:bg-[#12241B] text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {verifyingOwner ? 'Verifying...' : 'Verify Owner'}
                </button>
              </form>
            )}

            {verifyError && (
              <div className="text-[11px] text-[#A63A2A] font-medium">{verifyError}</div>
            )}

            {verifyStatus === 'MATCHED' && (
              <div className="p-2.5 rounded-xl bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] text-[11px] flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
                <span>
                  Authentic Owner Confirmed: Name or email matches certificate{' '}
                  <span className="font-mono font-bold">{activeLookupKey}</span>.
                </span>
              </div>
            )}

            {verifyStatus === 'MISMATCH' && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  Name or email did not match our recorded sale for{' '}
                  <span className="font-mono font-bold">{activeLookupKey}</span>. Verify spelling or contact Taonga by Jesse if purchasing second-hand.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface CertificatePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificates: CertificateCardData[];
  settings: SiteSettings;
  orderNumber?: string;
  initialProductId?: string;
}

export const CertificatePrintModal: React.FC<CertificatePrintModalProps> = ({
  isOpen,
  onClose,
  certificates,
  settings,
  orderNumber,
  initialProductId,
}) => {
  if (!isOpen || certificates.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111C16]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Printable Certificate of Authenticity"
    >
      <div className="bg-white rounded-3xl border border-[#E8E2D6] shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#2D5A46]">
            {orderNumber ? `Order ${orderNumber} · Box Insert Card` : 'Taonga by Jesse · Studio Card'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close certificate preview"
            className="p-1.5 rounded-lg text-[#526058] hover:text-[#18231C] hover:bg-[#FAF9F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CertificateOfAuthenticity
          certificates={certificates}
          settings={settings}
          orderNumber={orderNumber}
          initialProductId={initialProductId}
          compactHeader
        />
      </div>
    </div>
  );
};
