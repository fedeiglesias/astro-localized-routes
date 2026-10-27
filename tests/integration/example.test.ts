/**
 * Builds the library and examples/basic with Astro 7 through their real pnpm scripts, then
 * asserts the content of the generated HTML and sitemap.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type HTMLElement, parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'examples/basic/dist');
const SITE = 'https://example.com';

const EXPECTED_PAGES: Record<string, string> = {
  '/': 'es',
  '/en/': 'en',
  '/ca/': 'ca',
  '/servicios/': 'es',
  '/en/services/': 'en',
  '/ca/serveis/': 'ca',
  '/servicios/consultoria/': 'es',
  '/en/services/consulting/': 'en',
  '/ca/serveis/consultoria/': 'ca',
  '/sobre-nosotros/': 'es',
  '/en/about-us/': 'en',
  '/ca/sobre-nosaltres/': 'ca',
  '/novedades/': 'es',
  '/gracias/': 'es',
  '/en/thank-you/': 'en',
  '/ca/gracies/': 'ca',
};

const NOINDEX = ['/gracias/', '/en/thank-you/', '/ca/gracies/'];

function run(args: string[]): void {
  try {
    execFileSync('pnpm', args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    throw new Error(`pnpm ${args.join(' ')} failed:\n${stdout}\n${stderr}`);
  }
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('index.html'))
    .map((file) => `/${file.split(sep).slice(0, -1).join('/')}/`.replace(/^\/+/, '/'));
}

const documents = new Map<string, HTMLElement>();

function doc(path: string): HTMLElement {
  const root = documents.get(path);
  if (!root) throw new Error(`No built page for ${path}`);
  return root;
}

function alternatesOf(path: string): Map<string, string> {
  const links = doc(path).querySelectorAll('head link[rel="alternate"][hreflang]');
  return new Map(
    links.map((link) => [link.getAttribute('hreflang') ?? '', link.getAttribute('href') ?? '']),
  );
}

function jsonLdOf(path: string): Record<string, unknown>[] {
  return doc(path)
    .querySelectorAll('script[type="application/ld+json"]')
    .map((script) => JSON.parse(script.rawText) as Record<string, unknown>);
}

beforeAll(() => {
  run(['run', 'build']);
  run(['--filter', 'example-basic', '--fail-if-no-match', 'run', 'build']);
  for (const path of htmlFiles(DIST)) {
    const file = join(DIST, path, 'index.html');
    documents.set(path, parse(readFileSync(file, 'utf8')));
  }
});

describe('generated pages', () => {
  it('builds exactly the translated URLs, and none for locales without a slug', () => {
    expect([...documents.keys()].sort()).toEqual(Object.keys(EXPECTED_PAGES).sort());
    expect(existsSync(join(DIST, 'en/novedades'))).toBe(false);
  });

  it.each(Object.entries(EXPECTED_PAGES))('%s declares html lang %s', (path, lang) => {
    expect(doc(path).querySelector('html')?.getAttribute('lang')).toBe(lang);
  });

  it('renders translated content and props per locale', () => {
    expect(doc('/servicios/').querySelector('h1')?.text).toBe('Servicios');
    expect(doc('/en/services/').querySelector('h1')?.text).toBe('Services');
    expect(doc('/ca/serveis/').querySelector('h1')?.text).toBe('Serveis');
    expect(doc('/en/services/consulting/').querySelector('title')?.text).toBe(
      'Consulting | Example Studio',
    );
  });

  it('picks the layout declared by the route, the default one otherwise', () => {
    for (const path of Object.keys(EXPECTED_PAGES)) {
      const expected = NOINDEX.includes(path) ? 'minimal' : 'default';
      expect(doc(path).querySelector('body')?.getAttribute('data-layout'), path).toBe(expected);
    }
  });

  it('marks the minimal layout pages noindex and the rest indexable', () => {
    for (const path of Object.keys(EXPECTED_PAGES)) {
      const robots = doc(path).querySelector('meta[name="robots"]')?.getAttribute('content');
      expect(robots, path).toBe(NOINDEX.includes(path) ? 'noindex, follow' : 'index, follow');
    }
  });
});

describe('canonical and hreflang', () => {
  it.each(Object.keys(EXPECTED_PAGES))('%s has a self referencing canonical', (path) => {
    const canonical = doc(path).querySelectorAll('link[rel="canonical"]');

    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.getAttribute('href')).toBe(`${SITE}${path}`);
  });

  it('lists every translation plus x-default pointing to the Spanish page', () => {
    expect(Object.fromEntries(alternatesOf('/ca/serveis/consultoria/'))).toEqual({
      es: `${SITE}/servicios/consultoria/`,
      en: `${SITE}/en/services/consulting/`,
      ca: `${SITE}/ca/serveis/consultoria/`,
      'x-default': `${SITE}/servicios/consultoria/`,
    });
    expect(Object.fromEntries(alternatesOf('/en/'))).toEqual({
      es: `${SITE}/`,
      en: `${SITE}/en/`,
      ca: `${SITE}/ca/`,
      'x-default': `${SITE}/`,
    });
  });

  it('only lists existing translations for a single locale page', () => {
    expect(Object.fromEntries(alternatesOf('/novedades/'))).toEqual({
      es: `${SITE}/novedades/`,
      'x-default': `${SITE}/novedades/`,
    });
  });

  it('is reciprocal: every alternate is a built page that links back with the same code', () => {
    for (const path of documents.keys()) {
      const own = alternatesOf(path);
      const ownLang = EXPECTED_PAGES[path] ?? '';
      expect(own.get(ownLang), `${path} must list itself`).toBe(`${SITE}${path}`);
      expect(own.has('x-default'), `${path} must have x-default`).toBe(true);

      for (const [hreflang, href] of own) {
        if (hreflang === 'x-default') continue;
        const target = new URL(href).pathname;
        expect(documents.has(target), `${path} -> ${href} is not a built page`).toBe(true);
        expect(alternatesOf(target).get(ownLang), `${target} does not link back to ${path}`).toBe(
          `${SITE}${path}`,
        );
        expect(alternatesOf(target).get('x-default'), `${target} x-default`).toBe(
          own.get('x-default'),
        );
      }
    }
  });

  it('derives og:locale alternates from the same translations', () => {
    const og = (property: string) =>
      doc('/en/services/')
        .querySelectorAll(`meta[property="${property}"]`)
        .map((meta) => meta.getAttribute('content'));

    expect(og('og:url')).toEqual([`${SITE}/en/services/`]);
    expect(og('og:locale')).toEqual(['en_US']);
    expect(og('og:locale:alternate')).toEqual(['es_ES', 'ca_ES']);
    expect(og('og:image')).toEqual([`${SITE}/og/default.png`]);
  });
});

describe('navigation helpers', () => {
  it('renders the breadcrumb trail in the page locale', () => {
    const crumbs = doc('/ca/serveis/consultoria/')
      .querySelectorAll('nav[aria-label="Breadcrumb"] li')
      .map((item) => [item.text.trim(), item.querySelector('a')?.getAttribute('href') ?? null]);

    expect(crumbs).toEqual([
      ['Inici', '/ca/'],
      ['Serveis', '/ca/serveis/'],
      ['Consultoria', null],
    ]);
  });

  it('links to the other translations from the language switcher', () => {
    const links = doc('/en/services/')
      .querySelectorAll('nav[aria-label="Language"] a')
      .map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(links).toEqual([
      ['es', '/servicios/'],
      ['ca', '/ca/serveis/'],
    ]);
  });

  it('builds menu links with getPath', () => {
    const links = doc('/ca/')
      .querySelectorAll('header nav[aria-label="Main"] a')
      .map((link) => link.getAttribute('href'));

    expect(links).toEqual(['/ca/', '/ca/serveis/', '/ca/sobre-nosaltres/']);
  });
});

describe('JSON-LD', () => {
  it('home: parses into a graph with absolute URLs', () => {
    const [data] = jsonLdOf('/en/');

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/en/`, inLanguage: 'en' },
        { '@type': 'Organization', '@id': `${SITE}/#organization`, logo: `${SITE}/og/default.png` },
      ],
    });
  });

  it('service page: the Service entity comes from the route props', () => {
    const service = jsonLdOf('/ca/serveis/consultoria/').find(
      (data) => data['@type'] === 'Service',
    );

    expect(service).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Consultoria',
      description: 'Sessions individuals per ordenar el teu projecte.',
      url: `${SITE}/ca/serveis/consultoria/`,
      provider: { '@id': `${SITE}/#organization` },
    });
  });

  it('service page: the BreadcrumbList matches the visible trail', () => {
    const list = jsonLdOf('/en/services/consulting/').find(
      (data) => data['@type'] === 'BreadcrumbList',
    );

    expect(list?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE}/en/services/` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Consulting',
        item: `${SITE}/en/services/consulting/`,
      },
    ]);
  });
});

describe('sitemap.xml', () => {
  const sitemap = () => parse(readFileSync(join(DIST, 'sitemap.xml'), 'utf8'));
  const entries = () =>
    sitemap()
      .querySelectorAll('url')
      .map((url) => ({
        loc: url.querySelector('loc')?.text ?? '',
        links: Object.fromEntries(
          url
            .querySelectorAll('xhtml\\:link')
            .map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
        ),
        lastmod: url.querySelector('lastmod')?.text,
      }));

  it('lists every indexable translated URL and leaves out noindex pages', () => {
    const expected = Object.keys(EXPECTED_PAGES)
      .filter((path) => !NOINDEX.includes(path))
      .map((path) => `${SITE}${path}`);

    expect(
      entries()
        .map((entry) => entry.loc)
        .sort(),
    ).toEqual(expected.sort());
  });

  it('carries the alternates and x-default of each URL, matching the HTML', () => {
    for (const entry of entries()) {
      const path = new URL(entry.loc).pathname;
      expect(entry.links, entry.loc).toEqual(Object.fromEntries(alternatesOf(path)));
    }
    const services = entries().find((entry) => entry.loc === `${SITE}/ca/serveis/`);
    expect(services?.links).toEqual({
      es: `${SITE}/servicios/`,
      en: `${SITE}/en/services/`,
      ca: `${SITE}/ca/serveis/`,
      'x-default': `${SITE}/servicios/`,
    });
    expect(services?.lastmod).toBe('2026-10-01');
  });

  it('is a static XML file in dist', () => {
    expect(readFileSync(join(DIST, 'sitemap.xml'), 'utf8')).toMatch(/^<\?xml version="1.0"/);
  });
});
