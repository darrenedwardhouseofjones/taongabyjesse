import { PageSeoMetadata, SiteSettings } from '../types';

function upsertMetaByName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertStructuredData(settings: SiteSettings, canonicalUrl: string, resolvedOgImage: string, descriptionOverride?: string) {
  const id = 'pounamu-store-jsonld';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: settings.siteName || 'Pounamu Atelier',
    description: descriptionOverride || settings.seoDescription || settings.tagline,
    url: canonicalUrl,
    image: resolvedOgImage,
    email: settings.contactEmail,
    telephone: settings.contactPhone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.workshopAddress,
      addressCountry: 'NZ',
    },
    priceRange: '$$',
  };

  script.textContent = JSON.stringify(schema);
}

function toAbsoluteUrl(urlOrPath: string | undefined, origin: string): string {
  if (!urlOrPath) return `${origin}/src/assets/images/jesse_carving_hero_1794557997280.jpg`;
  if (/^(https?:|data:)/i.test(urlOrPath)) return urlOrPath;
  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${origin}${cleanPath}`;
}

export function applySiteSeoToHead(
  settings: SiteSettings,
  pageSeoList: PageSeoMetadata[] = []
) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const origin = window.location.origin;
  const currentKey = `${window.location.pathname || '/'}${window.location.search || ''}` || '/';
  const override = pageSeoList.find((item) => item.pageKey === currentKey);
  const defaultCanonical = `${origin}${window.location.pathname}${window.location.search}`;
  const canonicalUrl = settings.canonicalUrl?.trim()
    ? `${settings.canonicalUrl.trim().replace(/\/$/, '')}${currentKey === '/' ? '/' : currentKey}`
    : defaultCanonical;

  const title =
    override?.seoTitle?.trim() ||
    settings.seoTitle?.trim() ||
    `${settings.siteName} — Authentic NZ Greenstone`;
  const description =
    override?.metaDescription?.trim() ||
    settings.seoDescription?.trim() ||
    settings.tagline;
  const keywords = override ? override.keywords : settings.seoKeywords;
  const ogTitle = override?.seoTitle?.trim() || settings.ogTitle?.trim() || title;
  const ogDescription =
    override?.metaDescription?.trim() || settings.ogDescription?.trim() || description;
  const ogSiteName = settings.ogSiteName?.trim() || settings.siteName || 'Pounamu Atelier';
  const resolvedOgImage = toAbsoluteUrl(settings.ogImageUrl, origin);

  document.title = title;
  upsertMetaByName('description', description);
  if (keywords !== undefined) {
    upsertMetaByName('keywords', keywords);
  }
  upsertMetaByName(
    'robots',
    settings.allowSearchIndexing === false ? 'noindex, nofollow' : 'index, follow'
  );

  upsertCanonical(canonicalUrl);

  // Open Graph
  upsertMetaByProperty('og:type', 'website');
  upsertMetaByProperty('og:url', canonicalUrl);
  upsertMetaByProperty('og:site_name', ogSiteName);
  upsertMetaByProperty('og:title', ogTitle);
  upsertMetaByProperty('og:description', ogDescription);
  upsertMetaByProperty('og:image', resolvedOgImage);

  // Twitter / X
  upsertMetaByName('twitter:card', settings.twitterCardType || 'summary_large_image');
  upsertMetaByName('twitter:title', ogTitle);
  upsertMetaByName('twitter:description', ogDescription);
  upsertMetaByName('twitter:image', resolvedOgImage);

  // Dynamic Favicon
  const targetFavicon = settings.faviconUrl?.trim() || '/favicon.png';
  let iconLink = document.querySelector("link[rel='icon'][type='image/png']") as HTMLLinkElement | null;
  if (!iconLink) {
    iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  }
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.appendChild(iconLink);
  }
  iconLink.href = targetFavicon;

  upsertStructuredData(settings, canonicalUrl, resolvedOgImage, description);
}
