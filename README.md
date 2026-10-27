# astro-localized-routes

Translated slugs for Astro. One route tree drives localized URLs (`/servicios/`,
`/en/services/`, `/ca/serveis/`), reciprocal hreflang alternates with x-default, the sitemap,
head metadata, JSON-LD, breadcrumbs and the layout of each page.

## Why

Astro i18n routing handles locale prefixes, but the file structure and the URL structure must
match for all languages: a page cannot be `/es/servicios/` in one locale and `/en/services/` in
another. This library generates every localized page from a single catch-all route, so slugs can
differ per locale while the site keeps its own layouts and components.

What you get from one route definition:

- `getStaticPaths` entries for `src/pages/[...path].astro`, one per locale that has a slug.
- Alternates per page (`hreflang` plus x-default), reciprocal by construction.
- A sitemap with `xhtml:link` alternates. Noindex pages are left out.
- A resolved head per locale: title, description, canonical, robots, Open Graph, Twitter,
  feeds, preloads and page stylesheets, rendered with one call.
- JSON-LD with `@context` and absolute URLs, and a breadcrumb trail per page.
- A layout name per route, always resolved, so the catch-all page picks the right shell.

No runtime dependencies. The runtime code does not import Astro or Node APIs, so it also works
when the build prerenders in workerd (Cloudflare adapter).

## Requirements

- Astro `>=7.4` with `trailingSlash: 'always'` and static (prerendered) pages.
- Node `>=22.23.4`.

## Install

```sh
pnpm add astro-localized-routes
```

## Quick start

Set `site` and `trailingSlash` in `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'always',
});
```

Describe the routes in `src/routes.ts`. Empty slugs add no segment, so nesting pages under the
home node keeps their URLs and gives them a breadcrumb that starts at home:

```ts
import type { RouteDefinitions } from 'astro-localized-routes';
import ContentPage from './components/ContentPage.astro';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const routes = {
  home: {
    component: ContentPage,
    slugs: { es: '', en: '' },
    breadcrumb: { label: { es: 'Inicio', en: 'Home' } },
    metadata: { title: { es: 'Inicio', en: 'Home' } },
    children: {
      services: {
        component: ContentPage,
        slugs: { es: 'servicios', en: 'services' },
        breadcrumb: { label: { es: 'Servicios', en: 'Services' } },
        props: ({ lang }) => ({ heading: lang === 'es' ? 'Servicios' : 'Services' }),
        metadata: {
          title: { es: 'Servicios', en: 'Services' },
          description: { es: 'Lo que hago.', en: 'What I do.' },
        },
        sitemap: { changefreq: 'monthly', priority: 0.8 },
      },
    },
  },
} satisfies RouteDefinitions<Locale>;
```

Create the engine in `src/routing.ts`:

```ts
import { createRouting } from 'astro-localized-routes';
import { LOCALES, routes } from './routes.ts';

export const routing = createRouting({
  site: import.meta.env.SITE,
  locales: LOCALES,
  defaultLocale: 'es',
  ogLocales: { es: 'es_ES', en: 'en_US' },
  seo: {
    siteName: 'Example',
    defaultOgImage: '/og/default.png',
    noindex: import.meta.env.PUBLIC_NOINDEX === 'true',
  },
  routes,
});
```

Add the catch-all page, `src/pages/[...path].astro`:

```astro
---
import type { RoutePage } from 'astro-localized-routes';
import BaseLayout from '../layouts/BaseLayout.astro';
import type { Locale } from '../routes.ts';
import { routing } from '../routing.ts';

export const getStaticPaths = routing.getStaticPaths;

type Props = RoutePage<Locale>;

const page = Astro.props;
const Page = page.component as (props: Record<string, unknown>) => unknown;
---

<BaseLayout page={page}>
  <Page {...page.props} />
</BaseLayout>
```

Render the head in the layout:

```astro
---
import { type RoutePage, renderHead } from 'astro-localized-routes';
import type { Locale } from '../routes.ts';

interface Props {
  page: RoutePage<Locale>;
}

const { page } = Astro.props;
---

<!doctype html>
<html lang={page.lang}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <Fragment set:html={renderHead(page)} />
  </head>
  <body>
    <slot />
  </body>
</html>
```

And serve the sitemap from `src/pages/sitemap.xml.ts`:

```ts
import type { APIRoute } from 'astro';
import { routing } from '../routing.ts';

export const GET: APIRoute = async () =>
  new Response(await routing.sitemap(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
```

## Route definitions

| Field        | Type                                                                       | Notes                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `slugs`      | `Partial<Record<Locale, string \| null>>`                                  | `''` adds no segment. A missing or `null` locale means no page in that locale, for the node and its whole subtree. Inner slashes are allowed. |
| `component`  | any component                                                              | Optional. Without it the node only groups children and contributes its slug.                                                                  |
| `props`      | object, or `({ lang, path, url }) => object \| Promise<object>`            | Props for the component, per locale.                                                                                                          |
| `layout`     | one of `layouts`                                                           | Defaults to `defaultLayout`.                                                                                                                  |
| `metadata`   | `RouteMetadata`                                                            | `title`, `description`, `canonical`, `robots`, `openGraph`, `twitter`, `structuredData`. Texts accept a scalar or a per locale map.           |
| `resources`  | `RouteResources`                                                           | `feeds`, `preloads`, `stylesheets` (CSS for this page only, imported with `?url`).                                                            |
| `sitemap`    | `SitemapEntryOptions`                                                      | `include`, `changefreq`, `priority`, `lastmod`.                                                                                               |
| `breadcrumb` | `{ label?, hidden? }`                                                      | Only labeled, visible nodes with a page appear in trails.                                                                                     |
| `children`   | definitions, or `({ parentPaths }) => definitions \| Promise<definitions>` | Async factories are awaited once per build.                                                                                                   |
| `id`         | `string`                                                                   | For `getPath`. Defaults to the dotted key path, for example `home.services`.                                                                  |

