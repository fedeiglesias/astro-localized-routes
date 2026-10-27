import { describe, expect, it, vi } from 'vitest';
import { createRouting, type RouteDefinitions } from '../../src/index.ts';
import { config, type Locale, Page } from './fixtures.ts';

const routes: RouteDefinitions<Locale> = {
  home: {
    component: Page,
    slugs: { es: '', en: '' },
    metadata: {
      openGraph: { images: { es: ['/og/es.png'], en: [{ url: '/og/en.png' }] } },
      twitter: { images: ['https://cdn.example.org/remote.png', 'data:image/png;base64,AAAA'] },
    },
    resources: {
      preloads: [
        { href: '/img/hero.avif', as: 'image' },
        { href: '/fonts/a.woff2', as: 'font' },
      ],
    },
  },
};

describe('asset validation (opt-in through assetExists)', () => {
  it('checks each local image once: OG, Twitter, image preloads and the default OG image', async () => {
    const assetExists = vi.fn((_href: string) => true);
    const routing = createRouting(
      config(routes, {
        assetExists,
        seo: { siteName: 'Example', defaultOgImage: '/og/default.png' },
      }),
    );

    await routing.pages();

    expect(assetExists.mock.calls.map(([href]) => href).sort()).toEqual([
      '/img/hero.avif',
      '/og/default.png',
      '/og/en.png',
      '/og/es.png',
    ]);
  });

  it('throws listing every missing asset with the route that references it', async () => {
    const routing = createRouting(
      config(routes, { assetExists: async (href) => !href.startsWith('/og/') }),
    );

    await expect(routing.pages()).rejects.toThrow(
      /Missing assets:[\s\S]*\/og\/es\.png \(route "home"\)[\s\S]*\/og\/en\.png \(route "home"\)/,
    );
  });

  it('does nothing without assetExists', async () => {
    await expect(createRouting(config(routes)).pages()).resolves.toHaveLength(2);
  });
});
