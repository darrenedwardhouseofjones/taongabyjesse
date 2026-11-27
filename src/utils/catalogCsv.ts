import type { PackageSizeCode, Product } from '../types';
import { productPayloadSchema, validateWithSchema } from '../validation/schemas';
import { escapeCsvCell } from './ordersCsv';

export const CATALOG_CSV_HEADERS = [
  'id',
  'sku',
  'title',
  'slug',
  'priceNzd',
  'compareAtPriceNzd',
  'costPriceNzd',
  'weightGrams',
  'defaultPackageSize',
  'quantity',
  'isUniquePiece',
  'isMadeToOrder',
  'material',
  'designType',
  'authenticityCode',
  'originRiver',
  'permitRef',
  'isExportRestricted',
  'description',
  'spiritualMeaning',
  'dimensions',
  'cordDetails',
  'carverName',
  'images',
  'featured',
  'published',
] as const;

const DEFAULT_FALLBACK_PRODUCT_IMAGE = '/src/assets/images/product_toki_pounamu_1794468031889.jpg';

export function buildCatalogCsv(products: Product[]): string {
  const rows = products.map((p) =>
    [
      p.id,
      p.sku,
      p.title,
      p.slug,
      (p.priceCents / 100).toFixed(2),
      p.compareAtPriceCents !== undefined ? (p.compareAtPriceCents / 100).toFixed(2) : '',
      (p.costPriceCents / 100).toFixed(2),
      p.weightGrams,
      p.defaultPackageSize,
      p.quantity,
      p.isUniquePiece,
      p.isMadeToOrder,
      p.material,
      p.designType,
      p.authenticityCode,
      p.originRiver,
      p.permitRef || '',
      p.isExportRestricted,
      p.description,
      p.spiritualMeaning,
      p.dimensions,
      p.cordDetails,
      p.carverName,
      (p.images || []).join('; '),
      p.featured,
      p.published,
    ].map(escapeCsvCell)
  );

  return [
    CATALOG_CSV_HEADERS.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');
}

export function buildCatalogJson(products: Product[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      currency: 'NZD',
      recordCount: products.length,
      products,
    },
    null,
    2
  );
}

