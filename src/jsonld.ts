import type { BreadcrumbItem, JsonLd, JsonLdNode } from './types.ts';

const SCHEME_OR_PROTOCOL_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const FILE_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Resolve a root relative or dot relative URL against `siteUrl`. Page paths get a trailing
 * slash, files keep their extension. Absolute, protocol relative, special scheme and
 * fragment only values are returned unchanged.
 */
export function toAbsoluteUrl(href: string, siteUrl: string): string {
  const value = String(href).trim();
  if (!value || SCHEME_OR_PROTOCOL_RELATIVE.test(value)) return value;
  if (!value.startsWith('/') && !value.startsWith('./') && !value.startsWith('../')) return value;
  const url = new URL(value, siteUrl);
  if (!url.pathname.endsWith('/') && !FILE_EXTENSION.test(url.pathname)) url.pathname += '/';
  return url.href;
}

const URL_KEYS = new Set([
  '@id',
  'url',
  'image',
  'logo',
  'thumbnailUrl',
  'contentUrl',
  'embedUrl',
  'sameAs',
  'item',
  'mainEntityOfPage',
]);

function visit(value: unknown, siteUrl: string, urlKey: boolean): unknown {
  if (typeof value === 'string') return urlKey ? toAbsoluteUrl(value, siteUrl) : value;
  if (Array.isArray(value)) return value.map((item) => visit(item, siteUrl, urlKey));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = visit(item, siteUrl, URL_KEYS.has(key));
    }
    return out;
  }
  return value;
}

/** Copy of `data` with `@context` set and URL fields made absolute at any depth. */
export function prepareJsonLd<T extends JsonLd>(data: T, siteUrl: string): T {
  const out = visit(data, siteUrl, false) as T;
  if (out['@context'] !== undefined) return out;
  return { '@context': 'https://schema.org', ...out };
}

/** JSON for a `<script type="application/ld+json">` that cannot close the element early. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** schema.org `BreadcrumbList` for a page trail, or `undefined` when the trail is empty. */
export function breadcrumbJsonLd(page: {
  url: string;
  breadcrumbs: BreadcrumbItem[];
}): JsonLdNode | undefined {
  if (page.breadcrumbs.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: new URL(crumb.href, page.url).href,
    })),
  };
}
