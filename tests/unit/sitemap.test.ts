import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { createRouting, type RouteDefinitions } from '../../src/index.ts';
import { config, type Locale, Page, SITE } from './fixtures.ts';

interface UrlEntry {
  loc: string;
  links: [string, string][];
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

async function sitemapOf(
  routes: RouteDefinitions<Locale>,
  overrides: Parameters<typeof config>[1] = {},
): Promise<{ xml: string; urls: UrlEntry[] }> {
  const xml = await createRouting(config(routes, overrides)).sitemap();
  const root = parse(xml, { lowerCaseTagName: false });
  const urls = root.querySelectorAll('url').map((url) => {
    const entry: UrlEntry = {
      loc: url.querySelector('loc')?.text ?? '',
      links: url
        .querySelectorAll('xhtml\\:link')
        .map((link) => [link.getAttribute('hreflang') ?? '', link.getAttribute('href') ?? '']),
    };
    const lastmod = url.querySelector('lastmod')?.text;
    const changefreq = url.querySelector('changefreq')?.text;
    const priority = url.querySelector('priority')?.text;
    if (lastmod) entry.lastmod = lastmod;
    if (changefreq) entry.changefreq = changefreq;
    if (priority) entry.priority = priority;
    return entry;
  });
  return { xml, urls };
}

const services: RouteDefinitions<Locale> = {
  services: {
    component: Page,
    slugs: { es: 'servicios', en: 'services', ca: 'serveis' },
    sitemap: { changefreq: 'monthly', priority: 0.8, lastmod: '2026-10-01T10:00:00Z' },
  },
};

describe('sitemap', () => {
  it('declares the sitemap and xhtml namespaces', async () => {
    const { xml } = await sitemapOf(services);

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('emits one url per localized page with every alternate and x-default', async () => {
    const { urls } = await sitemapOf(services);
    const links: [string, string][] = [
      ['es', `${SITE}/servicios/`],
      ['en', `${SITE}/en/services/`],
      ['ca', `${SITE}/ca/serveis/`],
      ['x-default', `${SITE}/servicios/`],
    ];

    expect(urls).toEqual([
      {
        loc: `${SITE}/servicios/`,
        links,
        lastmod: '2026-10-01',
        changefreq: 'monthly',
        priority: '0.8',
      },
      {
        loc: `${SITE}/en/services/`,
        links,
        lastmod: '2026-10-01',
        changefreq: 'monthly',
        priority: '0.8',
      },
      {
        loc: `${SITE}/ca/serveis/`,
        links,
        lastmod: '2026-10-01',
        changefreq: 'monthly',
        priority: '0.8',
      },
    ]);
  });

  it('honors custom hreflang codes', async () => {
    const { urls } = await sitemapOf(services, { hreflang: { es: 'es-ES' } });

    expect(urls[0]?.links.map(([hreflang]) => hreflang)).toEqual([
      'es-ES',
      'en',
      'ca',
      'x-default',
    ]);
  });

  it('excludes include: false and noindex pages, unless include is explicitly true', async () => {
    const { urls } = await sitemapOf({
      hidden: { component: Page, slugs: { es: 'oculta' }, sitemap: { include: false } },
      noindex: {
        component: Page,
        slugs: { es: 'privada' },
        metadata: { robots: { index: false } },
      },
      forced: {
        component: Page,
        slugs: { es: 'forzada' },
        metadata: { robots: { index: false } },
        sitemap: { include: true },
      },
      visible: { component: Page, slugs: { es: 'visible' } },
    });

    expect(urls.map((url) => url.loc)).toEqual([`${SITE}/forzada/`, `${SITE}/visible/`]);
  });

  it('is empty of urls when the whole site is noindex', async () => {
    const { urls } = await sitemapOf(services, { seo: { siteName: 'Example', noindex: true } });

    expect(urls).toEqual([]);
  });

  it('accepts Date and thunk lastmod values, and clamps priority', async () => {
    const { urls } = await sitemapOf({
      a: {
        component: Page,
        slugs: { es: 'a' },
        sitemap: { lastmod: new Date('2026-01-02T00:00:00Z'), priority: 3 },
      },
      b: {
        component: Page,
        slugs: { es: 'b' },
        sitemap: { lastmod: () => '2026-03-04', priority: -1 },
      },
      c: { component: Page, slugs: { es: 'c' }, sitemap: { lastmod: () => undefined } },
    });

    expect(urls.map(({ loc, lastmod, priority }) => ({ loc, lastmod, priority }))).toEqual([
      { loc: `${SITE}/a/`, lastmod: '2026-01-02', priority: '1.0' },
      { loc: `${SITE}/b/`, lastmod: '2026-03-04', priority: '0.0' },
      { loc: `${SITE}/c/`, lastmod: undefined, priority: undefined },
    ]);
  });

  it('throws on an invalid lastmod instead of dropping it silently', async () => {
    await expect(
      sitemapOf({ a: { component: Page, slugs: { es: 'a' }, sitemap: { lastmod: 'not a date' } } }),
    ).rejects.toThrow(/route "a".*invalid sitemap lastmod "not a date"/);
  });

  it('escapes XML special characters in URLs', async () => {
    const { xml } = await sitemapOf({ a: { component: Page, slugs: { es: "o'brien" } } });

    expect(xml).toContain('<loc>https://example.com/o&apos;brien/</loc>');
  });
});
