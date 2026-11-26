import type { CustomCommission, Order, Product } from '../types';

export type GrowthTimeRange = '30D' | '90D' | '6M' | '12M' | 'ALL';
export type GrowthGranularity = 'weekly' | 'monthly';
export type GrowthChartTab = 'overview' | 'sales' | 'commissions' | 'popularity';
export type PopularityDimension = 'design' | 'material';

export interface GrowthBucket {
  key: string;
  label: string;
  fullLabel: string;
  startDate: Date;
  endDate: Date;
  storefrontRevenueNzd: number;
  commissionRevenueNzd: number;
  totalRevenueNzd: number;
  ordersCount: number;
  unitsSold: number;
  aovNzd: number;
  commissionRequests: number;
  commissionQuoted: number;
  commissionConverted: number;
  conversionRatePct: number;
  hasCommissionActivity: boolean;
  motifCounts: Record<string, number>;
  materialCounts: Record<string, number>;
}

export interface CommissionFunnelStage {
  id: string;
  label: string;
  count: number;
  pctOfRequests: number;
  color: string;
}

export interface PopularityRankingItem {
  name: string;
  orderUnits: number;
  commissionCount: number;
  totalDemand: number;
  revenueNzd: number;
  sharePct: number;
  color: string;
}

export interface GrowthAnalyticsResult {
  buckets: GrowthBucket[];
  funnel: CommissionFunnelStage[];
  topDesigns: string[];
  topMaterials: string[];
  designRanking: PopularityRankingItem[];
  materialRanking: PopularityRankingItem[];
  summary: {
    totalRevenueNzd: number;
    storefrontRevenueNzd: number;
    commissionRevenueNzd: number;
    totalOrders: number;
    totalUnitsSold: number;
    totalCommissionRequests: number;
    totalCommissionConverted: number;
    overallConversionPct: number;
    revenueDeltaPct: number | null;
    topMotif: string | null;
    topMaterial: string | null;
    hasAnyData: boolean;
  };
}

export const MOTIF_PALETTE = [
  '#1B382B',
  '#C29B38',
  '#2D5A46',
  '#8C6239',
  '#4B7A65',
  '#7D8B82',
];

const QUOTED_PLUS_STATUSES = new Set<CustomCommission['status']>([
  'QUOTED',
  'ACCEPTED',
  'DEPOSIT_PAID',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY',
  'SHIPPED',
]);

const CONVERTED_STATUSES = new Set<CustomCommission['status']>([
  'ACCEPTED',
  'DEPOSIT_PAID',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY',
  'SHIPPED',
]);

const PAID_STATUSES = new Set<CustomCommission['status']>([
  'DEPOSIT_PAID',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY',
  'SHIPPED',
]);

const COMPLETED_STATUSES = new Set<CustomCommission['status']>(['READY', 'SHIPPED']);

export function normalizeDesignFamily(raw: string | undefined): string {
  const clean = (raw || '').trim();
  if (!clean) return 'Custom Piece';
  const lower = clean.toLowerCase();
  if (lower.startsWith('toki')) return 'Toki';
  if (lower.startsWith('koru')) return 'Koru';
  if (lower.startsWith('pikorua')) return 'Pikorua';
  if (lower.startsWith('hei matau') || lower.includes('fish hook')) return 'Hei Matau';
  if (lower.startsWith('roimata')) return 'Roimata';
  if (lower.startsWith('manaia')) return 'Manaia';
  if (lower.startsWith('hei tiki') || lower === 'tiki') return 'Hei Tiki';
  return clean;
}

