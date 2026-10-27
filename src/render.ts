import { serializeJsonLd } from './jsonld.ts';
import type { Alternate, JsonLd, ResolvedHead, RobotsDirectives } from './types.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for HTML content and double quoted attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

type Attributes = Record<string, string | number | undefined>;

function tag(name: string, attributes: Attributes): string {
  const attrs = Object.entries(attributes)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeHtml(String(value))}"`)
    .join('');
  return `<${name}${attrs}>`;
}

function meta(
  key: 'name' | 'property',
  id: string,
  content: string | number | undefined,
): string[] {
  return content === undefined || content === '' ? [] : [tag('meta', { [key]: id, content })];
}

/** `index, follow, ...` content of the robots meta tag. */
export function robotsContent(robots: RobotsDirectives): string {
  return [
    robots.index === false ? 'noindex' : 'index',
    robots.follow === false ? 'nofollow' : 'follow',
    robots.noarchive ? 'noarchive' : undefined,
    robots.nosnippet ? 'nosnippet' : undefined,
    typeof robots.maxSnippet === 'number' ? `max-snippet:${robots.maxSnippet}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}

/** What `renderHead` needs. A `RoutePage` satisfies it; standalone pages pass only `head`. */
export interface RenderHeadInput {
  head: ResolvedHead;
  alternates?: Alternate[] | undefined;
  xDefaultHref?: string | undefined;
  jsonLd?: JsonLd | undefined;
}

export interface RenderHeadOptions {
  /** Emit the JSON-LD script. Defaults to `true`. */
  jsonLd?: boolean | undefined;
}

/**
 * HTML for the `<head>` of a page: title, description, canonical, robots, hreflang
 * alternates with x-default, Open Graph, Twitter, feeds, preloads, page stylesheets and
 * JSON-LD. Use it in a layout with `<Fragment set:html={renderHead(page)} />`.
 */
export function renderHead(page: RenderHeadInput, options: RenderHeadOptions = {}): string {
  const { head } = page;
  const lines: string[] = [
    `<title>${escapeHtml(head.title)}</title>`,
    ...meta('name', 'description', head.description),
    tag('link', { rel: 'canonical', href: head.canonical }),
    tag('meta', { name: 'robots', content: robotsContent(head.robots) }),
  ];

  for (const alternate of page.alternates ?? []) {
    lines.push(
      tag('link', { rel: 'alternate', hreflang: alternate.hreflang, href: alternate.href }),
    );
  }
  if (page.alternates?.length && page.xDefaultHref) {
    lines.push(tag('link', { rel: 'alternate', hreflang: 'x-default', href: page.xDefaultHref }));
  }

  const og = head.openGraph;
  lines.push(
    ...meta('property', 'og:type', og.type),
    ...meta('property', 'og:site_name', og.siteName),
    ...meta('property', 'og:title', og.title),
    ...meta('property', 'og:description', og.description),
    ...meta('property', 'og:url', og.url),
    ...meta('property', 'og:locale', og.locale),
    ...og.localeAlternate.flatMap((locale) => meta('property', 'og:locale:alternate', locale)),
  );
  for (const image of og.images) {
    lines.push(
      ...meta('property', 'og:image', image.url),
      ...meta('property', 'og:image:secure_url', image.secureUrl),
      ...meta('property', 'og:image:type', image.type),
      ...meta('property', 'og:image:width', image.width),
      ...meta('property', 'og:image:height', image.height),
      ...meta('property', 'og:image:alt', image.alt),
    );
  }

  const tw = head.twitter;
  lines.push(
    ...meta('name', 'twitter:card', tw.card),
    ...meta('name', 'twitter:site', tw.site),
    ...meta('name', 'twitter:creator', tw.creator),
    ...meta('name', 'twitter:title', tw.title),
    ...meta('name', 'twitter:description', tw.description),
    ...meta('name', 'twitter:image', tw.image),
    ...meta('name', 'twitter:image:alt', tw.imageAlt),
  );

  for (const feed of head.feeds) {
    lines.push(
      tag('link', { rel: 'alternate', type: feed.type, href: feed.href, title: feed.title }),
    );
  }
  for (const preload of head.preloads) {
    lines.push(
      tag('link', {
        rel: 'preload',
        href: preload.href,
        as: preload.as,
        type: preload.type,
        crossorigin: preload.crossorigin,
      }),
    );
  }
  for (const sheet of head.stylesheets) {
    lines.push(tag('link', { rel: 'stylesheet', href: sheet.href }));
  }

  if (page.jsonLd && options.jsonLd !== false) {
    lines.push(`<script type="application/ld+json">${serializeJsonLd(page.jsonLd)}</script>`);
  }
  return lines.join('\n');
}
