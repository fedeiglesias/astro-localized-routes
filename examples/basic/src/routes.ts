import type { RouteDefinitions } from 'astro-localized-routes';
import ContentPage from './components/ContentPage.astro';
import ServicePage from './components/ServicePage.astro';

export const LOCALES = ['es', 'en', 'ca'] as const;
export type Locale = (typeof LOCALES)[number];
export type Layout = 'default' | 'minimal';

const BRAND = 'Example Studio';

const consulting = {
  es: { name: 'Consultoría', description: 'Sesiones individuales para ordenar tu proyecto.' },
  en: { name: 'Consulting', description: 'One to one sessions to put your project in order.' },
  ca: { name: 'Consultoria', description: 'Sessions individuals per ordenar el teu projecte.' },
} satisfies Record<Locale, { name: string; description: string }>;

/**
 * The route tree. Empty slugs add no segment, so nesting everything under `home` gives
 * every page a breadcrumb that starts at the home page without changing any URL.
 */
export const routes = {
  home: {
    component: ContentPage,
    slugs: { es: '', en: '', ca: '' },
    breadcrumb: { label: { es: 'Inicio', en: 'Home', ca: 'Inici' } },
    props: ({ lang }) => ({
      heading: { es: 'Bienvenido', en: 'Welcome', ca: 'Benvingut' }[lang],
    }),
    sitemap: { changefreq: 'weekly', priority: 1 },
    metadata: {
      title: {
        es: `${BRAND}, estudio de ejemplo`,
        en: `${BRAND}, a sample studio`,
        ca: `${BRAND}, estudi d'exemple`,
      },
      structuredData: ({ lang, path }) => ({
        '@graph': [
          { '@type': 'WebSite', '@id': '/#website', name: BRAND, url: path, inLanguage: lang },
          {
            '@type': 'Organization',
            '@id': '/#organization',
            name: BRAND,
            logo: '/og/default.png',
          },
        ],
      }),
    },
    children: {
      services: {
        component: ContentPage,
        slugs: { es: 'servicios', en: 'services', ca: 'serveis' },
        breadcrumb: { label: { es: 'Servicios', en: 'Services', ca: 'Serveis' } },
        props: ({ lang }) => ({
          heading: { es: 'Servicios', en: 'Services', ca: 'Serveis' }[lang],
        }),
        sitemap: { changefreq: 'monthly', priority: 0.8, lastmod: '2026-10-01' },
        metadata: {
          title: {
            es: `Servicios | ${BRAND}`,
            en: `Services | ${BRAND}`,
            ca: `Serveis | ${BRAND}`,
          },
          description: {
            es: 'Lo que hacemos.',
            en: 'What we do.',
            ca: 'El que fem.',
          },
        },
        children: {
          consulting: {
            component: ServicePage,
            slugs: { es: 'consultoria', en: 'consulting', ca: 'consultoria' },
            breadcrumb: { label: { es: 'Consultoría', en: 'Consulting', ca: 'Consultoria' } },
            props: ({ lang }) => consulting[lang],
            metadata: {
              title: {
                es: `${consulting.es.name} | ${BRAND}`,
                en: `${consulting.en.name} | ${BRAND}`,
                ca: `${consulting.ca.name} | ${BRAND}`,
              },
              openGraph: { type: 'article' },
              structuredData: ({ path, props }) => ({
                '@type': 'Service',
                name: String(props.name),
                description: String(props.description),
                url: path,
                provider: { '@id': '/#organization' },
              }),
            },
          },
        },
      },
      about: {
        component: ContentPage,
        slugs: { es: 'sobre-nosotros', en: 'about-us', ca: 'sobre-nosaltres' },
        breadcrumb: { label: { es: 'Sobre nosotros', en: 'About us', ca: 'Sobre nosaltres' } },
        props: ({ lang }) => ({
          heading: { es: 'Sobre nosotros', en: 'About us', ca: 'Sobre nosaltres' }[lang],
        }),
      },
      // Only in Spanish: no English or Catalan page, and no alternates pointing to one.
      news: {
        component: ContentPage,
        slugs: { es: 'novedades' },
        breadcrumb: { label: 'Novedades' },
        props: { heading: 'Novedades' },
        metadata: { title: `Novedades | ${BRAND}` },
      },
      // Shown after a form is sent: a stripped layout, out of the index and the sitemap.
      thanks: {
        component: ContentPage,
        layout: 'minimal',
        slugs: { es: 'gracias', en: 'thank-you', ca: 'gracies' },
        props: ({ lang }) => ({
          heading: { es: 'Gracias', en: 'Thank you', ca: 'Gràcies' }[lang],
        }),
        metadata: {
          title: { es: 'Gracias', en: 'Thank you', ca: 'Gràcies' },
          robots: { index: false, follow: true },
        },
      },
    },
  },
} satisfies RouteDefinitions<Locale, Layout>;
