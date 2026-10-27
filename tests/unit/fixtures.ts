import type { RouteDefinitions, RoutingConfig } from '../../src/index.ts';

export type Locale = 'es' | 'en' | 'ca';

/** Stand-in for an Astro component: the engine only checks that it exists. */
export const Page = (): null => null;

export const SITE = 'https://example.com';

export function config<const Layout extends string = 'default'>(
  routes: RouteDefinitions<Locale, Layout>,
  overrides: Partial<RoutingConfig<Locale, Layout>> = {},
): RoutingConfig<Locale, Layout> {
  return {
    site: SITE,
    locales: ['es', 'en', 'ca'],
    defaultLocale: 'es',
    seo: { siteName: 'Example' },
    routes,
    ...overrides,
  };
}
