// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'always',
  // Optional: the library does not need Astro i18n, but both work together.
  i18n: {
    locales: ['es', 'en', 'ca'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
});
