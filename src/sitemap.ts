import { fail } from './errors.ts';
import type { LastmodInput, RoutePage, SitemapEntryOptions } from './types.ts';

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/** `YYYY-MM-DD`. A string keeps the date its author wrote; a Date is read in UTC. */
function formatLastmod(routeId: string, input: SitemapEntryOptions['lastmod']): string | undefined {
  const value: LastmodInput | null | undefined = typeof input === 'function' ? input() : input;
  if (value === undefined || value === null) return undefined;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    fail(`route "${routeId}": invalid sitemap lastmod "${String(value)}".`);
  }
  if (typeof value === 'string') {
    const prefix = DATE_PREFIX.exec(value.trim());
    if (prefix?.[1]) return prefix[1];
  }
  return date.toISOString().slice(0, 10);
}

/** Pages are listed unless excluded explicitly or marked noindex. */
export function isInSitemap(page: RoutePage<string, string>): boolean {
  return page.sitemap?.include ?? page.head.robots.index !== false;
}

/** Sitemap XML for the given pages, with `xhtml:link` alternates and x-default. */
export function buildSitemap(pages: RoutePage<string, string>[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const page of pages) {
    if (!isInSitemap(page)) continue;
    lines.push('  <url>', `    <loc>${escapeXml(page.url)}</loc>`);
    const links = page.alternates.map((alternate) => [alternate.hreflang, alternate.href]);
    if (page.xDefaultHref) links.push(['x-default', page.xDefaultHref]);
    for (const [hreflang = '', href = ''] of links) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
      );
    }
    const lastmod = formatLastmod(page.routeId, page.sitemap?.lastmod);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    if (page.sitemap?.changefreq)
      lines.push(`    <changefreq>${page.sitemap.changefreq}</changefreq>`);
    if (typeof page.sitemap?.priority === 'number') {
      const priority = Math.min(1, Math.max(0, page.sitemap.priority));
      lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}
