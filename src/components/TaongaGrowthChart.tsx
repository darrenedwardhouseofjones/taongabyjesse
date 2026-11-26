import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Sparkles,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import type { CustomCommission, Order, Product } from '../types';
import {
  computeTaongaGrowthAnalytics,
  type GrowthBucket,
  type GrowthChartTab,
  type GrowthGranularity,
  type GrowthTimeRange,
  MOTIF_PALETTE,
  type PopularityDimension,
  resolveDefaultGranularity,
} from '../utils/growthMetrics';

interface TaongaGrowthChartProps {
  orders: Order[];
  commissions: CustomCommission[];
  products: Product[];
  onNavigateTab?: (tab: 'orders' | 'commissions' | 'catalogue') => void;
}

const formatCurrencyShort = (nzd: number): string => {
  if (nzd >= 10_000) return `$${(nzd / 1000).toFixed(1)}k`;
  if (nzd >= 1_000) return `$${(nzd / 1000).toFixed(1)}k`;
  return `$${Math.round(nzd)}`;
};

const formatCurrencyFull = (nzd: number): string =>
  `$${nzd.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD`;

interface HoverState {
  bucket: GrowthBucket;
  xPx: number;
  yPx: number;
}

export const TaongaGrowthChart: React.FC<TaongaGrowthChartProps> = ({
  orders,
  commissions,
  products,
  onNavigateTab,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<GrowthChartTab>('overview');
  const [timeRange, setTimeRange] = useState<GrowthTimeRange>('6M');
  const [granularity, setGranularity] = useState<GrowthGranularity>('monthly');
  const [popularityDimension, setPopularityDimension] = useState<PopularityDimension>('design');
  const [highlightedSeries, setHighlightedSeries] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [hoveredFunnelId, setHoveredFunnelId] = useState<string | null>(null);

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const mainSvgRef = useRef<SVGSVGElement | null>(null);
  const funnelContainerRef = useRef<HTMLDivElement | null>(null);
  const funnelSvgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(760);
  const [funnelWidth, setFunnelWidth] = useState<number>(380);

  const handleSelectRange = (nextRange: GrowthTimeRange) => {
    setTimeRange(nextRange);
    setGranularity(resolveDefaultGranularity(nextRange));
    setHoverState(null);
  };

  const analytics = useMemo(
    () =>
      computeTaongaGrowthAnalytics({
        orders,
        commissions,
        products,
        range: timeRange,
        granularity,
      }),
    [orders, commissions, products, timeRange, granularity]
  );

  // Reset highlighted series when switching popularity dimension or chart tab
  useEffect(() => {
    setHighlightedSeries(null);
    setHoverState(null);
  }, [activeChartTab, popularityDimension]);

  // Responsive ResizeObserver for D3 SVGs
  useEffect(() => {
    const mainEl = mainContainerRef.current;
    const funnelEl = funnelContainerRef.current;

    const updateSizes = () => {
      if (mainEl) {
        const w = Math.floor(mainEl.getBoundingClientRect().width);
        if (w > 220) setContainerWidth(w);
      }
      if (funnelEl) {
        const fw = Math.floor(funnelEl.getBoundingClientRect().width);
        if (fw > 180) setFunnelWidth(fw);
      }
    };

    updateSizes();
    const ro = new ResizeObserver(updateSizes);
    if (mainEl) ro.observe(mainEl);
    if (funnelEl) ro.observe(funnelEl);
    return () => ro.disconnect();
  }, [activeChartTab, analytics.summary.hasAnyData]);

  // Render primary D3 chart SVG (Overview / Sales / Commissions / Popularity)
  useEffect(() => {
    const svgNode = mainSvgRef.current;
    if (!svgNode || !analytics.summary.hasAnyData) return;

    const buckets = analytics.buckets;
    if (buckets.length === 0) return;

    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();

    const width = Math.max(320, containerWidth);
    const height = activeChartTab === 'commissions' ? 300 : 340;
    const margin = {
      top: 24,
      right: activeChartTab === 'overview' || activeChartTab === 'sales' ? 54 : 24,
      bottom: 36,
      left: 58,
    };
    const innerWidth = Math.max(180, width - margin.left - margin.right);
    const innerHeight = Math.max(160, height - margin.top - margin.bottom);

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height);

    const defs = svg.append('defs');
    const jadeGrad = defs
      .append('linearGradient')
      .attr('id', 'tbj-jade-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    jadeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1B382B').attr('stop-opacity', 0.24);
    jadeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#1B382B').attr('stop-opacity', 0.01);

    const goldGrad = defs
      .append('linearGradient')
      .attr('id', 'tbj-gold-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    goldGrad.append('stop').attr('offset', '0%').attr('stop-color', '#C29B38').attr('stop-opacity', 0.22);
    goldGrad.append('stop').attr('offset', '100%').attr('stop-color', '#C29B38').attr('stop-opacity', 0.01);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xBand = d3
      .scaleBand<string>()
      .domain(buckets.map((b) => b.key))
      .range([0, innerWidth])
      .padding(0.28);

    const xCenter = (b: GrowthBucket) => (xBand(b.key) ?? 0) + xBand.bandwidth() / 2;

    // Thin X ticks cleanly so labels never overlap
    const maxTicks = width < 480 ? 5 : width < 720 ? 7 : 12;
    const step = Math.max(1, Math.ceil(buckets.length / maxTicks));
    const tickValues = buckets
      .filter((_, idx) => idx % step === 0 || idx === buckets.length - 1)
      .map((b) => b.key);

    const labelByKey = new Map<string, string>(buckets.map((b) => [b.key, b.label]));

    const drawXAxis = () => {
      const xAxis = d3
        .axisBottom(xBand)
        .tickValues(tickValues)
        .tickFormat((k) => labelByKey.get(k) || k)
        .tickSizeOuter(0);

      const ax = g
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

      ax.select('.domain').attr('stroke', '#E8E2D6');
      ax.selectAll('.tick line').attr('stroke', '#E8E2D6');
      ax.selectAll('text')
        .attr('fill', '#526058')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    };

    const drawGrid = (yScale: d3.ScaleLinear<number, number>) => {
      g.append('g')
        .attr('class', 'tbj-grid')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => '')
        )
        .call((grid) => grid.select('.domain').remove())
        .call((grid) =>
          grid
            .selectAll('.tick line')
            .attr('stroke', '#E8E2D6')
            .attr('stroke-dasharray', '3,3')
            .attr('stroke-opacity', 0.85)
        );
    };

    // Vertical interactive crosshair guide
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#1B382B')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-opacity', 0.45)
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const focusHighlightGroup = g
      .append('g')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    if (activeChartTab === 'overview') {
      const maxRev = Math.max(500, d3.max(buckets, (b) => b.totalRevenueNzd) || 0);
      const yRev = d3.scaleLinear().domain([0, maxRev * 1.15]).nice().range([innerHeight, 0]);
      const yConv = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
      const maxActivity = Math.max(2, d3.max(buckets, (b) => b.unitsSold + b.commissionRequests) || 0);
      const yVol = d3.scaleLinear().domain([0, maxActivity * 1.4]).range([innerHeight, innerHeight * 0.45]);

      drawGrid(yRev);
      drawXAxis();

      const leftAx = g
        .append('g')
        .call(
          d3
            .axisLeft(yRev)
            .ticks(5)
            .tickFormat((d) => formatCurrencyShort(Number(d)))
            .tickSizeOuter(0)
        );
      leftAx.select('.domain').remove();
      leftAx.selectAll('.tick line').remove();
      leftAx
        .selectAll('text')
        .attr('fill', '#1B382B')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      const rightAx = g
        .append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(
          d3
            .axisRight(yConv)
            .ticks(4)
            .tickFormat((d) => `${Number(d)}%`)
            .tickSizeOuter(0)
        );
      rightAx.select('.domain').remove();
      rightAx.selectAll('.tick line').remove();
      rightAx
        .selectAll('text')
        .attr('fill', '#9F7A1C')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      // Subtle background volume bars (units sold + custom commission inquiries)
      g.selectAll('.tbj-vol-bar')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('class', 'tbj-vol-bar')
        .attr('x', (b) => xBand(b.key) ?? 0)
        .attr('width', xBand.bandwidth())
        .attr('y', (b) => yVol(b.unitsSold + b.commissionRequests))
        .attr('height', (b) => Math.max(0, innerHeight - yVol(b.unitsSold + b.commissionRequests)))
        .attr('rx', 3)
        .attr('fill', '#2D5A46')
        .attr('fill-opacity', 0.14);

      // Total Revenue area + line
      const revArea = d3
        .area<GrowthBucket>()
        .x(xCenter)
        .y0(innerHeight)
        .y1((b) => yRev(b.totalRevenueNzd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(buckets)
        .attr('d', revArea)
        .attr('fill', 'url(#tbj-jade-area)');

      const revLine = d3
        .line<GrowthBucket>()
        .x(xCenter)
        .y((b) => yRev(b.totalRevenueNzd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(buckets)
        .attr('d', revLine)
        .attr('fill', 'none')
        .attr('stroke', '#1B382B')
        .attr('stroke-width', 2.5);

      // Conversion rate gold line
      const convLine = d3
        .line<GrowthBucket>()
        .x(xCenter)
        .y((b) => yConv(b.conversionRatePct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(buckets)
        .attr('d', convLine)
        .attr('fill', 'none')
        .attr('stroke', '#C29B38')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3');

      // Revenue & conversion circle nodes
      g.selectAll('.tbj-rev-dot')
        .data(buckets)
        .enter()
        .append('circle')
        .attr('cx', xCenter)
        .attr('cy', (b) => yRev(b.totalRevenueNzd))
        .attr('r', 3.5)
        .attr('fill', '#FFFFFF')
        .attr('stroke', '#1B382B')
        .attr('stroke-width', 2);

      g.selectAll('.tbj-conv-dot')
        .data(buckets.filter((b) => b.hasCommissionActivity))
        .enter()
        .append('circle')
        .attr('cx', xCenter)
        .attr('cy', (b) => yConv(b.conversionRatePct))
        .attr('r', 4)
        .attr('fill', '#C29B38')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1.5);

      const dotRev = focusHighlightGroup
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#1B382B')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);
      const dotConv = focusHighlightGroup
        .append('circle')
        .attr('r', 5.5)
        .attr('fill', '#C29B38')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);

      // Interactive hover overlay per column band
      g.selectAll('.tbj-hover-band')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => (xBand(b.key) ?? 0) - xBand.step() * xBand.paddingInner() * 0.5)
        .attr('y', 0)
        .attr('width', xBand.step())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mouseenter mousemove', (_, b) => {
          const cx = xCenter(b);
          const cy = yRev(b.totalRevenueNzd);
          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          dotRev.attr('cx', cx).attr('cy', cy);
          dotConv
            .attr('cx', cx)
            .attr('cy', yConv(b.conversionRatePct))
            .style('opacity', b.hasCommissionActivity ? 1 : 0.35);
          focusHighlightGroup.style('opacity', 1);
          setHoverState({
            bucket: b,
            xPx: margin.left + cx,
            yPx: margin.top + Math.min(cy, yConv(b.conversionRatePct)),
          });
        })
        .on('mouseleave', () => {
          crosshair.style('opacity', 0);
          focusHighlightGroup.style('opacity', 0);
          setHoverState(null);
        });
    } else if (activeChartTab === 'sales') {
      const maxTotal = Math.max(
        500,
        d3.max(buckets, (b) => Math.max(b.totalRevenueNzd, b.aovNzd)) || 0
      );
      const yRev = d3.scaleLinear().domain([0, maxTotal * 1.15]).nice().range([innerHeight, 0]);
      const maxAov = Math.max(250, d3.max(buckets, (b) => b.aovNzd) || 0);
      const yAov = d3.scaleLinear().domain([0, maxAov * 1.25]).nice().range([innerHeight, 0]);

      drawGrid(yRev);
      drawXAxis();

      const leftAx = g
        .append('g')
        .call(
          d3
            .axisLeft(yRev)
            .ticks(5)
            .tickFormat((d) => formatCurrencyShort(Number(d)))
            .tickSizeOuter(0)
        );
      leftAx.select('.domain').remove();
      leftAx.selectAll('.tick line').remove();
      leftAx
        .selectAll('text')
        .attr('fill', '#1B382B')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      const rightAx = g
        .append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(
          d3
            .axisRight(yAov)
            .ticks(4)
            .tickFormat((d) => formatCurrencyShort(Number(d)))
            .tickSizeOuter(0)
        );
      rightAx.select('.domain').remove();
      rightAx.selectAll('.tick line').remove();
      rightAx
        .selectAll('text')
        .attr('fill', '#9F7A1C')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      const stackGen = d3
        .stack<GrowthBucket>()
        .keys(['storefrontRevenueNzd', 'commissionRevenueNzd']);
      const stackedSeries = stackGen(buckets);
      const seriesColor: Record<string, string> = {
        storefrontRevenueNzd: '#1B382B',
        commissionRevenueNzd: '#4B7A65',
      };

      g.selectAll('.tbj-stack-layer')
        .data(stackedSeries)
        .enter()
        .append('g')
        .attr('fill', (s) => seriesColor[s.key] || '#1B382B')
        .selectAll('rect')
        .data((s) => s)
        .enter()
        .append('rect')
        .attr('x', (d) => xBand(d.data.key) ?? 0)
        .attr('y', (d) => yRev(d[1]))
        .attr('height', (d) => Math.max(0, yRev(d[0]) - yRev(d[1])))
        .attr('width', xBand.bandwidth())
        .attr('rx', 2);

      // AOV trajectory overlay line
      const aovLine = d3
        .line<GrowthBucket>()
        .x(xCenter)
        .y((b) => yAov(b.aovNzd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(buckets)
        .attr('d', aovLine)
        .attr('fill', 'none')
        .attr('stroke', '#C29B38')
        .attr('stroke-width', 2.25);

      g.selectAll('.tbj-aov-dot')
        .data(buckets.filter((b) => b.ordersCount > 0))
        .enter()
        .append('circle')
        .attr('cx', xCenter)
        .attr('cy', (b) => yAov(b.aovNzd))
        .attr('r', 4)
        .attr('fill', '#C29B38')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1.5);

      const focusDot = focusHighlightGroup
        .append('circle')
        .attr('r', 5.5)
        .attr('fill', '#C29B38')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);

      g.selectAll('.tbj-hover-band')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => (xBand(b.key) ?? 0) - xBand.step() * xBand.paddingInner() * 0.5)
        .attr('y', 0)
        .attr('width', xBand.step())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mouseenter mousemove', (_, b) => {
          const cx = xCenter(b);
          const cy = yRev(b.totalRevenueNzd);
          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          focusDot.attr('cx', cx).attr('cy', yAov(b.aovNzd));
          focusHighlightGroup.style('opacity', 1);
          setHoverState({
            bucket: b,
            xPx: margin.left + cx,
            yPx: margin.top + cy,
          });
        })
        .on('mouseleave', () => {
          crosshair.style('opacity', 0);
          focusHighlightGroup.style('opacity', 0);
          setHoverState(null);
        });
    } else if (activeChartTab === 'commissions') {
      const yConv = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
      const maxReq = Math.max(3, d3.max(buckets, (b) => b.commissionRequests) || 0);
      const yReq = d3.scaleLinear().domain([0, maxReq * 1.4]).range([innerHeight, innerHeight * 0.4]);

      drawGrid(yConv);
      drawXAxis();

      const leftAx = g
        .append('g')
        .call(
          d3
            .axisLeft(yConv)
            .ticks(5)
            .tickFormat((d) => `${Number(d)}%`)
            .tickSizeOuter(0)
        );
      leftAx.select('.domain').remove();
      leftAx.selectAll('.tick line').remove();
      leftAx
        .selectAll('text')
        .attr('fill', '#9F7A1C')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      // Commission inquiries vs converted grouped bars in background
      const subBarWidth = Math.max(6, xBand.bandwidth() * 0.42);
      g.selectAll('.tbj-comm-req-bar')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => (xBand(b.key) ?? 0) + (xBand.bandwidth() - subBarWidth * 2 - 2) / 2)
        .attr('width', subBarWidth)
        .attr('y', (b) => yReq(b.commissionRequests))
        .attr('height', (b) => Math.max(0, innerHeight - yReq(b.commissionRequests)))
        .attr('rx', 2)
        .attr('fill', '#526058')
        .attr('fill-opacity', 0.22);

      g.selectAll('.tbj-comm-conv-bar')
        .data(buckets)
        .enter()
        .append('rect')
        .attr(
          'x',
          (b) => (xBand(b.key) ?? 0) + (xBand.bandwidth() - subBarWidth * 2 - 2) / 2 + subBarWidth + 2
        )
        .attr('width', subBarWidth)
        .attr('y', (b) => yReq(b.commissionConverted))
        .attr('height', (b) => Math.max(0, innerHeight - yReq(b.commissionConverted)))
        .attr('rx', 2)
        .attr('fill', '#1B382B')
        .attr('fill-opacity', 0.35);

      const convArea = d3
        .area<GrowthBucket>()
        .x(xCenter)
        .y0(innerHeight)
        .y1((b) => yConv(b.conversionRatePct))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(buckets).attr('d', convArea).attr('fill', 'url(#tbj-gold-area)');

      const convLine = d3
        .line<GrowthBucket>()
        .x(xCenter)
        .y((b) => yConv(b.conversionRatePct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(buckets)
        .attr('d', convLine)
        .attr('fill', 'none')
        .attr('stroke', '#C29B38')
        .attr('stroke-width', 2.5);

      g.selectAll('.tbj-conv-point')
        .data(buckets)
        .enter()
        .append('circle')
        .attr('cx', xCenter)
        .attr('cy', (b) => yConv(b.conversionRatePct))
        .attr('r', (b) => (b.hasCommissionActivity ? 4.5 : 2.5))
        .attr('fill', (b) => (b.hasCommissionActivity ? '#C29B38' : '#FFFFFF'))
        .attr('stroke', '#C29B38')
        .attr('stroke-width', 2);

      const dot = focusHighlightGroup
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#C29B38')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);

      g.selectAll('.tbj-hover-band')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => (xBand(b.key) ?? 0) - xBand.step() * xBand.paddingInner() * 0.5)
        .attr('y', 0)
        .attr('width', xBand.step())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mouseenter mousemove', (_, b) => {
          const cx = xCenter(b);
          const cy = yConv(b.conversionRatePct);
          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          dot.attr('cx', cx).attr('cy', cy);
          focusHighlightGroup.style('opacity', 1);
          setHoverState({
            bucket: b,
            xPx: margin.left + cx,
            yPx: margin.top + cy,
          });
        })
        .on('mouseleave', () => {
          crosshair.style('opacity', 0);
          focusHighlightGroup.style('opacity', 0);
          setHoverState(null);
        });
    } else if (activeChartTab === 'popularity') {
      const seriesKeys =
        popularityDimension === 'design' ? analytics.topDesigns : analytics.topMaterials;
      const getCount = (b: GrowthBucket, name: string) =>
        popularityDimension === 'design'
          ? b.motifCounts[name] || 0
          : b.materialCounts[name] || 0;

      const maxCount = Math.max(
        3,
        d3.max(buckets, (b) => d3.max(seriesKeys, (k) => getCount(b, k)) || 0) || 0
      );
      const yCount = d3.scaleLinear().domain([0, maxCount * 1.2]).nice().range([innerHeight, 0]);

      drawGrid(yCount);
      drawXAxis();

      const leftAx = g
        .append('g')
        .call(
          d3
            .axisLeft(yCount)
            .ticks(5)
            .tickFormat((d) => `${Math.round(Number(d))}`)
            .tickSizeOuter(0)
        );
      leftAx.select('.domain').remove();
      leftAx.selectAll('.tick line').remove();
      leftAx
        .selectAll('text')
        .attr('fill', '#18231C')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      seriesKeys.forEach((seriesName, idx) => {
        const color = MOTIF_PALETTE[idx % MOTIF_PALETTE.length];
        const isDimmed = Boolean(highlightedSeries && highlightedSeries !== seriesName);

        const lineGen = d3
          .line<GrowthBucket>()
          .x(xCenter)
          .y((b) => yCount(getCount(b, seriesName)))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(buckets)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', highlightedSeries === seriesName ? 3 : 2)
          .attr('stroke-opacity', isDimmed ? 0.2 : 0.92);

        g.selectAll(`.tbj-pop-dot-${idx}`)
          .data(buckets.filter((b) => getCount(b, seriesName) > 0))
          .enter()
          .append('circle')
          .attr('cx', xCenter)
          .attr('cy', (b) => yCount(getCount(b, seriesName)))
          .attr('r', highlightedSeries === seriesName ? 4.5 : 3.5)
          .attr('fill', color)
          .attr('fill-opacity', isDimmed ? 0.2 : 1)
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 1.5);
      });

      g.selectAll('.tbj-hover-band')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => (xBand(b.key) ?? 0) - xBand.step() * xBand.paddingInner() * 0.5)
        .attr('y', 0)
        .attr('width', xBand.step())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mouseenter mousemove', (_, b) => {
          const cx = xCenter(b);
          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          setHoverState({
            bucket: b,
            xPx: margin.left + cx,
            yPx: margin.top + 36,
          });
        })
        .on('mouseleave', () => {
          crosshair.style('opacity', 0);
          setHoverState(null);
        });
    }
  }, [
    analytics,
    activeChartTab,
    containerWidth,
    popularityDimension,
    highlightedSeries,
  ]);

  // Render secondary D3 Horizontal Funnel SVG on Commissions tab
  useEffect(() => {
    const svgNode = funnelSvgRef.current;
    if (!svgNode || activeChartTab !== 'commissions' || !analytics.summary.hasAnyData) return;

    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();

    const width = Math.max(240, funnelWidth);
    const stages = analytics.funnel;
    const rowHeight = 46;
    const margin = { top: 8, right: 56, bottom: 12, left: 108 };
    const height = margin.top + margin.bottom + stages.length * rowHeight;
    const innerWidth = Math.max(100, width - margin.left - margin.right);

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const maxCount = Math.max(1, d3.max(stages, (s) => s.count) || 1);
    const xScale = d3.scaleLinear().domain([0, maxCount]).range([0, innerWidth]);

    stages.forEach((stage, i) => {
      const y = i * rowHeight + 8;
      const barH = 24;
      const isHovered = hoveredFunnelId === stage.id;

      const row = g
        .append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredFunnelId(stage.id))
        .on('mouseleave', () => setHoveredFunnelId(null));

      // Stage label left
      row
        .append('text')
        .attr('x', -10)
        .attr('y', y + barH / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', isHovered ? '#1B382B' : '#18231C')
        .attr('font-size', '11px')
        .attr('font-weight', isHovered ? '700' : '600')
        .text(stage.label);

      // Track background
      row
        .append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', innerWidth)
        .attr('height', barH)
        .attr('rx', 6)
        .attr('fill', '#FAF9F6')
        .attr('stroke', '#E8E2D6');

      // Filled conversion progress bar
      const fillW = stage.count > 0 ? Math.max(6, xScale(stage.count)) : 0;
      row
        .append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', fillW)
        .attr('height', barH)
        .attr('rx', 6)
        .attr('fill', stage.color)
        .attr('fill-opacity', isHovered ? 1 : 0.88);

      // Count + % label right
      row
        .append('text')
        .attr('x', innerWidth + 8)
        .attr('y', y + barH / 2 + 4)
        .attr('fill', '#18231C')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
        .text(`${stage.count} (${stage.pctOfRequests.toFixed(0)}%)`);
    });
  }, [analytics.funnel, analytics.summary.hasAnyData, activeChartTab, funnelWidth, hoveredFunnelId]);

  const activeRanking =
    popularityDimension === 'design' ? analytics.designRanking : analytics.materialRanking;

  const { summary } = analytics;

  return (
    <section
      aria-label="Taonga by Jesse Growth Analytics"
      className="bg-white rounded-2xl border border-[#E8E2D6] p-6 space-y-6"
    >
      {/* Top Header & Interactive Timeframe / Granularity Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#2D5A46] font-semibold">
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Studio Performance Intelligence</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#526058] font-normal">D3 Time-Series Engine</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#18231C]">
            Taonga by Jesse Growth
          </h2>
          <p className="text-xs text-[#526058]">
            Sales trajectory, bespoke commission conversion rates, and piece popularity over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Range Switcher */}
          <div
            role="group"
            aria-label="Growth timeframe selector"
            className="inline-flex items-center gap-0.5 p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs"
          >
            {(['30D', '90D', '6M', '12M', 'ALL'] as GrowthTimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleSelectRange(r)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  timeRange === r
                    ? 'bg-[#1B382B] text-white'
                    : 'text-[#526058] hover:text-[#18231C]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Weekly / Monthly Granularity Toggle */}
          <div
            role="group"
            aria-label="Time bucket granularity"
            className="inline-flex items-center gap-0.5 p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs"
          >
            {(['weekly', 'monthly'] as GrowthGranularity[]).map((gMode) => (
              <button
                key={gMode}
                type="button"
                onClick={() => {
                  setGranularity(gMode);
                  setHoverState(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  granularity === gMode
                    ? 'bg-white text-[#18231C] border border-[#E8E2D6]'
                    : 'text-[#526058] hover:text-[#18231C]'
                }`}
              >
                {gMode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Period Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-[#E8E2D6] pb-5">
        <div className="space-y-1">
          <div className="text-[11px] text-[#526058]">Combined Growth Revenue ({timeRange})</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold text-[#1B382B] tabular-nums">
              {formatCurrencyFull(summary.totalRevenueNzd)}
            </span>
            {summary.revenueDeltaPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold tabular-nums ${
                  summary.revenueDeltaPct >= 0 ? 'text-[#2D5A46]' : 'text-[#A63A2A]'
                }`}
              >
                {summary.revenueDeltaPct >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {summary.revenueDeltaPct >= 0 ? '+' : ''}
                {summary.revenueDeltaPct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#526058] tabular-nums">
            {summary.totalOrders} orders · {summary.totalUnitsSold} storefront pieces
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] text-[#526058]">Commission Conversion Rate</div>
          <div className="font-display text-lg font-bold text-[#9F7A1C] tabular-nums">
            {summary.overallConversionPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-[#526058] tabular-nums">
            {summary.totalCommissionConverted} accepted of {summary.totalCommissionRequests} inquiries
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] text-[#526058]">Bespoke Commission Value</div>
          <div className="font-display text-lg font-bold text-[#2D5A46] tabular-nums">
            {formatCurrencyFull(summary.commissionRevenueNzd)}
          </div>
          <div className="text-[11px] text-[#526058] tabular-nums">
            Storefront: {formatCurrencyFull(summary.storefrontRevenueNzd)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] text-[#526058]">Most Requested Taonga</div>
          <div className="font-display text-lg font-bold text-[#18231C] truncate">
            {summary.topMotif || '—'}
          </div>
          <div className="text-[11px] text-[#526058] truncate">
            Stone: {summary.topMaterial || '—'}
          </div>
        </div>
      </div>

      {/* Interactive Lens Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Growth visualization views"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs"
        >
          {(
            [
              { id: 'overview', label: 'Combined Growth' },
              { id: 'sales', label: 'Sales Trends' },
              { id: 'commissions', label: 'Commission Conversion' },
              { id: 'popularity', label: 'Piece Popularity' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeChartTab === tab.id}
              onClick={() => setActiveChartTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeChartTab === tab.id
                  ? 'bg-[#1B382B] text-white'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeChartTab === 'popularity' && (
          <div className="inline-flex items-center gap-1 p-1 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setPopularityDimension('design')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                popularityDimension === 'design'
                  ? 'bg-white text-[#18231C] border border-[#E8E2D6]'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              By Design Motif
            </button>
            <button
              type="button"
              onClick={() => setPopularityDimension('material')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                popularityDimension === 'material'
                  ? 'bg-white text-[#18231C] border border-[#E8E2D6]'
                  : 'text-[#526058] hover:text-[#18231C]'
              }`}
            >
              By Stone Variety
            </button>
          </div>
        )}
      </div>

      {/* Empty State vs Live D3 Charts */}
      {!summary.hasAnyData ? (
        <div className="rounded-2xl border border-dashed border-[#D6CEC0] bg-[#FAF9F6]/70 px-6 py-12 text-center space-y-3">
          <BarChart3 className="w-8 h-8 text-[#2D5A46] mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-bold text-[#18231C]">
              No studio sales or commission activity in this {timeRange} window yet
            </h3>
            <p className="text-xs text-[#526058] leading-relaxed">
              Once customers complete storefront orders or submit custom carving requests, the D3 chart automatically plots sales trends, commission quote conversion, and motif popularity over time.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {timeRange !== 'ALL' && (
              <button
                type="button"
                onClick={() => handleSelectRange('ALL')}
                className="px-4 py-2 rounded-lg bg-[#1B382B] text-white text-xs font-semibold hover:bg-[#2D5A46] transition-colors cursor-pointer"
              >
                View All-Time History
              </button>
            )}
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('orders')}
                  className="px-4 py-2 rounded-lg border border-[#E8E2D6] bg-white text-[#18231C] text-xs font-semibold hover:border-[#1B382B] transition-colors cursor-pointer"
                >
                  Open Orders &amp; Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('commissions')}
                  className="px-4 py-2 rounded-lg border border-[#E8E2D6] bg-white text-[#18231C] text-xs font-semibold hover:border-[#1B382B] transition-colors cursor-pointer"
                >
                  View Commissions
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Chart Body Layout */}
          <div
            className={
              activeChartTab === 'commissions'
                ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
                : 'space-y-4'
            }
          >
            {/* Primary Interactive SVG Chart */}
            <div
              className={
                activeChartTab === 'commissions'
                  ? 'xl:col-span-7 space-y-3'
                  : 'space-y-3'
              }
            >
              {/* Inline Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#526058]">
                {activeChartTab === 'overview' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#18231C]">
                      <span className="w-3 h-0.5 bg-[#1B382B] inline-block" />
                      Total Revenue (NZD)
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#9F7A1C]">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-[#C29B38] inline-block" />
                      Commission Conversion (%)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#2D5A46]/25 inline-block" />
                      Units + Inquiries Volume
                    </span>
                  </div>
                )}

                {activeChartTab === 'sales' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#18231C]">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#1B382B] inline-block" />
                      Storefront Taonga Sales
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#18231C]">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#4B7A65] inline-block" />
                      Custom Commission Revenue
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#9F7A1C]">
                      <span className="w-3 h-0.5 bg-[#C29B38] inline-block" />
                      Avg Order Value (Right Axis)
                    </span>
                  </div>
                )}

                {activeChartTab === 'commissions' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#9F7A1C]">
                      <span className="w-3 h-0.5 bg-[#C29B38] inline-block" />
                      Quote Acceptance Rate (%)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#526058]/30 inline-block" />
                      Requests
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#1B382B]/40 inline-block" />
                      Converted
                    </span>
                  </div>
                )}

                {activeChartTab === 'popularity' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#526058] mr-1">
                      Filter motif line:
                    </span>
                    {(popularityDimension === 'design'
                      ? analytics.topDesigns
                      : analytics.topMaterials
                    ).map((seriesName, idx) => {
                      const color = MOTIF_PALETTE[idx % MOTIF_PALETTE.length];
                      const active = highlightedSeries === seriesName;
                      return (
                        <button
                          key={seriesName}
                          type="button"
                          onClick={() =>
                            setHighlightedSeries((prev) =>
                              prev === seriesName ? null : seriesName
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'border-[#1B382B] bg-[#FAF9F6] text-[#18231C]'
                              : highlightedSeries && !active
                              ? 'border-[#E8E2D6] text-[#526058] opacity-55'
                              : 'border-[#E8E2D6] bg-white text-[#18231C] hover:border-[#1B382B]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span>{seriesName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <span className="text-[11px] font-mono text-[#7D8B82] hidden sm:inline">
                  Hover points for period breakdown
                </span>
              </div>

              {/* Relative D3 Canvas Wrapper + Floating Interactive Tooltip */}
              <div ref={mainContainerRef} className="relative w-full overflow-visible">
                <svg
                  ref={mainSvgRef}
                  role="img"
                  aria-label="Taonga by Jesse Growth interactive D3 chart"
                  className="w-full block select-none"
                />

                {hoverState && (
                  <div
                    role="status"
                    style={{
                      left: `${Math.min(
                        Math.max(12, hoverState.xPx > containerWidth * 0.62 ? hoverState.xPx - 236 : hoverState.xPx + 14),
                        Math.max(12, containerWidth - 232)
                      )}px`,
                      top: `${Math.max(8, Math.min(hoverState.yPx - 16, 175))}px`,
                    }}
                    className="pointer-events-none absolute z-20 w-56 rounded-xl border border-[#E8E2D6] bg-white/95 backdrop-blur-xs p-3 shadow-md text-[11px] space-y-1.5"
                  >
                    <div className="font-display font-bold text-xs text-[#18231C] border-b border-[#E8E2D6] pb-1">
                      {hoverState.bucket.fullLabel}
                    </div>

                    {activeChartTab === 'overview' && (
                      <div className="space-y-1 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Combined Revenue</span>
                          <span className="font-mono font-bold text-[#1B382B]">
                            {formatCurrencyFull(hoverState.bucket.totalRevenueNzd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Paid Orders / Units</span>
                          <span className="font-mono font-semibold text-[#18231C]">
                            {hoverState.bucket.ordersCount} ({hoverState.bucket.unitsSold} pcs)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Commission Conv.</span>
                          <span className="font-mono font-bold text-[#9F7A1C]">
                            {hoverState.bucket.commissionRequests > 0
                              ? `${hoverState.bucket.conversionRatePct.toFixed(1)}% (${hoverState.bucket.commissionConverted}/${hoverState.bucket.commissionRequests})`
                              : 'No inquiries'}
                          </span>
                        </div>
                      </div>
                    )}

                    {activeChartTab === 'sales' && (
                      <div className="space-y-1 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Storefront Sales</span>
                          <span className="font-mono font-bold text-[#1B382B]">
                            {formatCurrencyFull(hoverState.bucket.storefrontRevenueNzd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Commission Sales</span>
                          <span className="font-mono font-semibold text-[#2D5A46]">
                            {formatCurrencyFull(hoverState.bucket.commissionRevenueNzd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Avg Order Value</span>
                          <span className="font-mono font-bold text-[#9F7A1C]">
                            {hoverState.bucket.ordersCount > 0
                              ? formatCurrencyFull(hoverState.bucket.aovNzd)
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    {activeChartTab === 'commissions' && (
                      <div className="space-y-1 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Requests Received</span>
                          <span className="font-mono font-semibold text-[#18231C]">
                            {hoverState.bucket.commissionRequests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Quotes Sent</span>
                          <span className="font-mono font-semibold text-[#2D5A46]">
                            {hoverState.bucket.commissionQuoted}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526058]">Accepted / Converted</span>
                          <span className="font-mono font-bold text-[#9F7A1C]">
                            {hoverState.bucket.commissionConverted} ({hoverState.bucket.conversionRatePct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )}

                    {activeChartTab === 'popularity' && (
                      <div className="space-y-1 tabular-nums">
                        {(popularityDimension === 'design'
                          ? analytics.topDesigns
                          : analytics.topMaterials
                        ).map((k, idx) => {
                          const cnt =
                            popularityDimension === 'design'
                              ? hoverState.bucket.motifCounts[k] || 0
                              : hoverState.bucket.materialCounts[k] || 0;
                          return (
                            <div key={k} className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[#526058] truncate">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: MOTIF_PALETTE[idx % MOTIF_PALETTE.length] }}
                                />
                                {k}
                              </span>
                              <span className="font-mono font-bold text-[#18231C]">
                                {cnt} {cnt === 1 ? 'piece' : 'pieces'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel on Commissions Tab: D3 Horizontal Funnel Stage Breakdown */}
            {activeChartTab === 'commissions' && (
              <div className="xl:col-span-5 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6]/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#18231C] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#C29B38]" />
                      Bespoke Conversion Funnel
                    </h3>
                    <p className="text-[11px] text-[#526058]">
                      Progression from initial request to paid &amp; completed carving
                    </p>
                  </div>
                </div>
                <div ref={funnelContainerRef} className="w-full">
                  <svg
                    ref={funnelSvgRef}
                    role="img"
                    aria-label="Bespoke commission conversion funnel chart"
                    className="w-full block select-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Popularity Ranking Table (shown below Popularity chart) */}
          {activeChartTab === 'popularity' && activeRanking.length > 0 && (
            <div className="border-t border-[#E8E2D6] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-[#18231C] flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#2D5A46]" />
                  <span>
                    {popularityDimension === 'design'
                      ? 'Design Motif Popularity Ranking'
                      : 'Stone Variety Popularity Ranking'}
                  </span>
                </h3>
                <span className="text-[11px] text-[#526058]">
                  Combined storefront units &amp; bespoke commission requests
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E2D6] text-[11px] text-[#526058]">
                      <th className="py-2 pr-4 font-semibold">
                        {popularityDimension === 'design' ? 'Design Motif' : 'Stone Variety'}
                      </th>
                      <th className="py-2 px-3 font-semibold text-right">Storefront Sold</th>
                      <th className="py-2 px-3 font-semibold text-right">Custom Requests</th>
                      <th className="py-2 px-3 font-semibold text-right">Total Demand</th>
                      <th className="py-2 px-3 font-semibold text-right">Share</th>
                      <th className="py-2 pl-3 font-semibold text-right">Attributed Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D6]/70">
                    {activeRanking.map((row) => (
                      <tr
                        key={row.name}
                        onClick={() =>
                          setHighlightedSeries((prev) => (prev === row.name ? null : row.name))
                        }
                        className={`cursor-pointer transition-colors ${
                          highlightedSeries === row.name
                            ? 'bg-[#FAF9F6]'
                            : 'hover:bg-[#FAF9F6]/60'
                        }`}
                      >
                        <td className="py-2.5 pr-4 font-semibold text-[#18231C]">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            <span>{row.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#18231C]">
                          {row.orderUnits}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#18231C]">
                          {row.commissionCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#1B382B]">
                          {row.totalDemand}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#526058]">
                          <div className="inline-flex items-center gap-2">
                            <span className="w-16 h-1.5 rounded-full bg-[#E8E2D6] overflow-hidden inline-block">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, row.sharePct)}%`,
                                  backgroundColor: row.color,
                                }}
                              />
                            </span>
                            <span>{row.sharePct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-[#18231C]">
                          {formatCurrencyFull(row.revenueNzd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
