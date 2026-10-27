import { describe, expect, it } from 'vitest';
import { createRouting } from '../../src/index.ts';
import { config, Page } from './fixtures.ts';

const routes = { home: { component: Page, slugs: { es: '' } } };

describe('config validation (eager, at createRouting)', () => {
  it('normalizes defaults', () => {
    const routing = createRouting(config(routes));

    expect(routing.config).toMatchObject({
      site: 'https://example.com/',
      locales: ['es', 'en', 'ca'],
      defaultLocale: 'es',
      prefixDefaultLocale: false,
      prefixes: { es: '', en: 'en', ca: 'ca' },
      hreflang: { es: 'es', en: 'en', ca: 'ca' },
      layouts: ['default'],
      defaultLayout: 'default',
    });
  });

  it('accepts a URL object as site and drops any path from it', () => {
    const routing = createRouting(config(routes, { site: new URL('https://example.com/sub/') }));

    expect(routing.config.site).toBe('https://example.com/');
  });

  it.each([
    ['example.com', /site must be an absolute http\(s\) URL/],
    ['ftp://example.com', /site must be an absolute http\(s\) URL/],
  ])('rejects the site %j', (site, error) => {
    expect(() => createRouting(config(routes, { site }))).toThrow(error);
  });

  it('rejects an empty or duplicated locale list', () => {
    expect(() => createRouting(config(routes, { locales: [] }))).toThrow(/at least one locale/);
    expect(() => createRouting(config(routes, { locales: ['es', 'es'] }))).toThrow(
      /duplicate locale "es"/,
    );
  });

  it('rejects a default locale outside the list', () => {
    // biome-ignore lint/suspicious/noExplicitAny: simulates an untyped caller
    expect(() => createRouting(config(routes, { defaultLocale: 'fr' as any }))).toThrow(
      /defaultLocale "fr" is not in locales/,
    );
  });

  it('rejects colliding or malformed prefixes', () => {
    expect(() => createRouting(config(routes, { prefixes: { ca: 'en' } }))).toThrow(
      /prefix "en" is used by more than one locale/,
    );
    expect(() => createRouting(config(routes, { prefixes: { ca: 'a/b' } }))).toThrow(
      /invalid prefix "a\/b"/,
    );
  });

  it('rejects a defaultLayout outside the declared layouts', () => {
    expect(() =>
      createRouting(
        // biome-ignore lint/suspicious/noExplicitAny: simulates an untyped caller
        config(routes, { layouts: ['default', 'minimal'], defaultLayout: 'wide' as any }),
      ),
    ).toThrow(/defaultLayout "wide" is not in layouts/);
  });

  it('requires a site name for Open Graph', () => {
    expect(() => createRouting(config(routes, { seo: { siteName: '' } }))).toThrow(
      /seo.siteName is required/,
    );
  });
});
