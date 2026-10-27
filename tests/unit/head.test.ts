import { describe, expect, it } from 'vitest';
import {
  createRouting,
  type RouteDefinition,
  type RoutePage,
  type RoutingConfig,
} from '../../src/index.ts';
import { config, type Locale, Page, SITE } from './fixtures.ts';

const SHEET = { href: '/_astro/landing.AbCd1234.css' };

async function pageFor(
  def: Omit<RouteDefinition<Locale>, 'component' | 'slugs'>,
  path = '/en/page/',
  overrides: Partial<RoutingConfig<Locale>> = {},
): Promise<RoutePage<Locale>> {
  const routing = createRouting(
    config(
      { page: { component: Page, slugs: { es: 'pagina', en: 'page', ca: 'pagina-ca' }, ...def } },
      overrides,
    ),
  );
  const page = (await routing.pages()).find((candidate) => candidate.path === path);
  if (!page) throw new Error(`no page ${path}`);
  return page;
}

describe('resources: page stylesheets travel like feeds and preloads', () => {
  it('passes declared stylesheets through untouched', async () => {
    const page = await pageFor({ resources: { stylesheets: [SHEET] } });

    expect(page.head.stylesheets).toEqual([SHEET]);
  });

  it.each(['/pagina/', '/en/page/', '/ca/pagina-ca/'])(
    '%s receives the same stylesheet in every locale',
    async (path) => {
      const page = await pageFor({ resources: { stylesheets: [SHEET] } }, path);

      expect(page.head.stylesheets).toEqual([SHEET]);
    },
  );

  // Failure case: a page without resources must get empty lists, not undefined. Layouts
  // map over these fields; undefined there fails silently on the pages that need them.
  it('a page without resources gets empty lists, not undefined', async () => {
    const page = await pageFor({});

    expect(page.head.stylesheets).toEqual([]);
    expect(page.head.feeds).toEqual([]);
    expect(page.head.preloads).toEqual([]);
  });

  it('declaring a stylesheet does not touch feeds or preloads, and order is kept', async () => {
    const feeds = [{ type: 'application/rss+xml', href: '/rss.xml', title: 'Feed' }];
    const preloads = [
      {
        href: '/fonts/a.woff2',
        as: 'font' as const,
        type: 'font/woff2',
        crossorigin: 'anonymous' as const,
      },
    ];
    const second = { href: '/_astro/other.ZyXw9876.css' };

    const page = await pageFor({ resources: { feeds, preloads, stylesheets: [SHEET, second] } });

    expect(page.head.feeds).toEqual(feeds);
    expect(page.head.preloads).toEqual(preloads);
    expect(page.head.stylesheets).toEqual([SHEET, second]);
  });
});

describe('title, description, canonical and robots', () => {
  it('picks the page locale, then the default locale, then site defaults', async () => {
    const page = await pageFor(
      { metadata: { title: { es: 'Página', ca: 'Pàgina' } } },
      '/en/page/',
      { seo: { siteName: 'Example', defaultDescription: { es: 'Sitio', en: 'Site' } } },
    );

    expect(page.head.title).toBe('Página');
    expect(page.head.description).toBe('Site');
  });

  it('accepts scalars for every locale', async () => {
    const page = await pageFor({ metadata: { title: 'Same', description: 'Everywhere' } });

    expect(page.head.title).toBe('Same');
    expect(page.head.description).toBe('Everywhere');
  });

  it('falls back to seo.defaultTitle and then to the site name', async () => {
    const withDefault = await pageFor({}, '/en/page/', {
      seo: { siteName: 'Example', defaultTitle: { en: 'Default EN' } },
    });
    const bare = await pageFor({});

    expect(withDefault.head.title).toBe('Default EN');
    expect(bare.head.title).toBe('Example');
    expect(bare.head.description).toBeUndefined();
  });

  it('canonical points to the page itself unless declared, and is absolute', async () => {
    const self = await pageFor({});
    const declared = await pageFor({ metadata: { canonical: { en: '/en/elsewhere/' } } });

    expect(self.head.canonical).toBe(`${SITE}/en/page/`);
    expect(declared.head.canonical).toBe(`${SITE}/en/elsewhere/`);
  });

  it('keeps declared robots and forces noindex when seo.noindex is set', async () => {
    const declared = await pageFor({ metadata: { robots: { index: true, follow: false } } });
    const staging = await pageFor({ metadata: { robots: { follow: true } } }, '/en/page/', {
      seo: { siteName: 'Example', noindex: true },
    });

    expect(declared.head.robots).toEqual({ index: true, follow: false });
    expect(staging.head.robots).toEqual({ index: false, follow: true });
  });
});

