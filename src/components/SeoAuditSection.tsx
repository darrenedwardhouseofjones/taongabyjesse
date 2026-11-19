import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  ExternalLink,
  RotateCcw,
  Globe,
  Tag,
  FileCode2,
  X,
} from 'lucide-react';
import { GalleryItem, PageSeoMetadata, Product, SiteSettings } from '../types';
import { apiFetch } from '../utils/api';

interface ParsedSitemapEntry {
  loc: string;
  pageKey: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  imageCount: number;
}

interface ResolvedAuditRow extends ParsedSitemapEntry {
  category:
    | 'Homepage'
    | 'Active Product'
    | 'Gallery Piece'
    | 'Archive Piece'
    | 'Studio Page';
  label: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  isCustomized: boolean;
  updatedAt?: string;
  descHealth: 'optimal' | 'short' | 'long' | 'missing';
  hasKeywordsWarning: boolean;
  defaultMeta: {
    seoTitle: string;
    metaDescription: string;
    keywords: string;
  };
}

interface SeoAuditSectionProps {
  settings: SiteSettings;
  products: Product[];
  galleryItems: GalleryItem[];
  pageSeoMetadata: PageSeoMetadata[];
  onPageSeoChange: (nextList: PageSeoMetadata[], updatedSettings?: SiteSettings) => void;
}

function normalizePageKey(rawLoc: string): string {
  try {
    const parsed = new URL(rawLoc, window.location.origin);
    return `${parsed.pathname || '/'}${parsed.search || ''}` || '/';
  } catch {
    return rawLoc.startsWith('/') ? rawLoc : `/${rawLoc}`;
  }
}

function parseSitemapXml(xmlText: string): ParsedSitemapEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse sitemap.xml returned by server.');
  }

  const urlNodes = Array.from(doc.getElementsByTagName('url'));
  const entries: ParsedSitemapEntry[] = [];
  for (const node of urlNodes) {
    const loc = node.getElementsByTagName('loc')[0]?.textContent?.trim() || '';
    if (!loc) continue;
    const lastmod = node.getElementsByTagName('lastmod')[0]?.textContent?.trim() || undefined;
    const changefreq =
      node.getElementsByTagName('changefreq')[0]?.textContent?.trim() || undefined;
    const priority = node.getElementsByTagName('priority')[0]?.textContent?.trim() || undefined;
    const imageNodes = Array.from(node.getElementsByTagName('*')).filter(
      (el) => el.tagName.endsWith(':image') || el.localName === 'image'
    );
    entries.push({
      loc,
      pageKey: normalizePageKey(loc),
      lastmod,
      changefreq,
      priority,
      imageCount: imageNodes.length,
    });
  }
  return entries;
}

function evaluateDescriptionHealth(desc: string): 'optimal' | 'short' | 'long' | 'missing' {
  const len = desc.trim().length;
  if (len === 0) return 'missing';
  if (len < 120) return 'short';
  if (len > 160) return 'long';
  return 'optimal';
}