export function buildCatalogTemplateCsv(): string {
  const sampleRows = [
    [
      '',
      'TJ-KAW-SAMPLE-01',
      'Arahura River Kawakawa Toki Pendant',
      '',
      '385.00',
      '420.00',
      '140.00',
      '55',
      'BAG-S',
      '1',
      'true',
      'false',
      'Kawakawa Pounamu',
      'Toki (Adze)',
      'NT-90412-AR',
      'Arahura River, West Coast',
      '',
      'false',
      'Hand-carved West Coast Kawakawa toki pendant with satin polish and clean bevels.',
      'Symbol of strength, courage, determination, and leadership.',
      '62mm × 24mm × 8mm',
      'Traditional 4-plait black waxed cord with adjustable slipknot',
      'Jesse',
      '/src/assets/images/product_toki_pounamu_1794468031889.jpg',
      'true',
      'true',
    ],
    [
      '',
      'TJ-INA-SAMPLE-02',
      'Inanga Tear Drop Koru Taonga',
      '',
      '295.00',
      '',
      '95.00',
      '38',
      'BAG-S',
      '3',
      'false',
      'true',
      'Inanga Pounamu',
      'Koru (Spiral)',
      'NT-90418-TA',
      'Taramakau River, West Coast',
      '',
      'false',
      'Soft pearly grey Inanga greenstone koru carved to order in our Napier workshop.',
      'Represents new beginnings, harmony, and continual growth.',
      '48mm × 26mm × 6mm',
      'Traditional 4-plait black waxed cord',
      'Jesse',
      '/src/assets/images/product_koru_inanga_1794468055068.jpg',
      'false',
      'true',
    ],
  ];

  return [
    CATALOG_CSV_HEADERS.map(escapeCsvCell).join(','),
    ...sampleRows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\r\n');
}

function triggerDownload(content: string, mimeType: string, filename: string): string {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function downloadCatalogCsv(
  products: Product[],
  filenamePrefix = 'Pounamu_Atelier_Catalog'
): string {
  const csv = buildCatalogCsv(products);
  const dateStamp = new Date().toISOString().split('T')[0];
  return triggerDownload(
    '\uFEFF' + csv,
    'text/csv;charset=utf-8;',
    `${filenamePrefix}_${dateStamp}.csv`
  );
}

export function downloadCatalogJson(
  products: Product[],
  filenamePrefix = 'Pounamu_Atelier_Catalog'
): string {
  const json = buildCatalogJson(products);
  const dateStamp = new Date().toISOString().split('T')[0];
  return triggerDownload(
    json,
    'application/json;charset=utf-8;',
    `${filenamePrefix}_${dateStamp}.json`
  );
}

export function downloadCatalogTemplateCsv(): string {
  const csv = buildCatalogTemplateCsv();
  return triggerDownload(
    '\uFEFF' + csv,
    'text/csv;charset=utf-8;',
    'Pounamu_Atelier_Inventory_Import_Template.csv'
  );
}

// RFC 4180 CSV Parser handling BOM, quoted fields, commas, escaped "" quotes, and multiline values
export function parseRfc4180Csv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function parseBoolCell(raw: string | undefined, fallback: boolean): boolean {
  if (!raw || !raw.trim()) return fallback;
  const val = raw.trim().toLowerCase();
  if (val === 'true' || val === '1' || val === 'yes' || val === 'y') return true;
  if (val === 'false' || val === '0' || val === 'no' || val === 'n') return false;
  return fallback;
}

function parseNzdToCents(rawNzd: string | undefined, rawCents?: string | undefined): number | undefined {
  if (rawNzd !== undefined && rawNzd.trim() !== '') {
    const cleaned = rawNzd.replace(/[$,\s]/g, '');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return Number.NaN;
    return Math.round(n * 100);
  }
  if (rawCents !== undefined && rawCents.trim() !== '') {
    const n = Number(rawCents.trim());
    if (!Number.isFinite(n)) return Number.NaN;
    return Math.round(n);
  }
  return undefined;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ALLOWED_PACKAGE_SIZES: PackageSizeCode[] = ['BAG-S', 'BAG-M', 'BOX-1', 'BOX-2'];

export interface CatalogImportRowPreview {
  rowNumber: number;
  action: 'create' | 'update';
  matchedProductId?: string;
  product?: Product;
  error?: string;
  rawTitle: string;
  rawSku: string;
}

export interface CatalogImportParseResult {
  fatalError?: string;
  rows: CatalogImportRowPreview[];
  validProducts: Product[];
  errorCount: number;
  createCount: number;
  updateCount: number;
}

export function parseCatalogImportCsv(
  csvText: string,
  existingProducts: Product[]
): CatalogImportParseResult {
  const matrix = parseRfc4180Csv(csvText);
  if (matrix.length < 2) {
    return {
      fatalError:
        'CSV file must include a header row and at least one product row. Download the CSV template to see the expected format.',
      rows: [],
      validProducts: [],
      errorCount: 1,
      createCount: 0,
      updateCount: 0,
    };
  }

  const rawHeaders = matrix[0].map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    const normalized = h.toLowerCase();
    if (!headerIndex.has(normalized)) {
      headerIndex.set(normalized, idx);
    }
  });

  if (!headerIndex.has('title')) {
    return {
      fatalError:
        'Missing required "title" column in CSV header. Download the CSV template for the exact column names.',
      rows: [],
      validProducts: [],
      errorCount: 1,
      createCount: 0,
      updateCount: 0,
    };
  }

  const getCell = (row: string[], ...keys: string[]): string => {
    for (const k of keys) {
      const idx = headerIndex.get(k.toLowerCase());
      if (idx !== undefined && idx < row.length) {
        return row[idx].trim();
      }
    }
    return '';
  };

  const existingById = new Map(existingProducts.map((p) => [p.id, p]));
  const existingBySku = new Map(
    existingProducts
      .filter((p) => p.sku && p.sku.trim().length > 0)
      .map((p) => [p.sku.trim().toLowerCase(), p])
  );

  const rows: CatalogImportRowPreview[] = [];
  const validProducts: Product[] = [];
  let errorCount = 0;
  let createCount = 0;
  let updateCount = 0;

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i];
    const rowNumber = i + 1;
    const rawId = getCell(line, 'id');
    const rawSku = getCell(line, 'sku');
    const rawTitle = getCell(line, 'title');

    const matched =
      (rawId ? existingById.get(rawId) : undefined) ||
      (rawSku ? existingBySku.get(rawSku.toLowerCase()) : undefined);

    const priceCents = parseNzdToCents(
      getCell(line, 'priceNzd', 'price_nzd', 'price'),
      getCell(line, 'priceCents', 'price_cents')
    );
    const compareAtPriceCents = parseNzdToCents(
      getCell(line, 'compareAtPriceNzd', 'compare_at_price_nzd', 'compareAtPrice'),
      getCell(line, 'compareAtPriceCents', 'compare_at_price_cents')
    );
    const costPriceCents = parseNzdToCents(
      getCell(line, 'costPriceNzd', 'cost_price_nzd', 'costPrice'),
      getCell(line, 'costPriceCents', 'cost_price_cents')
    );

    if (priceCents === undefined || Number.isNaN(priceCents)) {
      errorCount++;
      rows.push({
        rowNumber,
        action: matched ? 'update' : 'create',
        matchedProductId: matched?.id,
        rawTitle,
        rawSku,
        error: `Row ${rowNumber}: "priceNzd" must be a valid NZD amount (e.g. 345.00).`,
      });
      continue;
    }

    if (costPriceCents !== undefined && Number.isNaN(costPriceCents)) {
      errorCount++;
      rows.push({
        rowNumber,
        action: matched ? 'update' : 'create',
        matchedProductId: matched?.id,
        rawTitle,
        rawSku,
        error: `Row ${rowNumber}: "costPriceNzd" must be a valid number.`,
      });
      continue;
    }

    if (compareAtPriceCents !== undefined && Number.isNaN(compareAtPriceCents)) {
      errorCount++;
      rows.push({
        rowNumber,
        action: matched ? 'update' : 'create',
        matchedProductId: matched?.id,
        rawTitle,
        rawSku,
        error: `Row ${rowNumber}: "compareAtPriceNzd" must be a valid number.`,
      });
      continue;
    }

    const rawPkg = getCell(line, 'defaultPackageSize', 'packageSize') as PackageSizeCode;
    const defaultPackageSize: PackageSizeCode = ALLOWED_PACKAGE_SIZES.includes(rawPkg)
      ? rawPkg
      : matched?.defaultPackageSize || 'BAG-S';

    const rawWeight = getCell(line, 'weightGrams', 'weight');
    const weightGrams = rawWeight ? Number(rawWeight) : matched?.weightGrams ?? 65;

    const rawQty = getCell(line, 'quantity', 'qty', 'stock');
    const quantity = rawQty ? Number(rawQty) : matched?.quantity ?? 1;

    const rawImages = getCell(line, 'images', 'imageUrl', 'image');
    const parsedImages = rawImages
      ? rawImages
          .split(/[;|]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : matched?.images?.length
        ? matched.images
        : [DEFAULT_FALLBACK_PRODUCT_IMAGE];

    const material = getCell(line, 'material') || matched?.material || 'Kawakawa Pounamu';
    const designType = getCell(line, 'designType', 'design') || matched?.designType || 'Toki (Adze)';
    const slug = getCell(line, 'slug') || matched?.slug || slugifyTitle(rawTitle);
    const id = matched?.id || rawId || `prod-imp-${i}-${slug.slice(0, 24) || 'item'}`;
    const sku = rawSku || matched?.sku || `SKU-${id.replace(/^prod-/, '').toUpperCase().slice(0, 12)}`;

    const candidate: Product = {
      id,
      sku,
      title: rawTitle,
      slug: slug || id,
      priceCents,
      ...(compareAtPriceCents !== undefined ? { compareAtPriceCents } : {}),
      costPriceCents: costPriceCents ?? matched?.costPriceCents ?? 0,
      weightGrams,
      defaultPackageSize,
      quantity,
      isUniquePiece: parseBoolCell(
        getCell(line, 'isUniquePiece'),
        matched?.isUniquePiece ?? false
      ),
      isMadeToOrder: parseBoolCell(
        getCell(line, 'isMadeToOrder'),
        matched?.isMadeToOrder ?? false
      ),
      material,
      designType,
      authenticityCode: getCell(line, 'authenticityCode') || matched?.authenticityCode || '',
      originRiver:
        getCell(line, 'originRiver', 'origin') ||
        matched?.originRiver ||
        'Arahura River, West Coast',
      ...(getCell(line, 'permitRef') || matched?.permitRef
        ? { permitRef: getCell(line, 'permitRef') || matched?.permitRef }
        : {}),
      isExportRestricted: parseBoolCell(
        getCell(line, 'isExportRestricted'),
        matched?.isExportRestricted ?? material.toLowerCase().includes('whale bone')
      ),
      description:
        getCell(line, 'description') ||
        matched?.description ||
        `Master carved ${material} ${designType} by Jesse.`,
      spiritualMeaning:
        getCell(line, 'spiritualMeaning') ||
        matched?.spiritualMeaning ||
        'Symbol of mana, courage, and safe travel across Aotearoa.',
      dimensions:
        getCell(line, 'dimensions') || matched?.dimensions || '60mm × 25mm × 7mm',
      cordDetails:
        getCell(line, 'cordDetails') || matched?.cordDetails || 'Traditional 4-plait black cord',
      carverName: getCell(line, 'carverName') || matched?.carverName || 'Jesse',
      images: parsedImages,
      featured: parseBoolCell(getCell(line, 'featured'), matched?.featured ?? true),
      published: parseBoolCell(getCell(line, 'published'), matched?.published ?? true),
    };

    const validation = validateWithSchema(productPayloadSchema, candidate);
    if (!validation.success) {
      errorCount++;
      rows.push({
        rowNumber,
        action: matched ? 'update' : 'create',
        matchedProductId: matched?.id,
        rawTitle,
        rawSku: sku,
        error: `Row ${rowNumber}: ${validation.error}`,
      });
      continue;
    }

    const validatedProduct = {
      ...validation.data,
      id,
      sku,
      slug: validation.data.slug || slug || id,
    } as Product;

    if (matched) updateCount++;
    else createCount++;

    validProducts.push(validatedProduct);
    rows.push({
      rowNumber,
      action: matched ? 'update' : 'create',
      matchedProductId: matched?.id,
      product: validatedProduct,
      rawTitle: validatedProduct.title,
      rawSku: validatedProduct.sku,
    });
  }

  return {
    rows,
    validProducts,
    errorCount,
    createCount,
    updateCount,
  };
}
