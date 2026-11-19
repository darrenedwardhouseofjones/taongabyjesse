import fs from 'node:fs';
import path from 'node:path';
import { getAllProducts, getGalleryItems, getSiteSettings } from './db.ts';
import type { GalleryItem, Product, SiteSettings } from '../src/types/index.ts';

export interface SitemapImageEntry {
  loc: string;
  title?: string;
  caption?: string;
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
  images?: SitemapImageEntry[];
}

export interface SitemapGenerationResult {
  xml: string;
  filePath: string;
  baseUrl: string;
  totalUrls: number;
  staticPageCount: number;
  publishedProductCount: number;
  activeProductCount: number;
  galleryItemCount: number;
  retiredArchiveCount: number;
}

export interface SitemapSchedulerStatus {
  running: boolean;
  intervalMinutes: number;
  lastGeneratedAt: string | null;
  nextScheduledRunAt: string | null;
  baseUrl: string | null;
  totalUrls: number;
  publishedProductCount: number;
  activeProductCount: number;
  galleryItemCount: number;
  retiredArchiveCount: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

export function resolveSitemapBaseUrl(explicitBaseUrl?: string, settings?: SiteSettings): string {
  const candidates = [
    explicitBaseUrl,
    settings?.canonicalUrl,
    process.env.SITE_URL,
    process.env.APP_URL,
    'https://pounamuatelier.co.nz',
  ];

  for (const candidate of candidates) {
    if (candidate && /^https?:\/\//i.test(candidate.trim())) {
      return normalizeBaseUrl(candidate);
    }
  }

  return 'https://pounamuatelier.co.nz';
}

function toIsoDate(dateInput?: string): string {
  if (dateInput) {
    const parsed = new Date(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return new Date().toISOString().split('T')[0];
}

function toAbsoluteAssetUrl(urlOrPath: string | undefined, baseUrl: string): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed || /^data:/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${baseUrl}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function buildSitemapData(options?: { baseUrl?: string }): {
  xml: string;
  baseUrl: string;
  totalUrls: number;
  staticPageCount: number;
  publishedProductCount: number;
  activeProductCount: number;
  galleryItemCount: number;
  retiredArchiveCount: number;
} {
  const settings = getSiteSettings();
  const baseUrl = resolveSitemapBaseUrl(options?.baseUrl, settings);
  const allProducts: Product[] = getAllProducts();
  const galleryItems: GalleryItem[] = getGalleryItems();

  const activeProducts = allProducts.filter(
    (p) => p.published && (p.isMadeToOrder || p.quantity > 0)
  );
  const retiredArchiveProducts = allProducts.filter(
    (p) => p.published && !p.isMadeToOrder && p.quantity <= 0
  );

  const today = toIsoDate();

  const staticEntries: SitemapUrlEntry[] = [
    {
      loc: `${baseUrl}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
    },
    {
      loc: `${baseUrl}/?tab=gallery`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9',
    },
    {
      loc: `${baseUrl}/?tab=custom`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.85',
    },
    {
      loc: `${baseUrl}/?tab=story`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.75',
    },
    {
      loc: `${baseUrl}/?tab=provenance`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.75',
    },
    {
      loc: `${baseUrl}/?tab=policies`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.6',
    },
  ];

  const productEntries: SitemapUrlEntry[] = activeProducts.map((product) => {
    const images: SitemapImageEntry[] = (product.images || [])
      .map((img) => toAbsoluteAssetUrl(img, baseUrl))
      .filter((loc): loc is string => Boolean(loc))
      .map((loc) => ({
        loc,
        title: product.title,
        caption: `${product.material} ${product.designType} — ${product.originRiver}`,
      }));

    return {
      loc: `${baseUrl}/?tab=store&product=${encodeURIComponent(product.id)}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.8',
      images,
    };
  });

  const galleryEntries: SitemapUrlEntry[] = galleryItems.map((item) => {
    const imgLoc = toAbsoluteAssetUrl(item.imageUrl, baseUrl);
    return {
      loc: `${baseUrl}/?tab=gallery&piece=${encodeURIComponent(item.id)}`,
      lastmod: toIsoDate(item.createdAt),
      changefreq: 'monthly',
      priority: '0.7',
      images: imgLoc
        ? [
            {
              loc: imgLoc,
              title: item.title,
              caption: `${item.material} ${item.designType} (${item.carvedYear}) — ${item.originRiver}`,
            },
          ]
        : undefined,
    };
  });

  const retiredEntries: SitemapUrlEntry[] = retiredArchiveProducts.map((product) => {
    const imgLoc = toAbsoluteAssetUrl(product.images?.[0], baseUrl);
    return {
      loc: `${baseUrl}/?tab=gallery&piece=${encodeURIComponent(product.id)}`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.65',
      images: imgLoc
        ? [
            {
              loc: imgLoc,
              title: product.title,
              caption: `Past Archive Carving: ${product.material} ${product.designType}`,
            },
          ]
        : undefined,
    };
  });

  const allUrls = [...staticEntries, ...productEntries, ...galleryEntries, ...retiredEntries];

  const urlNodes = allUrls
    .map((entry) => {
      const lines: string[] = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) {
        lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
      }
      if (entry.changefreq) {
        lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      }
      if (entry.priority) {
        lines.push(`    <priority>${entry.priority}</priority>`);
      }
      if (entry.images && entry.images.length > 0) {
        for (const img of entry.images) {
          lines.push('    <image:image>');
          lines.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
          if (img.title) {
            lines.push(`      <image:title>${escapeXml(img.title)}</image:title>`);
          }
          if (img.caption) {
            lines.push(`      <image:caption>${escapeXml(img.caption)}</image:caption>`);
          }
          lines.push('    </image:image>');
        }
      }
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    urlNodes,
    '</urlset>',
    '',
  ].join('\n');

  return {
    xml,
    baseUrl,
    totalUrls: allUrls.length,
    staticPageCount: staticEntries.length,
    publishedProductCount: productEntries.length + retiredEntries.length,
    activeProductCount: productEntries.length,
    galleryItemCount: galleryEntries.length,
    retiredArchiveCount: retiredEntries.length,
  };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerState: SitemapSchedulerStatus = {
  running: false,
  intervalMinutes: Number(process.env.SITEMAP_INTERVAL_MINUTES) || 15,
  lastGeneratedAt: null,
  nextScheduledRunAt: null,
  baseUrl: null,
  totalUrls: 0,
  publishedProductCount: 0,
  activeProductCount: 0,
  galleryItemCount: 0,
  retiredArchiveCount: 0,
};

export function getSitemapStatus(): SitemapSchedulerStatus {
  return { ...schedulerState };
}

export function writePublicSitemap(options?: {
  baseUrl?: string;
  outPath?: string;
}): SitemapGenerationResult {
  const result = buildSitemapData({ baseUrl: options?.baseUrl });
  const targetPath = options?.outPath
    ? path.resolve(process.cwd(), options.outPath)
    : path.resolve(process.cwd(), 'public', 'sitemap.xml');

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, result.xml, 'utf-8');
  fs.renameSync(tempPath, targetPath);

  const nowIso = new Date().toISOString();
  schedulerState = {
    ...schedulerState,
    lastGeneratedAt: nowIso,
    nextScheduledRunAt: schedulerState.running
      ? new Date(Date.now() + schedulerState.intervalMinutes * 60 * 1000).toISOString()
      : schedulerState.nextScheduledRunAt,
    baseUrl: result.baseUrl,
    totalUrls: result.totalUrls,
    publishedProductCount: result.publishedProductCount,
    activeProductCount: result.activeProductCount,
    galleryItemCount: result.galleryItemCount,
    retiredArchiveCount: result.retiredArchiveCount,
  };

  return {
    ...result,
    filePath: targetPath,
  };
}

export function startSitemapScheduler(options?: {
  intervalMinutes?: number;
  baseUrl?: string;
  outPath?: string;
  unrefTimer?: boolean;
  onTick?: (summary: SitemapGenerationResult) => void;
}): { stop: () => void; status: () => SitemapSchedulerStatus } {
  const envInterval = Number(process.env.SITEMAP_INTERVAL_MINUTES);
  const rawMinutes =
    typeof options?.intervalMinutes === 'number' && options.intervalMinutes > 0
      ? options.intervalMinutes
      : Number.isFinite(envInterval) && envInterval > 0
      ? envInterval
      : 15;

  const intervalMinutes = Math.max(0.05, rawMinutes);
  const intervalMs = Math.round(intervalMinutes * 60 * 1000);

  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  schedulerState.running = true;
  schedulerState.intervalMinutes = intervalMinutes;

  const runTick = () => {
    try {
      const summary = writePublicSitemap({
        baseUrl: options?.baseUrl,
        outPath: options?.outPath,
      });
      schedulerState.nextScheduledRunAt = new Date(Date.now() + intervalMs).toISOString();
      options?.onTick?.(summary);
    } catch (err) {
      console.warn('Scheduled sitemap generation failed:', err);
    }
  };

  runTick();

  schedulerTimer = setInterval(runTick, intervalMs);
  if (options?.unrefTimer && typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }

  return {
    stop: () => {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      schedulerState.running = false;
      schedulerState.nextScheduledRunAt = null;
    },
    status: getSitemapStatus,
  };
}