export const SeoAuditSection: React.FC<SeoAuditSectionProps> = ({
  settings,
  products,
  galleryItems,
  pageSeoMetadata,
  onPageSeoChange,
}) => {
  const [sitemapEntries, setSitemapEntries] = useState<ParsedSitemapEntry[]>([]);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [regeneratingSitemap, setRegeneratingSitemap] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'ISSUES' | 'CUSTOMIZED'>('ALL');

  const [editingPageKey, setEditingPageKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftKeywords, setDraftKeywords] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const fetchAndAuditSitemap = useCallback(async () => {
    setLoadingSitemap(true);
    setFetchError(null);
    try {
      const res = await fetch(`/sitemap.xml?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch sitemap.xml (HTTP ${res.status})`);
      }
      const xmlText = await res.text();
      const parsed = parseSitemapXml(xmlText);
      setSitemapEntries(parsed);
      setLastFetchedAt(new Date().toISOString());

      // Refresh persisted page SEO overrides from SQLite
      const seoRes = await apiFetch<{ pageSeoMetadata: PageSeoMetadata[] }>('/api/admin/seo-audit');
      onPageSeoChange(seoRes.pageSeoMetadata || []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unable to fetch sitemap.xml');
    } finally {
      setLoadingSitemap(false);
    }
  }, [onPageSeoChange]);

  useEffect(() => {
    void fetchAndAuditSitemap();
  }, []);

  const handleRegenerateAndAudit = async () => {
    setRegeneratingSitemap(true);
    setFetchError(null);
    try {
      await apiFetch('/api/sitemap/regenerate', { method: 'POST' });
      await fetchAndAuditSitemap();
      setSaveFeedback('Regenerated public/sitemap.xml and re-audited all indexed URLs.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to regenerate sitemap.xml');
    } finally {
      setRegeneratingSitemap(false);
    }
  };

  const computeDefaultsForEntry = useCallback(
    (
      entry: ParsedSitemapEntry
    ): {
      category: ResolvedAuditRow['category'];
      label: string;
      defaultMeta: { seoTitle: string; metaDescription: string; keywords: string };
    } => {
      const url = new URL(entry.pageKey, 'https://pounamuatelier.co.nz');
      const tab = url.searchParams.get('tab');
      const productId = url.searchParams.get('product');
      const pieceId = url.searchParams.get('piece');

      if (productId) {
        const prod = products.find((p) => p.id === productId);
        if (prod) {
          const desc = (prod.description || prod.spiritualMeaning || '').trim();
          const trimmedDesc =
            desc.length > 157 ? `${desc.slice(0, 154).trimEnd()}...` : desc;
          return {
            category: 'Active Product',
            label: prod.title,
            defaultMeta: {
              seoTitle: `${prod.title} — ${settings.siteName}`,
              metaDescription: trimmedDesc,
              keywords: `${prod.material} pounamu, ${prod.designType}, ${prod.originRiver}, NZ greenstone pendant, ${prod.authenticityCode}`,
            },
          };
        }
      }

      if (pieceId) {
        const gallery = galleryItems.find((g) => g.id === pieceId);
        if (gallery) {
          const desc = (
            gallery.description ||
            gallery.storyNote ||
            `${gallery.material} ${gallery.designType} carved by Jesse in ${gallery.carvedYear}.`
          ).trim();
          const trimmedDesc =
            desc.length > 157 ? `${desc.slice(0, 154).trimEnd()}...` : desc;
          return {
            category: 'Gallery Piece',
            label: gallery.title,
            defaultMeta: {
              seoTitle: `${gallery.title} (${gallery.carvedYear}) — Past Carvings`,
              metaDescription: trimmedDesc,
              keywords: `${gallery.material} pounamu, ${gallery.designType} carving, ${gallery.originRiver}, custom NZ jade`,
            },
          };
        }
        const retiredProd = products.find((p) => p.id === pieceId);
        if (retiredProd) {
          const desc = (retiredProd.description || '').trim();
          const trimmedDesc =
            desc.length > 157 ? `${desc.slice(0, 154).trimEnd()}...` : desc;
          return {
            category: 'Archive Piece',
            label: retiredProd.title,
            defaultMeta: {
              seoTitle: `${retiredProd.title} — Studio Archive`,
              metaDescription: trimmedDesc,
              keywords: `${retiredProd.material} pounamu archive, ${retiredProd.designType}, bespoke greenstone carving`,
            },
          };
        }
      }

      if (tab === 'gallery') {
        return {
          category: 'Studio Page',
          label: 'Past & Present Carvings Gallery',
          defaultMeta: {
            seoTitle: `Past & Present Pounamu Carvings — ${settings.siteName}`,
            metaDescription:
              'Browse past and present New Zealand greenstone carvings sculpted by Jesse in Napier and request a custom taonga inspired by archive pieces.',
            keywords:
              'pounamu gallery, past NZ greenstone carvings, Koru, Toki, Pikorua, custom taonga inspiration',
          },
        };
      }
      if (tab === 'custom') {
        return {
          category: 'Studio Page',
          label: 'Custom Carving Studio & Bespoke Quotes',
          defaultMeta: {
            seoTitle: `Custom Pounamu Carving Studio — ${settings.siteName}`,
            metaDescription:
              'Commission a bespoke New Zealand pounamu pendant carved by Jesse. Choose your river stone, traditional motif, size, and hand-plaited cord.',
            keywords:
              'custom pounamu carving, commission NZ greenstone, bespoke Toki pendant, custom Koru jade',
          },
        };
      }
      if (tab === 'story') {
        return {
          category: 'Studio Page',
          label: 'About Jesse & Studio Story',
          defaultMeta: {
            seoTitle: `About Carver Jesse & Hawke's Bay Studio — ${settings.siteName}`,
            metaDescription:
              'Meet Hawke’s Bay stone carver Jesse in Napier and discover the tikanga, tools, and South Island river provenance behind every taonga.',
            keywords:
              'Jesse pounamu carver, Napier greenstone studio, NZ artisan jade carving, Te Wai Pounamu',
          },
        };
      }
      if (tab === 'provenance') {
        return {
          category: 'Studio Page',
          label: 'Authenticity & Ngāi Tahu Provenance',
          defaultMeta: {
            seoTitle: `Ngāi Tahu Pounamu Provenance & Verification — ${settings.siteName}`,
            metaDescription:
              'Verify your Ngāi Tahu traceability code and learn how Pounamu Atelier honours the Ngāi Tahu Pounamu Vesting Act 1997.',
            keywords:
              'Ngāi Tahu pounamu verification, authenticity code, NZ greenstone provenance, genuine Te Wai Pounamu',
          },
        };
      }
      if (tab === 'policies') {
        return {
          category: 'Studio Page',
          label: 'Terms, Privacy Act 2020 & Returns Policies',
          defaultMeta: {
            seoTitle: `Terms, Privacy Policy & Returns — ${settings.siteName}`,
            metaDescription:
              'Read Pounamu Atelier’s Terms & Conditions, NZ Privacy Act 2020 statement, tracked courier shipping rules, and 30-day return policy.',
            keywords:
              'Pounamu Atelier terms, NZ Privacy Act 2020, Consumer Guarantees Act, greenstone shipping returns',
          },
        };
      }

      return {
        category: 'Homepage',
        label: 'Atelier Home & Storefront',
        defaultMeta: {
          seoTitle: settings.seoTitle || `${settings.siteName} — Authentic NZ Greenstone`,
          metaDescription: settings.seoDescription || settings.tagline || '',
          keywords: settings.seoKeywords || '',
        },
      };
    },
    [galleryItems, products, settings]
  );

  const auditRows: ResolvedAuditRow[] = useMemo(() => {
    return sitemapEntries.map((entry) => {
      const { category, label, defaultMeta } = computeDefaultsForEntry(entry);
      const override = pageSeoMetadata.find((o) => o.pageKey === entry.pageKey);

      const seoTitle = override ? override.seoTitle : defaultMeta.seoTitle;
      const metaDescription = override
        ? override.metaDescription
        : defaultMeta.metaDescription;
      const keywords = override ? override.keywords : defaultMeta.keywords;

      return {
        ...entry,
        category,
        label,
        seoTitle,
        metaDescription,
        keywords,
        isCustomized: Boolean(override),
        updatedAt: override?.updatedAt,
        descHealth: evaluateDescriptionHealth(metaDescription),
        hasKeywordsWarning: keywords.trim().length === 0,
        defaultMeta,
      };
    });
  }, [computeDefaultsForEntry, pageSeoMetadata, sitemapEntries]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return auditRows.filter((row) => {
      if (
        auditFilter === 'ISSUES' &&
        row.descHealth === 'optimal' &&
        !row.hasKeywordsWarning
      ) {
        return false;
      }
      if (auditFilter === 'CUSTOMIZED' && !row.isCustomized) {
        return false;
      }
      if (q) {
        const hay =
          `${row.pageKey} ${row.label} ${row.seoTitle} ${row.metaDescription} ${row.keywords}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditFilter, auditRows, searchQuery]);

  const metrics = useMemo(() => {
    const total = auditRows.length;
    const optimal = auditRows.filter((r) => r.descHealth === 'optimal').length;
    const needsAttention = auditRows.filter(
      (r) => r.descHealth !== 'optimal' || r.hasKeywordsWarning
    ).length;
    const customized = auditRows.filter((r) => r.isCustomized).length;
    return { total, optimal, needsAttention, customized };
  }, [auditRows]);

  const openEditor = (row: ResolvedAuditRow) => {
    if (editingPageKey === row.pageKey) {
      setEditingPageKey(null);
      return;
    }
    setEditingPageKey(row.pageKey);
    setDraftTitle(row.seoTitle);
    setDraftDescription(row.metaDescription);
    setDraftKeywords(row.keywords);
  };

  const handleSaveRowEdit = async (e: React.FormEvent, row: ResolvedAuditRow) => {
    e.preventDefault();
    setSavingEdit(true);
    setFetchError(null);
    try {
      const res = await apiFetch<{
        entry: PageSeoMetadata;
        settings: SiteSettings;
        pageSeoMetadata: PageSeoMetadata[];
      }>('/api/admin/seo-audit', {
        method: 'PUT',
        body: JSON.stringify({
          pageKey: row.pageKey,
          seoTitle: draftTitle.trim(),
          metaDescription: draftDescription.trim(),
          keywords: draftKeywords.trim(),
        }),
      });
      onPageSeoChange(
        res.pageSeoMetadata,
        row.pageKey === '/' ? res.settings : undefined
      );
      setEditingPageKey(null);
      setSaveFeedback(`Saved SEO metadata for "${row.pageKey}" to SQLite.`);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to save page SEO metadata.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetRow = async (row: ResolvedAuditRow) => {
    setSavingEdit(true);
    setFetchError(null);
    try {
      const res = await apiFetch<{ pageSeoMetadata: PageSeoMetadata[] }>(
        `/api/admin/seo-audit?pageKey=${encodeURIComponent(row.pageKey)}`,
        { method: 'DELETE' }
      );
      onPageSeoChange(res.pageSeoMetadata);
      setDraftTitle(row.defaultMeta.seoTitle);
      setDraftDescription(row.defaultMeta.metaDescription);
      setDraftKeywords(row.defaultMeta.keywords);
      setSaveFeedback(`Reset "${row.pageKey}" back to automatic catalogue metadata.`);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to reset page metadata.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header & Sitemap Fetch Controls */}
      <div className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E8E2D6] pb-4">
          <div className="space-y-1 max-w-2xl">
            <h3 className="font-display text-lg font-bold text-[#18231C] flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-[#1B382B]" />
              Live Sitemap SEO Audit (
              <code className="font-mono text-xs bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E8E2D6]">
                /sitemap.xml
              </code>
              )
            </h3>
            <p className="text-xs text-[#526058] leading-relaxed">
              Fetches the live XML sitemap, audits every indexed storefront, gallery, and product URL against optimal SEO lengths (120–160 chars meta description, targeted keywords), and lets you click any row to edit and persist metadata in SQLite.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingSitemap || regeneratingSitemap}
              onClick={() => void fetchAndAuditSitemap()}
              className="px-3.5 py-2 border border-[#E8E2D6] bg-[#FAF9F6] hover:border-[#1B382B] text-[#18231C] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSitemap ? 'animate-spin' : ''}`} />
              <span>{loadingSitemap ? 'Fetching XML...' : 'Fetch & Audit sitemap.xml'}</span>
            </button>
            <button
              type="button"
              disabled={loadingSitemap || regeneratingSitemap}
              onClick={() => void handleRegenerateAndAudit()}
              className="px-3.5 py-2 bg-[#1B382B] hover:bg-[#2D5A46] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Globe className={`w-3.5 h-3.5 text-[#7FA892] ${regeneratingSitemap ? 'animate-spin' : ''}`} />
              <span>{regeneratingSitemap ? 'Rebuilding...' : 'Rebuild & Re-Audit'}</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6]">
            <div className="text-[11px] text-[#526058]">Indexed Sitemap URLs</div>
            <div className="font-display text-2xl font-bold text-[#18231C] mt-0.5 tabular-nums">
              {metrics.total}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F9F8] border border-[#D8E2DC]">
            <div className="text-[11px] text-[#2D5A46] font-semibold">Optimal Description (120–160)</div>
            <div className="font-display text-2xl font-bold text-[#1B382B] mt-0.5 tabular-nums">
              {metrics.optimal}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF6EC] border border-[#E8D8A6]">
            <div className="text-[11px] text-[#8C6D1F] font-semibold">Needs Meta Polish</div>
            <div className="font-display text-2xl font-bold text-[#8C6D1F] mt-0.5 tabular-nums">
              {metrics.needsAttention}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E2D6]">
            <div className="text-[11px] text-[#526058]">Custom SQLite Overrides</div>
            <div className="font-display text-2xl font-bold text-[#1B382B] mt-0.5 tabular-nums">
              {metrics.customized}
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
        )}

        {saveFeedback && (
          <div className="p-3 rounded-xl bg-[#2D5A46]/10 border border-[#2D5A46]/30 text-[#1B382B] text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#2D5A46] shrink-0" />
            <span>{saveFeedback}</span>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex flex-wrap p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs self-start">
            {(
              [
                { id: 'ALL', label: `All Pages (${metrics.total})` },
                { id: 'ISSUES', label: `Needs Polish (${metrics.needsAttention})` },
                { id: 'CUSTOMIZED', label: `Edited in SQLite (${metrics.customized})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAuditFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  auditFilter === tab.id
                    ? 'bg-[#1B382B] text-white'
                    : 'text-[#526058] hover:text-[#18231C]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-1 sm:max-w-sm">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by URL, title, description, keyword..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs focus:bg-white focus:border-[#1B382B] outline-none"
              />
            </div>
            {lastFetchedAt && (
              <span className="text-[10px] text-[#7D8B82] whitespace-nowrap hidden md:inline">
                Fetched {new Date(lastFetchedAt).toLocaleTimeString('en-NZ')}
              </span>
            )}
          </div>
        </div>

        {/* Indexed Pages Audit Table */}
        <div className="overflow-x-auto border border-[#E8E2D6] rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F6] text-[#526058] border-b border-[#E8E2D6]">
              <tr>
                <th className="p-3 w-56">Indexed URL &amp; Page</th>
                <th className="p-3">Meta Description</th>
                <th className="p-3 w-64">Keywords</th>
                <th className="p-3 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D6]">
              {loadingSitemap && sitemapEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#526058]">
                    Fetching live sitemap.xml...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#526058]">
                    No indexed pages match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isEditing = editingPageKey === row.pageKey;
                  const kwList = row.keywords
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean);

                  return (
                    <React.Fragment key={row.pageKey}>
                      <tr
                        onClick={() => openEditor(row)}
                        className={`cursor-pointer transition-colors ${
                          isEditing
                            ? 'bg-[#F7F9F8]'
                            : 'hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <td className="p-3 align-top space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-[#1B382B]/10 text-[#1B382B] text-[10px] font-bold">
                              {row.category}
                            </span>
                            {row.isCustomized && (
                              <span className="px-1.5 py-0.5 rounded bg-[#2D5A46] text-white text-[9px] font-bold uppercase">
                                Edited
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-[#18231C] leading-snug">
                            {row.label}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[10px] text-[#526058] break-all">
                            <span>{row.pageKey}</span>
                            <a
                              href={row.pageKey}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open indexed page"
                              className="text-[#2D5A46] hover:text-[#1B382B] shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {row.priority && (
                            <div className="text-[10px] text-[#7D8B82] font-mono">
                              Priority {row.priority}
                              {row.lastmod ? ` · ${row.lastmod}` : ''}
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top space-y-1.5">
                          <div className="font-medium text-[#18231C] text-[11px]">
                            {row.seoTitle}
                          </div>
                          <p className="text-[#526058] leading-relaxed line-clamp-2">
                            {row.metaDescription || (
                              <span className="italic text-[#A63A2A]">
                                Missing meta description
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                row.descHealth === 'optimal'
                                  ? 'bg-[#2D5A46]/12 text-[#2D5A46]'
                                  : row.descHealth === 'missing'
                                  ? 'bg-[#A63A2A]/12 text-[#A63A2A]'
                                  : 'bg-[#C29B38]/15 text-[#8C6D1F]'
                              }`}
                            >
                              {row.metaDescription.trim().length} chars
                              {row.descHealth === 'optimal'
                                ? ' · Optimal'
                                : row.descHealth === 'short'
                                ? ' · Short (<120)'
                                : row.descHealth === 'long'
                                ? ' · Long (>160)'
                                : ' · Missing'}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 align-top">
                          {kwList.length === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#A63A2A]/10 text-[#A63A2A] text-[10px] font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              No keywords set
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {kwList.slice(0, 4).map((kw, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E2D6] text-[10px] text-[#18231C]"
                                >
                                  <Tag className="w-2.5 h-2.5 text-[#7FA892]" />
                                  <span>{kw}</span>
                                </span>
                              ))}
                              {kwList.length > 4 && (
                                <span className="text-[10px] text-[#7D8B82] px-1">
                                  +{kwList.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditor(row);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                              isEditing
                                ? 'bg-[#1B382B] text-white'
                                : 'border border-[#E8E2D6] bg-white text-[#18231C] hover:border-[#1B382B]'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isEditing ? 'Editing' : 'Edit Meta'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Direct Inline Row Editor */}
                      {isEditing && (
                        <tr className="bg-[#F7F9F8]">
                          <td colSpan={4} className="p-5 border-t border-[#D8E2DC]">
                            <form
                              onSubmit={(e) => void handleSaveRowEdit(e, row)}
                              className="space-y-4 max-w-4xl"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A46]">
                                    Direct Meta Editor — {row.label}
                                  </div>
                                  <div className="font-mono text-[11px] text-[#526058]">
                                    Target URL: {row.pageKey}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingPageKey(null)}
                                  className="p-1.5 rounded-lg border border-[#E8E2D6] bg-white text-[#526058] hover:text-[#18231C] cursor-pointer"
                                  aria-label="Close editor"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="font-semibold text-[#18231C]">
                                      Page Title (<code className="font-mono">&lt;title&gt;</code>)
                                    </label>
                                    <span
                                      className={`text-[10px] font-mono font-semibold ${
                                        draftTitle.trim().length >= 30 &&
                                        draftTitle.trim().length <= 60
                                          ? 'text-[#2D5A46]'
                                          : 'text-[#C29B38]'
                                      }`}
                                    >
                                      {draftTitle.trim().length} / 60 chars
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    required
                                    value={draftTitle}
                                    onChange={(e) => setDraftTitle(e.target.value)}
                                    className="w-full p-2.5 border border-[#E8E2D6] rounded-xl bg-white text-xs focus:outline-none focus:border-[#1B382B]"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-semibold text-[#18231C] block">
                                    Meta Keywords (comma-separated)
                                  </label>
                                  <input
                                    type="text"
                                    value={draftKeywords}
                                    onChange={(e) => setDraftKeywords(e.target.value)}
                                    placeholder="New Zealand pounamu, greenstone pendant, Ngāi Tahu..."
                                    className="w-full p-2.5 border border-[#E8E2D6] rounded-xl bg-white text-xs focus:outline-none focus:border-[#1B382B]"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="font-semibold text-[#18231C]">
                                    Meta Description (
                                    <code className="font-mono">meta[name="description"]</code>)
                                  </label>
                                  <span
                                    className={`text-[10px] font-mono font-semibold ${
                                      draftDescription.trim().length >= 120 &&
                                      draftDescription.trim().length <= 160
                                        ? 'text-[#2D5A46]'
                                        : 'text-[#C29B38]'
                                    }`}
                                  >
                                    {draftDescription.trim().length} / 160 chars (Recommended: 120–160)
                                  </span>
                                </div>
                                <textarea
                                  rows={3}
                                  required
                                  value={draftDescription}
                                  onChange={(e) => setDraftDescription(e.target.value)}
                                  className="w-full p-2.5 border border-[#E8E2D6] rounded-xl bg-white text-xs leading-relaxed focus:outline-none focus:border-[#1B382B]"
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                <div className="flex items-center gap-2">
                                  {row.isCustomized && (
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={() => void handleResetRow(row)}
                                      className="px-3 py-1.5 border border-[#E8E2D6] bg-white hover:bg-[#FAF9F6] text-[#526058] rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Reset to Auto Default</span>
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPageKey(null)}
                                    className="px-3.5 py-1.5 border border-[#E8E2D6] bg-white rounded-lg text-xs font-medium text-[#526058] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="px-4 py-1.5 bg-[#1B382B] hover:bg-[#2D5A46] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA892]" />
                                    <span>
                                      {savingEdit ? 'Saving...' : 'Save SEO Meta to SQLite'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