Localized lookups fall back to the default locale, then to the first value present. Titles fall
back to `seo.defaultTitle` and then to `seo.siteName`.

`structuredData` can be an object or `({ lang, path, url, props }) => JsonLd`. Relative URLs in
`url`, `@id`, `image`, `logo`, `item`, `sameAs` and similar fields become absolute, and
`@context` is added when missing.

## Config

| Option                | Default       | Notes                                                                                                                         |
| --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `site`                | required      | Absolute origin. Pass `import.meta.env.SITE`; the library never reads env variables.                                          |
| `locales`             | required      | Locale codes, also the type of every localized field.                                                                         |
| `defaultLocale`       | required      | Served without prefix unless `prefixDefaultLocale` is `true`.                                                                 |
| `prefixDefaultLocale` | `false`       |                                                                                                                               |
| `prefixes`            | locale code   | URL prefix per locale, for example `{ 'en-us': 'en' }`.                                                                       |
| `hreflang`            | locale code   | hreflang code per locale, for example `{ es: 'es-ES' }`.                                                                      |
| `ogLocales`           | none          | `og:locale` per locale, for example `{ es: 'es_ES' }`.                                                                        |
| `layouts`             | `['default']` | Layout names routes may declare.                                                                                              |
| `defaultLayout`       | first layout  |                                                                                                                               |
| `seo`                 | required      | `siteName`, `defaultTitle`, `defaultDescription`, `defaultOgImage`, `twitter`, `noindex`.                                     |
| `assetExists`         | none          | `(href) => boolean \| Promise<boolean>`. Checks local images referenced by metadata, image preloads and the default OG image. |
| `routes`              | required      | The route tree.                                                                                                               |

The config is validated when `createRouting` runs. The tree is validated on its first walk
(`getStaticPaths`, `pages` or `sitemap`): duplicate paths, duplicate ids, unknown locales in
`slugs`, invalid slugs and unknown layouts fail the build and name the offending route.

## API

`createRouting(config)` returns:

| Member           | Signature                                                                             |
| ---------------- | ------------------------------------------------------------------------------------- |
| `getStaticPaths` | `() => Promise<{ params: { path: string \| undefined }; props: RoutePage }[]>`        |
| `pages`          | `() => Promise<RoutePage[]>` (the tree is walked once and memoized)                   |
| `sitemap`        | `() => Promise<string>`                                                               |
| `getPath`        | `(id: string, lang: Locale) => Promise<string \| undefined>`                          |
| `resolveHead`    | `({ lang, path, metadata?, resources? }) => ResolvedHead`, for pages outside the tree |
| `config`         | the normalized config                                                                 |

Each `RoutePage` has `routeId`, `lang`, `path` (`/en/services/`), `url`, `component`, `props`,
`layout`, `alternates` (`{ lang, hreflang, href }[]`), `xDefaultHref`, `head`, `jsonLd`,
`breadcrumbs` (`{ label, href, current }[]`) and `sitemap`.

Helpers:

- `renderHead(page, { jsonLd? })`: head HTML for a `RoutePage`, or for `{ head }` alone.
- `breadcrumbJsonLd(page)`: a `BreadcrumbList` for the page trail.
- `prepareJsonLd(data, site)`, `serializeJsonLd(data)`, `toAbsoluteUrl(href, site)`.
- `escapeHtml(text)`, `robotsContent(robots)`.

All types are exported: `RouteDefinitions`, `RouteDefinition`, `RoutingConfig`, `RoutePage`,
`ResolvedHead`, `JsonLd`, and the rest.

## Recipes

**Several layouts.** Declare `layouts: ['default', 'minimal']`, set `layout: 'minimal'` on the
routes that need it and choose the shell from `page.layout` in the catch-all page.

**A page in some locales only.** Leave the other locales out of `slugs`. No page and no
alternate is generated for them.

**Routes from a content collection.**

```ts
import { getCollection } from 'astro:content';

children: async () =>
  Object.fromEntries(
    (await getCollection('posts')).map((post) => [
      post.id,
      { component: PostPage, slugs: post.data.slugs, props: { post } },
    ]),
  ),
```

**Language switcher.** Use `page.alternates`, which only lists locales that have the page.

**Links between pages.** `await routing.getPath('home.services', page.lang)`.

**404 and other pages outside the tree.**
`renderHead({ head: routing.resolveHead({ lang: 'es', path: '/404/', metadata }) })`.

**Asset validation in Node builds.**

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

assetExists: (href) => existsSync(join(process.cwd(), 'public', href)),
```

**Astro i18n.** Optional. It can stay configured for `Astro.currentLocale` or
`getRelativeLocaleUrl`; the library does not depend on it.

## Example

`examples/basic` is a complete site with Spanish at the root, English under `/en/` and Catalan
under `/ca/`, translated slugs, a Spanish only page and a second layout. The integration test
builds it with Astro and checks the generated HTML and sitemap.

```sh
pnpm install
pnpm build
pnpm --filter example-basic dev
```

## Limitations

- Only `trailingSlash: 'always'` URLs.
- Static output: on demand rendering of translated slugs is not covered.
- No redirects for renamed slugs yet.

## Development

```sh
pnpm install
pnpm lint          # Biome
pnpm typecheck     # tsc, build, then astro check on the example
pnpm test          # unit tests and the example build
pnpm build         # tsdown
pnpm check:pack    # publint and the exact tarball contents
```

## License

MIT, see [LICENSE](./LICENSE).