export function normalizeStoneFamily(raw: string | undefined): string {
  const clean = (raw || '').trim();
  if (!clean) return 'Pounamu';
  const lower = clean.toLowerCase();
  if (lower.includes('kawakawa')) return 'Kawakawa';
  if (lower.includes('inanga') || lower.includes('īnanga')) return 'Inanga';
  if (lower.includes('kahurangi')) return 'Kahurangi';
  if (lower.includes('tangiwai')) return 'Tangiwai';
  if (lower.includes('kōkopu') || lower.includes('kokopu')) return 'Kōkopu';
  if (lower.includes('whale bone')) return 'Whale Bone';
  if (lower.includes('flower jade') || lower.includes('marsden')) return 'Flower Jade';
  return clean.replace(/\s+Pounamu$/i, '').trim() || clean;
}

function getCommissionRealizedCents(c: CustomCommission): number {
  if (!PAID_STATUSES.has(c.status)) return 0;
  if (COMPLETED_STATUSES.has(c.status)) {
    return c.quoteAmountCents || c.depositAmountCents || 0;
  }
  return c.depositAmountCents || (c.quoteAmountCents ? Math.round(c.quoteAmountCents * 0.5) : 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatMonthShort(d: Date): string {
  return d.toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' });
}

function formatMonthFull(d: Date): string {
  return d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

function formatWeekShort(d: Date): string {
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function formatWeekFull(start: Date, end: Date): string {
  const s = start.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  const e = end.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
}

export function resolveDefaultGranularity(range: GrowthTimeRange): GrowthGranularity {
  return range === '30D' || range === '90D' ? 'weekly' : 'monthly';
}

export function computeTaongaGrowthAnalytics({
  orders,
  commissions,
  products,
  range,
  granularity,
}: {
  orders: Order[];
  commissions: CustomCommission[];
  products: Product[];
  range: GrowthTimeRange;
  granularity: GrowthGranularity;
}): GrowthAnalyticsResult {
  const productById = new Map<string, Product>();
  products.forEach((p) => productById.set(p.id, p));

  const settledOrders = orders.filter((o) => o.status !== 'PENDING');

  const allDates: number[] = [];
  settledOrders.forEach((o) => {
    const t = new Date(o.createdAt).getTime();
    if (Number.isFinite(t)) allDates.push(t);
  });
  commissions.forEach((c) => {
    const t = new Date(c.createdAt).getTime();
    if (Number.isFinite(t)) allDates.push(t);
  });

  const now = new Date();
  const anchorTime = Math.max(now.getTime(), ...(allDates.length > 0 ? allDates : [now.getTime()]));
  const anchorDate = new Date(anchorTime);

  // Determine range window start
  let windowStart: Date;
  if (range === '30D') {
    windowStart = new Date(anchorDate.getTime() - 30 * 86_400_000);
  } else if (range === '90D') {
    windowStart = new Date(anchorDate.getTime() - 90 * 86_400_000);
  } else if (range === '6M') {
    windowStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 5, 1);
  } else if (range === '12M') {
    windowStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 11, 1);
  } else {
    const earliest = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 5, 1);
    windowStart =
      granularity === 'weekly'
        ? startOfWeekMonday(earliest)
        : startOfMonth(earliest);
  }

  // Ensure minimum span for crisp D3 curves & bars
  if (granularity === 'monthly') {
    const minMonthlyStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 5, 1);
    if (windowStart > minMonthlyStart) {
      windowStart = minMonthlyStart;
    }
  } else {
    const minWeeklyStart = startOfWeekMonday(new Date(anchorDate.getTime() - 5 * 7 * 86_400_000));
    if (windowStart > minWeeklyStart) {
      windowStart = minWeeklyStart;
    }
  }

  // Generate continuous bucket list
  const buckets: GrowthBucket[] = [];
  const bucketMap = new Map<string, GrowthBucket>();

  if (granularity === 'monthly') {
    let cursor = startOfMonth(windowStart);
    const endCursor = startOfMonth(anchorDate);
    let guard = 0;
    while (cursor <= endCursor && guard < 120) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const bucketEnd = new Date(next.getTime() - 1);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const bucket: GrowthBucket = {
        key,
        label: formatMonthShort(cursor),
        fullLabel: formatMonthFull(cursor),
        startDate: new Date(cursor),
        endDate: bucketEnd,
        storefrontRevenueNzd: 0,
        commissionRevenueNzd: 0,
        totalRevenueNzd: 0,
        ordersCount: 0,
        unitsSold: 0,
        aovNzd: 0,
        commissionRequests: 0,
        commissionQuoted: 0,
        commissionConverted: 0,
        conversionRatePct: 0,
        hasCommissionActivity: false,
        motifCounts: {},
        materialCounts: {},
      };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
      cursor = next;
      guard++;
    }
  } else {
    let cursor = startOfWeekMonday(windowStart);
    const endCursor = startOfWeekMonday(anchorDate);
    let guard = 0;
    while (cursor <= endCursor && guard < 156) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      const bucketEnd = new Date(next.getTime() - 1);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const bucket: GrowthBucket = {
        key,
        label: formatWeekShort(cursor),
        fullLabel: formatWeekFull(cursor, startOfDay(bucketEnd)),
        startDate: new Date(cursor),
        endDate: bucketEnd,
        storefrontRevenueNzd: 0,
        commissionRevenueNzd: 0,
        totalRevenueNzd: 0,
        ordersCount: 0,
        unitsSold: 0,
        aovNzd: 0,
        commissionRequests: 0,
        commissionQuoted: 0,
        commissionConverted: 0,
        conversionRatePct: 0,
        hasCommissionActivity: false,
        motifCounts: {},
        materialCounts: {},
      };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
      cursor = next;
      guard++;
    }
  }

  const getKeyForDate = (date: Date): string => {
    if (granularity === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    const wk = startOfWeekMonday(date);
    return `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, '0')}-${String(wk.getDate()).padStart(2, '0')}`;
  };

  // Track design and stone demand aggregates in selected range
  const designAgg = new Map<
    string,
    { orderUnits: number; commissionCount: number; revenueCents: number }
  >();
  const materialAgg = new Map<
    string,
    { orderUnits: number; commissionCount: number; revenueCents: number }
  >();

  const bumpDesign = (name: string, orderUnits: number, commissionCount: number, revenueCents: number) => {
    const existing = designAgg.get(name) || { orderUnits: 0, commissionCount: 0, revenueCents: 0 };
    existing.orderUnits += orderUnits;
    existing.commissionCount += commissionCount;
    existing.revenueCents += revenueCents;
    designAgg.set(name, existing);
  };

  const bumpMaterial = (name: string, orderUnits: number, commissionCount: number, revenueCents: number) => {
    const existing = materialAgg.get(name) || { orderUnits: 0, commissionCount: 0, revenueCents: 0 };
    existing.orderUnits += orderUnits;
    existing.commissionCount += commissionCount;
    existing.revenueCents += revenueCents;
    materialAgg.set(name, existing);
  };

  const windowStartMs = buckets[0]?.startDate.getTime() ?? 0;
  const windowEndMs = buckets[buckets.length - 1]?.endDate.getTime() ?? anchorTime;

  const filteredOrders = settledOrders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return Number.isFinite(t) && t >= windowStartMs && t <= windowEndMs;
  });

  const filteredCommissions = commissions.filter((c) => {
    const t = new Date(c.createdAt).getTime();
    return Number.isFinite(t) && t >= windowStartMs && t <= windowEndMs;
  });

  filteredOrders.forEach((order) => {
    const d = new Date(order.createdAt);
    const bucket = bucketMap.get(getKeyForDate(d));
    if (!bucket) return;

    const netOrderCents = Math.max(0, order.totalCents - (order.refundedAmountCents || 0));
    bucket.storefrontRevenueNzd += netOrderCents / 100;
    bucket.ordersCount += 1;

    order.items.forEach((item) => {
      const qty = Math.max(1, item.quantity || 1);
      bucket.unitsSold += qty;

      const linkedProduct = productById.get(item.productId);
      const designName = normalizeDesignFamily(item.designType || linkedProduct?.designType);
      const stoneName = normalizeStoneFamily(item.material || linkedProduct?.material);
      const lineCents = Math.round(item.priceCents * qty);

      bucket.motifCounts[designName] = (bucket.motifCounts[designName] || 0) + qty;
      bucket.materialCounts[stoneName] = (bucket.materialCounts[stoneName] || 0) + qty;

      bumpDesign(designName, qty, 0, lineCents);
      bumpMaterial(stoneName, qty, 0, lineCents);
    });
  });

  filteredCommissions.forEach((comm) => {
    const d = new Date(comm.createdAt);
    const bucket = bucketMap.get(getKeyForDate(d));
    if (!bucket) return;

    bucket.commissionRequests += 1;
    bucket.hasCommissionActivity = true;

    if (QUOTED_PLUS_STATUSES.has(comm.status)) {
      bucket.commissionQuoted += 1;
    }
    if (CONVERTED_STATUSES.has(comm.status)) {
      bucket.commissionConverted += 1;
    }

    const realizedCents = getCommissionRealizedCents(comm);
    bucket.commissionRevenueNzd += realizedCents / 100;

    const designName = normalizeDesignFamily(comm.designType);
    const stoneName = normalizeStoneFamily(comm.material);

    bucket.motifCounts[designName] = (bucket.motifCounts[designName] || 0) + 1;
    bucket.materialCounts[stoneName] = (bucket.materialCounts[stoneName] || 0) + 1;

    bumpDesign(designName, 0, 1, realizedCents);
    bumpMaterial(stoneName, 0, 1, realizedCents);
  });

  // Finalize derived fields on each bucket
  buckets.forEach((b) => {
    b.storefrontRevenueNzd = Math.round(b.storefrontRevenueNzd * 100) / 100;
    b.commissionRevenueNzd = Math.round(b.commissionRevenueNzd * 100) / 100;
    b.totalRevenueNzd = Math.round((b.storefrontRevenueNzd + b.commissionRevenueNzd) * 100) / 100;
    b.aovNzd =
      b.ordersCount > 0 ? Math.round((b.storefrontRevenueNzd / b.ordersCount) * 100) / 100 : 0;
    b.conversionRatePct =
      b.commissionRequests > 0
        ? Math.round((b.commissionConverted / b.commissionRequests) * 1000) / 10
        : 0;
  });

  // Build popularity rankings
  const totalDesignDemand = Array.from(designAgg.values()).reduce(
    (s, v) => s + v.orderUnits + v.commissionCount,
    0
  );
  const designRanking: PopularityRankingItem[] = Array.from(designAgg.entries())
    .map(([name, val]) => {
      const totalDemand = val.orderUnits + val.commissionCount;
      return {
        name,
        orderUnits: val.orderUnits,
        commissionCount: val.commissionCount,
        totalDemand,
        revenueNzd: Math.round((val.revenueCents / 100) * 100) / 100,
        sharePct: totalDesignDemand > 0 ? Math.round((totalDemand / totalDesignDemand) * 1000) / 10 : 0,
        color: '#1B382B',
      };
    })
    .sort((a, b) => b.totalDemand - a.totalDemand || b.revenueNzd - a.revenueNzd)
    .map((item, idx) => ({
      ...item,
      color: MOTIF_PALETTE[idx % MOTIF_PALETTE.length],
    }));

  const totalMaterialDemand = Array.from(materialAgg.values()).reduce(
    (s, v) => s + v.orderUnits + v.commissionCount,
    0
  );
  const materialRanking: PopularityRankingItem[] = Array.from(materialAgg.entries())
    .map(([name, val]) => {
      const totalDemand = val.orderUnits + val.commissionCount;
      return {
        name,
        orderUnits: val.orderUnits,
        commissionCount: val.commissionCount,
        totalDemand,
        revenueNzd: Math.round((val.revenueCents / 100) * 100) / 100,
        sharePct:
          totalMaterialDemand > 0 ? Math.round((totalDemand / totalMaterialDemand) * 1000) / 10 : 0,
        color: '#1B382B',
      };
    })
    .sort((a, b) => b.totalDemand - a.totalDemand || b.revenueNzd - a.revenueNzd)
    .map((item, idx) => ({
      ...item,
      color: MOTIF_PALETTE[idx % MOTIF_PALETTE.length],
    }));

  // Build commission conversion funnel
  const reqTotal = filteredCommissions.length;
  const quotedTotal = filteredCommissions.filter((c) => QUOTED_PLUS_STATUSES.has(c.status)).length;
  const acceptedTotal = filteredCommissions.filter((c) => CONVERTED_STATUSES.has(c.status)).length;
  const paidTotal = filteredCommissions.filter((c) => PAID_STATUSES.has(c.status)).length;
  const completedTotal = filteredCommissions.filter((c) => COMPLETED_STATUSES.has(c.status)).length;

  const pct = (n: number) => (reqTotal > 0 ? Math.round((n / reqTotal) * 1000) / 10 : 0);

  const funnel: CommissionFunnelStage[] = [
    { id: 'requested', label: 'Requested', count: reqTotal, pctOfRequests: reqTotal > 0 ? 100 : 0, color: '#526058' },
    { id: 'quoted', label: 'Quoted', count: quotedTotal, pctOfRequests: pct(quotedTotal), color: '#4B7A65' },
    { id: 'accepted', label: 'Accepted', count: acceptedTotal, pctOfRequests: pct(acceptedTotal), color: '#2D5A46' },
    { id: 'paid', label: 'Deposit / Paid', count: paidTotal, pctOfRequests: pct(paidTotal), color: '#1B382B' },
    { id: 'completed', label: 'Ready / Shipped', count: completedTotal, pctOfRequests: pct(completedTotal), color: '#C29B38' },
  ];

  // Overall period summary
  const storefrontRevenueNzd = Math.round(
    buckets.reduce((s, b) => s + b.storefrontRevenueNzd, 0) * 100
  ) / 100;
  const commissionRevenueNzd = Math.round(
    buckets.reduce((s, b) => s + b.commissionRevenueNzd, 0) * 100
  ) / 100;
  const totalRevenueNzd = Math.round((storefrontRevenueNzd + commissionRevenueNzd) * 100) / 100;
  const totalOrders = filteredOrders.length;
  const totalUnitsSold = buckets.reduce((s, b) => s + b.unitsSold, 0);
  const overallConversionPct = reqTotal > 0 ? Math.round((acceptedTotal / reqTotal) * 1000) / 10 : 0;

  // Compare second half of buckets vs first half for genuine trend delta
  let revenueDeltaPct: number | null = null;
  if (buckets.length >= 2) {
    const mid = Math.floor(buckets.length / 2);
    const prevHalf = buckets.slice(0, mid).reduce((s, b) => s + b.totalRevenueNzd, 0);
    const currHalf = buckets.slice(mid).reduce((s, b) => s + b.totalRevenueNzd, 0);
    if (prevHalf > 0) {
      revenueDeltaPct = Math.round(((currHalf - prevHalf) / prevHalf) * 1000) / 10;
    } else if (currHalf > 0) {
      revenueDeltaPct = 100;
    }
  }

  return {
    buckets,
    funnel,
    topDesigns: designRanking.slice(0, 5).map((d) => d.name),
    topMaterials: materialRanking.slice(0, 5).map((m) => m.name),
    designRanking,
    materialRanking,
    summary: {
      totalRevenueNzd,
      storefrontRevenueNzd,
      commissionRevenueNzd,
      totalOrders,
      totalUnitsSold,
      totalCommissionRequests: reqTotal,
      totalCommissionConverted: acceptedTotal,
      overallConversionPct,
      revenueDeltaPct,
      topMotif: designRanking[0]?.name || null,
      topMaterial: materialRanking[0]?.name || null,
      hasAnyData: filteredOrders.length > 0 || filteredCommissions.length > 0,
    },
  };
}
