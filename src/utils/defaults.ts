import type {
  Courier,
  CourierRate,
  CustomPricingConfig,
  SiteSettings,
} from '../types/index.ts';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Pounamu Atelier',
  tagline: 'Hand-Carved Aotearoa Greenstone & Heirloom Taonga by Jesse',
  logoUrl: '',
  faviconUrl: '',
  announcementBanner:
    'Complimentary tracked NZ courier on orders over $400 NZD — Custom commissions open',
  announcementEnabled: true,
  gstNumber: '132-849-201',
  workshopAddress: '42 Carlyle Street, Napier South, Napier 4110, New Zealand',
  contactEmail: 'jesse@pounamuatelier.co.nz',
  contactPhone: '+64 6 835 0194',
  primaryColor: '#1B382B',
  accentColor: '#2D5A46',
  authenticityPolicyText:
    'Every pounamu taonga carved in our Napier studio uses legally sourced West Coast (Te Tai o Poutini) and South Island nephrite and bowenite. Each piece ships with its river origin and individual authenticity provenance record. Whale bone pieces carry a DOC permit or exemption reference and are restricted to New Zealand delivery unless CITES export approval is arranged.',
  termsAndConditionsText:
    '1. Natural Stone Character\nNatural pounamu (nephrite jade) exhibits organic mineral inclusions, colour shifts, and feathering that attest to its geological authenticity. Each ready-to-wear piece is photographed individually.\n\n2. Pricing & GST\nAll prices are displayed in New Zealand Dollars (NZD) and are inclusive of 15% NZ GST.\n\n3. Payment Methods\nWe accept major credit/debit cards securely via Stripe Elements as well as Cash on Pickup at our Napier workshop (scheduled by appointment) and Digital Gift Cards.',
  privacyPolicyText:
    'In accordance with the New Zealand Privacy Act 2020, Pounamu Atelier collects only the personal information required to carve, certify, dispatch, or arrange studio collection of your order (name, email, phone number, and delivery address).\n\nPayment card details are processed directly inside Stripe-hosted iframes and never touch our servers. Customers may request access to or correction of their stored order records at any time by contacting the studio.',
  shippingAndReturnsPolicyText:
    'New Zealand orders dispatch via tracked NZ Post or Aramex courier from Napier. Signature-required courier is recommended for high-value heirloom pieces.\n\nReady-to-wear pieces may be returned unworn within the return window in original packaging. Custom commissions and personalised carvings are non-refundable once stone cutting has begun, unless faulty under the Consumer Guarantees Act 1993.',
  customCommissionsPolicyText:
    'Bespoke commissions begin with stone selection, design proportions, and a confirmed quote from Jesse. Production typically takes 2–4 weeks depending on detail and carving queue.\n\nQuotes remain valid for 14 days. Once accepted and work commences, changes to stone variety or primary dimensions cannot be accommodated.',
  legalNoticeUpdatedAt: new Date().toISOString().split('T')[0],
  returnPolicyDays: 14,
  allowEmailRegistration: true,
  allowGmailOAuth: false,
  googleClientId: '',
  seoTitle: 'Pounamu Atelier — Hand-Carved NZ Greenstone & Heirloom Taonga',
  seoDescription:
    'Authentic West Coast pounamu pendants, heirloom taonga, bespoke custom carvings, and digital gift cards handcrafted in Napier, Aotearoa New Zealand.',
  seoKeywords:
    'pounamu, greenstone, NZ jade, Kawakawa, Inanga, Tangiwai, custom carving, Napier, New Zealand taonga',
  ogTitle: 'Pounamu Atelier — Hand-Carved Aotearoa Greenstone',
  ogDescription:
    'Hand-carved West Coast pounamu taonga, custom commissions, and digital gift cards from Napier, New Zealand.',
  ogImageUrl: '/src/assets/images/jesse_carving_hero_1794557997280.jpg',
  ogSiteName: 'Pounamu Atelier',
  twitterCardType: 'summary_large_image',
  canonicalUrl: '',
  allowSearchIndexing: true,
  stripeEnabled: true,
  stripeMode: 'test',
  stripePublishableKey: '',
  stripeStatementDescriptor: 'POUNAMU ATELIER',
  cashOnPickupEnabled: true,
  cashOnPickupInstructions:
    'Pay in cash when collecting your piece directly from Jesse at 42 Carlyle Street, Napier. We will email you as soon as your taonga is ready for pickup.',
};

