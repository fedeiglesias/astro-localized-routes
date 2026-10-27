import { createRouting } from 'astro-localized-routes';
import { type Layout, LOCALES, type Locale, routes } from './routes.ts';

export const routing = createRouting<Locale, Layout>({
  // `site` from astro.config.mjs. The library never reads import.meta.env itself.
  site: import.meta.env.SITE,
  locales: LOCALES,
  defaultLocale: 'es',
  ogLocales: { es: 'es_ES', en: 'en_US', ca: 'ca_ES' },
  layouts: ['default', 'minimal'],
  seo: {
    siteName: 'Example Studio',
    defaultDescription: {
      es: 'Un sitio de ejemplo con slugs traducidos.',
      en: 'A sample site with translated slugs.',
      ca: "Un lloc d'exemple amb slugs traduïts.",
    },
    defaultOgImage: { url: '/og/default.png', width: 1200, height: 630, alt: 'Example Studio' },
    twitter: { site: '@example' },
    noindex: import.meta.env.PUBLIC_NOINDEX === 'true',
  },
  routes,
});