describe('Open Graph', () => {
  it('inherits title, description and url, and uses the site name', async () => {
    const page = await pageFor({ metadata: { title: 'T', description: 'D' } });

    expect(page.head.openGraph).toMatchObject({
      type: 'website',
      siteName: 'Example',
      title: 'T',
      description: 'D',
      url: `${SITE}/en/page/`,
    });
  });

  it('derives og:locale and og:locale:alternate from ogLocales and the alternates', async () => {
    const page = await pageFor({}, '/en/page/', {
      ogLocales: { es: 'es_ES', en: 'en_US', ca: 'ca_ES' },
    });

    expect(page.head.openGraph.locale).toBe('en_US');
    expect(page.head.openGraph.localeAlternate).toEqual(['es_ES', 'ca_ES']);
  });

  it('makes image urls absolute and falls back to the default image', async () => {
    const declared = await pageFor({
      metadata: {
        openGraph: {
          type: 'article',
          images: {
            en: [{ url: '/og/en.png', width: 1200, height: 630, alt: 'EN' }],
            es: ['/og/es.png'],
          },
        },
      },
    });
    const fallback = await pageFor({}, '/en/page/', {
      seo: { siteName: 'Example', defaultOgImage: '/og/default.png' },
    });

    expect(declared.head.openGraph.type).toBe('article');
    expect(declared.head.openGraph.images).toEqual([
      { url: `${SITE}/og/en.png`, width: 1200, height: 630, alt: 'EN' },
    ]);
    expect(fallback.head.openGraph.images).toEqual([{ url: `${SITE}/og/default.png` }]);
  });
});

describe('Twitter card', () => {
  it('inherits from Open Graph and site defaults', async () => {
    const page = await pageFor(
      {
        metadata: {
          title: 'T',
          openGraph: { images: [{ url: '/og/card.png', alt: 'Card' }] },
        },
      },
      '/en/page/',
      { seo: { siteName: 'Example', twitter: { site: '@example', creator: '@author' } } },
    );

    expect(page.head.twitter).toEqual({
      card: 'summary_large_image',
      site: '@example',
      creator: '@author',
      title: 'T',
      description: undefined,
      image: `${SITE}/og/card.png`,
      imageAlt: 'Card',
    });
  });

  it('prefers its own fields', async () => {
    const page = await pageFor({
      metadata: {
        twitter: { card: 'summary', title: 'TW', images: ['/tw.png'], imageAlt: 'Alt' },
      },
    });

    expect(page.head.twitter).toMatchObject({
      card: 'summary',
      title: 'TW',
      image: `${SITE}/tw.png`,
      imageAlt: 'Alt',
    });
  });
});

describe('resolveHead for pages outside the tree', () => {
  it('resolves a standalone head, for example for a 404 page', () => {
    const routing = createRouting(config({}));

    const head = routing.resolveHead({
      lang: 'en',
      path: '/404/',
      metadata: { title: 'Not found', robots: { index: false } },
    });

    expect(head.title).toBe('Not found');
    expect(head.robots).toEqual({ index: false });
    expect(head.canonical).toBe(`${SITE}/404/`);
  });
});