export const DEFAULT_CUSTOM_PRICING: CustomPricingConfig = {
  materialBaseCents: {
    'Kawakawa Pounamu': 32000,
    'Inanga Pounamu': 39000,
    'Kahurangi Pounamu': 48000,
    'Tangiwai (Bowenite)': 36000,
    'Kōkopu Pounamu': 41000,
    'Whale Bone': 29000,
  },
  designMultiplier: {
    'Toki (Adze)': 1.15,
    'Koru (Spiral)': 1.0,
    'Pikorua (Twist)': 1.25,
    'Hei Matau (Fish Hook)': 1.2,
    'Roimata (Tear Drop)': 0.95,
    Manaia: 1.35,
  },
  sizeMultiplier: {
    small45: 0.9,
    medium65: 1.0,
    large85: 1.3,
  },
  stoneOptions: [
    {
      name: 'Kawakawa Pounamu',
      description: 'Rich deep leaf-green Arahura nephrite with natural dark flecks',
      baseCents: 32000,
    },
    {
      name: 'Inanga Pounamu',
      description: 'Silvery-pearlescent pale green nephrite prized for fine clarity',
      baseCents: 39000,
    },
    {
      name: 'Kahurangi Pounamu',
      description: 'Rare luminous emerald-toned translucent pounamu',
      baseCents: 48000,
    },
    {
      name: 'Tangiwai (Bowenite)',
      description: 'Translucent Fiordland greenstone named for mist and tears',
      baseCents: 36000,
    },
    {
      name: 'Kōkopu Pounamu',
      description: 'Spotted river-trout patterned West Coast nephrite',
      baseCents: 41000,
    },
    {
      name: 'Whale Bone',
      description: 'DOC-permitted heirloom marine bone (NZ domestic shipping only)',
      baseCents: 29000,
    },
  ],
  designOptions: [
    {
      name: 'Toki (Adze)',
      label: 'Toki (Ceremonial Adze)',
      meaning: 'Strength, determination, courage, and leadership',
      multiplier: 1.15,
      previewImageUrl: '/src/assets/images/product_toki_pounamu_1794468031889.jpg',
    },
    {
      name: 'Koru (Spiral)',
      label: 'Koru (Unfurling Fern)',
      meaning: 'New beginnings, growth, harmony, and peace',
      multiplier: 1.0,
      previewImageUrl: '/src/assets/images/product_koru_pounamu_1794468031802.jpg',
    },
    {
      name: 'Pikorua (Twist)',
      label: 'Pikorua (Double/Single Twist)',
      meaning: 'Eternity, loyalty, and the intertwining paths of life',
      multiplier: 1.25,
      previewImageUrl: '/src/assets/images/modern_hero_pounamu_1794472502033.jpg',
    },
    {
      name: 'Hei Matau (Fish Hook)',
      label: 'Hei Matau (Fish Hook)',
      meaning: 'Prosperity, abundance, and safe passage over water',
      multiplier: 1.2,
      previewImageUrl: '/src/assets/images/custom_carving_workshop_1794468032796.jpg',
    },
    {
      name: 'Roimata (Tear Drop)',
      label: 'Roimata (Comfort Drop)',
      meaning: 'Healing, remembrance, and deep aroha',
      multiplier: 0.95,
      previewImageUrl: '/src/assets/images/gallery_tangiwai_roimata_1794950532051.jpg',
    },
    {
      name: 'Manaia',
      label: 'Manaia (Spiritual Guardian)',
      meaning: 'Protection across sky, earth, and sea',
      multiplier: 1.35,
      previewImageUrl: '/src/assets/images/product_toki_pounamu_1794468031889.jpg',
    },
  ],
  sizeOptions: [
    { mm: 45, label: '45mm Delicate Everyday', multiplier: 0.9 },
    { mm: 65, label: '65mm Classic Statement', multiplier: 1.0 },
    { mm: 85, label: '85mm Heirloom Ceremonial', multiplier: 1.3 },
  ],
  pauaEyeCents: 3500,
  hardwoodBoxCents: 4500,
  cordOptions: [
    'Traditional Hand-Plaited Muka Flax',
    'Black Waxed Nylon Cord (Adjustable)',
    'Dark Brown Waxed Cord (Adjustable)',
  ],
  bindingOptions: [
    'Traditional Whipped Black Binding',
    'Natural Linen Whipping',
    'Minimalist Hidden Bore',
  ],
};

export const DEFAULT_COURIERS: Courier[] = [
  {
    id: 'nzpost',
    name: 'NZ Post',
    trackingUrlTemplate: 'https://www.nzpost.co.nz/tools/tracking?track={TRACKING}',
    isActive: true,
    services: [
      {
        id: 'nzpost-std',
        courierId: 'nzpost',
        name: 'NZ Post Courier (Tracked)',
        requiresSignature: false,
        deliveryEstimateDays: '1–3 working days',
        isActive: true,
      },
      {
        id: 'nzpost-sig',
        courierId: 'nzpost',
        name: 'NZ Post Courier (Signature Required)',
        requiresSignature: true,
        deliveryEstimateDays: '1–2 working days',
        freeOverAmountCents: 40000,
        isActive: true,
      },
    ],
  },
];

export const DEFAULT_COURIER_RATES: CourierRate[] = [
  { id: 'rate-std-bags', courierServiceId: 'nzpost-std', packageSizeCode: 'BAG-S', priceCents: 900 },
  { id: 'rate-std-bagm', courierServiceId: 'nzpost-std', packageSizeCode: 'BAG-M', priceCents: 1200 },
  { id: 'rate-std-box1', courierServiceId: 'nzpost-std', packageSizeCode: 'BOX-1', priceCents: 1800 },
  { id: 'rate-std-box2', courierServiceId: 'nzpost-std', packageSizeCode: 'BOX-2', priceCents: 2800 },
  { id: 'rate-sig-bags', courierServiceId: 'nzpost-sig', packageSizeCode: 'BAG-S', priceCents: 1200 },
  { id: 'rate-sig-bagm', courierServiceId: 'nzpost-sig', packageSizeCode: 'BAG-M', priceCents: 1500 },
  { id: 'rate-sig-box1', courierServiceId: 'nzpost-sig', packageSizeCode: 'BOX-1', priceCents: 2100 },
  { id: 'rate-sig-box2', courierServiceId: 'nzpost-sig', packageSizeCode: 'BOX-2', priceCents: 3100 },
];
