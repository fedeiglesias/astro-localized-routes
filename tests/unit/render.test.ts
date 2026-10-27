import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { createRouting, escapeHtml, renderHead, serializeJsonLd } from '../../src/index.ts';
import { config, Page, SITE } from './fixtures.ts';

async function services() {
  const routing = createRouting(
    config(
      {
        services: {
          component: Page,
          slugs: { es: 'servicios', en: 'services', ca: 'serveis' },
          metadata: {
            title: { es: 'Servicios', en: 'Services & "more"', ca: 'Serveis' },
            description: 'Desc <b>',
            openGraph: { images: [{ url: '/og.png', width: 1200, height: 630, alt: 'OG' }] },
            structuredData: { '@type': 'WebPage', name: '</script><script>alert(1)</script>' },
          },
          resources: {
            feeds: [{ type: 'application/rss+xml', href: '/rss.xml', title: 'Feed' }],
            preloads: [
              { href: '/f.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
            ],
            stylesheets: [{ href: '/page.css' }],
          },
        },
      },
      {
        ogLocales: { es: 'es_ES', en: 'en_US', ca: 'ca_ES' },
        seo: { siteName: 'Example', twitter: { site: '@ex' } },
      },
    ),
  );
  const pages = await routing.pages();
  const page = pages.find((candidate) => candidate.path === '/en/services/');
  if (!page) throw new Error('missing page');
  return page;
}

describe('renderHead', () => {
  it('writes title, description, canonical and robots', async () => {
    const root = parse(renderHead(await services()));

    expect(root.querySelector('title')?.text).toBe('Services & "more"');
    expect(root.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Desc <b>',
    );
    expect(root.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE}/en/services/`,
    );
    expect(root.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
  });

  it('writes one alternate per locale plus x-default', async () => {
    const root = parse(renderHead(await services()));
    const alternates = root
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]);

    expect(alternates).toEqual([
      ['es', `${SITE}/servicios/`],
      ['en', `${SITE}/en/services/`],
      ['ca', `${SITE}/ca/serveis/`],
      ['x-default', `${SITE}/servicios/`],
    ]);
  });

  it('writes Open Graph and Twitter tags', async () => {
    const root = parse(renderHead(await services()));
    const og = (property: string) =>
      root.querySelectorAll(`meta[property="${property}"]`).map((m) => m.getAttribute('content'));

    expect(og('og:title')).toEqual(['Services & "more"']);
    expect(og('og:url')).toEqual([`${SITE}/en/services/`]);
    expect(og('og:locale')).toEqual(['en_US']);
    expect(og('og:locale:alternate')).toEqual(['es_ES', 'ca_ES']);
    expect(og('og:image')).toEqual([`${SITE}/og.png`]);
    expect(og('og:image:width')).toEqual(['1200']);
    expect(og('og:image:alt')).toEqual(['OG']);
    expect(root.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
    expect(root.querySelector('meta[name="twitter:site"]')?.getAttribute('content')).toBe('@ex');
    expect(root.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      `${SITE}/og.png`,
    );
  });

  it('writes feeds, preloads and stylesheets', async () => {
    const root = parse(renderHead(await services()));

    expect(
      root.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href'),
    ).toBe('/rss.xml');
    expect(root.querySelector('link[rel="preload"]')?.getAttribute('as')).toBe('font');
    expect(root.querySelector('link[rel="preload"]')?.getAttribute('crossorigin')).toBe(
      'anonymous',
    );
    expect(root.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBe('/page.css');
  });

  it('escapes attribute values and text', async () => {
    const html = renderHead(await services());

    expect(html).toContain('<title>Services &amp; &quot;more&quot;</title>');
    expect(html).toContain('content="Desc &lt;b&gt;"');
  });

  it('embeds JSON-LD that parses and cannot close the script element', async () => {
    const html = renderHead(await services());
    const scripts = parse(html).querySelectorAll('script[type="application/ld+json"]');

    expect(scripts).toHaveLength(1);
    expect(html).not.toContain('</script><script>');
    expect(JSON.parse(scripts[0]?.rawText ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '</script><script>alert(1)</script>',
    });
  });

  it('can skip JSON-LD, and renders a standalone head without alternates', async () => {
    const page = await services();
    const routing = createRouting(config({}));
    const standalone = renderHead({
      head: routing.resolveHead({ lang: 'es', path: '/404/', metadata: { title: 'No' } }),
    });

    expect(renderHead(page, { jsonLd: false })).not.toContain('application/ld+json');
    expect(standalone).toContain('<title>No</title>');
    expect(standalone).not.toContain('hreflang');
  });
});

describe('escaping helpers', () => {
  it('escapeHtml covers the five sensitive characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('serializeJsonLd escapes <, > and & so the output is safe inside a script', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: '</script>&' });

    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out)).toEqual({ '@type': 'Thing', name: '</script>&' });
  });
});
