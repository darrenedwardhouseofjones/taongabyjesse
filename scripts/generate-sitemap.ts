import 'dotenv/config';
import {
  startSitemapScheduler,
  writePublicSitemap,
  type SitemapGenerationResult,
} from '../server/sitemap.ts';

interface CliOptions {
  baseUrl?: string;
  outPath?: string;
  watch: boolean;
  intervalMinutes: number;
}

function parseCliArgs(argv: string[]): CliOptions {
  let baseUrl: string | undefined;
  let outPath: string | undefined;
  let watch = false;
  let intervalMinutes = Number(process.env.SITEMAP_INTERVAL_MINUTES) || 15;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--url=')) {
      baseUrl = arg.slice('--url='.length);
    } else if (arg === '--url' && argv[i + 1]) {
      baseUrl = argv[++i];
    } else if (arg.startsWith('--base-url=')) {
      baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--base-url' && argv[i + 1]) {
      baseUrl = argv[++i];
    } else if (arg.startsWith('--out=')) {
      outPath = arg.slice('--out='.length);
    } else if (arg === '--out' && argv[i + 1]) {
      outPath = argv[++i];
    } else if (arg === '--watch' || arg === '-w') {
      watch = true;
    } else if (arg.startsWith('--interval=')) {
      const parsed = Number(arg.slice('--interval='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        intervalMinutes = parsed;
        watch = true;
      }
    } else if (arg === '--interval' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed > 0) {
        intervalMinutes = parsed;
        watch = true;
      }
    }
  }

  return { baseUrl, outPath, watch, intervalMinutes };
}

function printSummary(summary: SitemapGenerationResult) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Sitemap generated successfully:`);
  console.log(`  File:               ${summary.filePath}`);
  console.log(`  Base URL:           ${summary.baseUrl}`);
  console.log(`  Static routes:      ${summary.staticPageCount}`);
  console.log(
    `  Published products: ${summary.publishedProductCount} (${summary.activeProductCount} in stock/MTO, ${summary.retiredArchiveCount} archived)`
  );
  console.log(`  Gallery items:      ${summary.galleryItemCount}`);
  console.log(`  Total URLs:         ${summary.totalUrls}`);
}

try {
  const opts = parseCliArgs(process.argv.slice(2));

  if (opts.watch) {
    console.log(
      `Starting periodic sitemap generator (every ${opts.intervalMinutes} minute${
        opts.intervalMinutes === 1 ? '' : 's'
      })...`
    );
    const scheduler = startSitemapScheduler({
      intervalMinutes: opts.intervalMinutes,
      baseUrl: opts.baseUrl,
      outPath: opts.outPath,
      unrefTimer: false,
      onTick: printSummary,
    });

    const shutdown = () => {
      scheduler.stop();
      console.log('Periodic sitemap generator stopped cleanly.');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    const summary = writePublicSitemap({
      baseUrl: opts.baseUrl,
      outPath: opts.outPath,
    });
    printSummary(summary);
  }
} catch (err) {
  console.error('Failed to generate sitemap.xml:', err);
  process.exit(1);
}
