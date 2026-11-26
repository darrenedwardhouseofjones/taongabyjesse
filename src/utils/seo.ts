import type { PageSeoMetadata, Product, SiteSettings } from '../types/index.ts';

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

function upsertLinkRel(id: string, attrs: Record<string, string>) {
  let el = document.getElementById(id) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.id = id;
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}

export function toAbsoluteSeoUrl(urlOrPath: string | undefined, origin: string): string {
  if (!urlOrPath) return `${origin}/src/assets/images/jesse_carving_hero_1794557997280.jpg`;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return `${origin}/src/assets/images/jesse_carving_hero_1794557997280.jpg`;
  if (/^(https?:|data:)/i.test(trimmed)) return trimmed;
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${cleanPath}`;
}

export function serializeJsonLdSafe(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildProductJsonLd(
  product: Product,
  origin: string,
  settings: SiteSettings
): Record<string, unknown> {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const productUrl = `${cleanOrigin}/?tab=store&product=${encodeURIComponent(product.id)}`;
  const buyUrl = `${cleanOrigin}/?add=${encodeURIComponent(product.id)}&qty=1&checkout=1`;
  const addToCartUrl = `${cleanOrigin}/?add=${encodeURIComponent(product.id)}&qty=1&cart=1`;
  const isAvailable = product.isMadeToOrder || product.quantity > 0;
  const availability = !product.published || !isAvailable
    ? 'https://schema.org/OutOfStock'
    : product.isMadeToOrder
    ? 'https://schema.org/MadeToOrder'
    : 'https://schema.org/InStock';

  const images = (product.images || [])
    .filter((img) => Boolean(img) && !/^data:/i.test(img))
    .map((img) => toAbsoluteSeoUrl(img, cleanOrigin));

  return {
    '@type': 'Product',
    '@id': `${cleanOrigin}/#product-${product.id}`,
    productID: product.id,
    sku: product.sku || product.id,
    name: product.title,
    description: product.description || product.spiritualMeaning || `${product.material} ${product.designType} hand-carved by ${product.carverName || 'Jesse'}`,
    category: `${product.material} Pounamu / ${product.designType}`,
    material: product.material,
    image: images.length > 0 ? images : [toAbsoluteSeoUrl(settings.ogImageUrl, cleanOrigin)],
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: settings.siteName || 'Taonga by Jesse',
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Origin River',
        value: product.originRiver,
      },
      {
        '@type': 'PropertyValue',
        name: 'Authenticity Code',
        value: product.authenticityCode,
      },
      {
        '@type': 'PropertyValue',
        name: 'Dimensions',
        value: product.dimensions,
      },
      {
        '@type': 'PropertyValue',
        name: 'One-of-a-Kind Unique Piece',
        value: product.isUniquePiece ? 'Yes' : 'No',
      },
    ],
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'NZD',
      price: (product.priceCents / 100).toFixed(2),
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@id': `${cleanOrigin}/#store`,
      },
      potentialAction: [
        {
          '@type': 'BuyAction',
          name: 'Instant Checkout Handoff',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: buyUrl,
            actionPlatform: [
              'https://schema.org/DesktopWebPlatform',
              'https://schema.org/MobileWebPlatform',
            ],
          },
        },
        {
          '@type': 'AddAction',
          name: 'Add to Shopping Cart',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: addToCartUrl,
          },
        },
      ],
    },
  };
}

export function buildStoreStructuredData(params: {
  settings: SiteSettings;
  origin: string;
  canonicalUrl: string;
  resolvedOgImage: string;
  descriptionOverride?: string;
  products?: Product[];
  activeProductId?: string | null;
}): Record<string, unknown> {
  const cleanOrigin = params.origin.replace(/\/+$/, '');
  const activeProducts = (params.products || []).filter(
    (p) => p.published && (p.isMadeToOrder || p.quantity > 0)
  );
  const focusedProduct = params.activeProductId
    ? (params.products || []).find((p) => p.id === params.activeProductId && p.published)
    : undefined;

  const socialSameAs = (params.settings.socialLinks || [])
    .map((item) => item.url?.trim())
    .filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)));

  const storeNode = {
    '@type': 'Store',
    '@id': `${cleanOrigin}/#store`,
    name: params.settings.siteName || 'Taonga by Jesse',
    description:
      params.descriptionOverride || params.settings.seoDescription || params.settings.tagline,
    url: cleanOrigin,
    image: params.resolvedOgImage,
    email: params.settings.contactEmail,
    telephone: params.settings.contactPhone,
    currenciesAccepted: 'NZD',
    priceRange: '$$',
    ...(socialSameAs.length > 0 ? { sameAs: socialSameAs } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: params.settings.workshopAddress,
      addressLocality: 'Napier',
      addressRegion: "Hawke's Bay",
      addressCountry: 'NZ',
    },
  };

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${cleanOrigin}/#website`,
    name: params.settings.siteName || 'Taonga by Jesse',
    url: cleanOrigin,
    publisher: {
      '@id': `${cleanOrigin}/#store`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${cleanOrigin}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const graph: Record<string, unknown>[] = [websiteNode, storeNode];

  if (focusedProduct) {
    graph.push(buildProductJsonLd(focusedProduct, cleanOrigin, params.settings));
  }

  if (activeProducts.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${cleanOrigin}/#catalog`,
      name: `${params.settings.siteName || 'Taonga by Jesse'} Available Pounamu Catalogue`,
      numberOfItems: activeProducts.length,
      itemListElement: activeProducts.slice(0, 50).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${cleanOrigin}/?tab=store&product=${encodeURIComponent(product.id)}`,
        item: buildProductJsonLd(product, cleanOrigin, params.settings),
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function upsertStructuredData(params: {
  settings: SiteSettings;
  origin: string;
  canonicalUrl: string;
  resolvedOgImage: string;
  descriptionOverride?: string;
  products?: Product[];
  activeProductId?: string | null;
}) {
  const id = 'pounamu-store-jsonld';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const schema = buildStoreStructuredData(params);
  script.textContent = serializeJsonLdSafe(schema);
}

export function applySiteSeoToHead(
  settings: SiteSettings,
  pageSeoList: PageSeoMetadata[] = [],
  products: Product[] = [],
  activeProductId?: string | null
) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const origin = window.location.origin;
  const currentKey = `${window.location.pathname || '/'}${window.location.search || ''}` || '/';
  const override = pageSeoList.find((item) => item.pageKey === currentKey);
  const defaultCanonical = `${origin}${window.location.pathname}${window.location.search}`;
  const canonicalUrl = settings.canonicalUrl?.trim()
    ? `${settings.canonicalUrl.trim().replace(/\/$/, '')}${currentKey === '/' ? '/' : currentKey}`
    : defaultCanonical;

  const activeProduct = activeProductId
    ? products.find((p) => p.id === activeProductId && p.published)
    : undefined;

  const title = activeProduct
    ? `${activeProduct.title} — ${settings.siteName}`
    : override?.seoTitle?.trim() ||
      settings.seoTitle?.trim() ||
      `${settings.siteName} — Authentic NZ Greenstone`;
  const description = activeProduct
    ? activeProduct.description ||
      `${activeProduct.material} ${activeProduct.designType} carved by ${activeProduct.carverName} in Napier, NZ.`
    : override?.metaDescription?.trim() ||
      settings.seoDescription?.trim() ||
      settings.tagline;
  const keywords = override ? override.keywords : settings.seoKeywords;
  const ogTitle = activeProduct ? title : override?.seoTitle?.trim() || settings.ogTitle?.trim() || title;
  const ogDescription = activeProduct
    ? description
    : override?.metaDescription?.trim() || settings.ogDescription?.trim() || description;
  const ogSiteName = settings.ogSiteName?.trim() || settings.siteName || 'Pounamu Atelier';
  const resolvedOgImage = activeProduct?.images?.[0]
    ? toAbsoluteSeoUrl(activeProduct.images[0], origin)
    : toAbsoluteSeoUrl(settings.ogImageUrl, origin);

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
  upsertLinkRel('ai-llms-txt', {
    rel: 'alternate',
    type: 'text/plain',
    title: 'AI Agent Store Guide (llms.txt)',
    href: '/llms.txt',
  });
  upsertLinkRel('ai-catalog-api', {
    rel: 'alternate',
    type: 'application/json',
    title: 'AI Agent Catalog JSON API',
    href: '/api/agent/catalog',
  });

  // Open Graph
  upsertMetaByProperty('og:type', activeProduct ? 'product' : 'website');
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

  upsertStructuredData({
    settings,
    origin,
    canonicalUrl,
    resolvedOgImage,
    descriptionOverride: description,
    products,
    activeProductId,
  });
}

