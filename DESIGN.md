# Design: astro-localized-routes

Status: implemented in 0.1.0. This document records why the library exists, how it was
extracted from an in-house engine, and the decisions behind its public API.

## 1. Problem

Astro 7 i18n routing only handles locale prefixes. The official guide states that "the file
structure and URL structure must match for all languages", so `/es/servicios/` and
`/en/services/` cannot be the same page with a translated slug. The maintained ecosystem does
not cover it for Astro 7 either: `@astrolicious/i18n` stopped at Astro 5, `astro-i18n-aut`
documents that it cannot translate URLs, and `astro-loader-i18n` only translates segments of
content collections.

The engine this library comes from runs in production on a static Astro site. It owns a
declarative route tree with per locale slugs and derives everything else from it: the
`getStaticPaths` entries of one catch-all page, hreflang alternates, sitemap alternates,
per page metadata (title, description, robots, Open Graph, Twitter), `<head>` extras (feeds,
preloads, page stylesheets), JSON-LD, breadcrumb configuration and the layout each page renders
with. The goal is to make that engine a dependency any Astro site can install.

## 2. What the origin engine does (inventory)

| Area           | Origin file                                        | Behavior                                                                                              |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tree walk      | `engine/core.ts`                                   | Recursive walk over `RouteDefinitions`; static or async `children`; one page per locale with a slug.  |
| Paths          | `utils/path.ts`                                    | Parent segments per locale, default locale without prefix, leading and trailing slash.                |
| Hreflang       | `utils/hreflang.ts`                                | Absolute alternates per node from `import.meta.env.SITE`.                                             |
| Metadata       | `utils/metadata.ts`                                | Expands localized values, applies site defaults, noindex from env flags.                              |
| Head           | `utils/head.ts`                                    | Resolves the head for one locale: OG fallbacks, og:url, og:locale and alternates, Twitter card rules. |
| JSON-LD        | `utils/jsonld.ts`                                  | Adds `@context`, makes URL fields absolute.                                                           |
| Validation     | `engine/validators.ts`, `engine/validateAssets.ts` | Duplicate paths, alias collisions, missing images under `public/`.                                    |
| Sitemap        | site code (`src/lib/sitemap/generator.ts`)         | Clusters pages by alternates, emits `xhtml:link` and x-default.                                       |
| Head rendering | site layout                                        | Canonical, alternates, x-default, robots, OG and Twitter tags written by hand.                        |

## 3. Coupling points and how each one is inverted

Every coupling point found while reading the committed source (not the working tree):

| #   | Where                                                                      | Coupling                                                                                                                                                                                            | Inversion                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `engine/index.ts`                                                          | Imports the site route tree (`@config/routes`) for `generateAllStaticPaths()`.                                                                                                                      | Routes are passed to `createRouting({ routes })`.`routing.pages()` replaces `generateAllStaticPaths()` and is memoized, so the catch-all page, the sitemap and any other endpoint share one tree walk. |
| 2   | `utils/metadata.ts`                                                        | Imports the site SEO config (`@config/seo`): default title, default description, brand name, Twitter handles.                                                                                       | `seo` option of the config.                                                                                                                                                                            |
| 3   | `utils/path.ts`, `utils/hreflang.ts`, `utils/head.ts`, `utils/metadata.ts` | Import the site i18n config (`@lib/i18n`): `locales`, `defaultLocale`, `ogLocales`.                                                                                                                 | `locales`, `defaultLocale`, `prefixDefaultLocale`, `prefixes`, `hreflang`, `ogLocales` options.                                                                                                        |
| 4   | `types/i18n.ts`                                                            | `Lang` is the site `Locale` type.                                                                                                                                                                   | Every public type takes a locale type parameter `L extends string`, inferred from `locales` by `createRouting`.                                                                                        |
| 5   | `utils/hreflang.ts`, site SEO config                                       | Reads `import.meta.env.SITE` / `PUBLIC_SITE_URL`. A published dependency is usually externalized during the Astro build and never goes through Vite, so `import.meta.env` would be undefined there. | `site` option (absolute URL). The site reads its own env and passes the value.                                                                                                                         |
| 6   | `utils/metadata.ts`                                                        | Reads `PUBLIC_SEARCH_INDEXING`, `PUBLIC_NOINDEX` and `MODE` from the env.                                                                                                                           | `seo.noindex` boolean.                                                                                                                                                                                 |
| 7   | `engine/validateAssets.ts`                                                 | `node:fs`, `node:path`, `process.cwd()/public`. The Cloudflare adapter prerenders inside workerd, where that code cannot run.                                                                       | Optional `assetExists(href)` callback. The core has no Node imports and runs in any runtime.                                                                                                           |
| 8   | `types/jsonld.ts`, `types/metadata.ts`                                     | Type dependency on `schema-dts`.                                                                                                                                                                    | Own structural `JsonLd` type. Sites can still type their objects with `schema-dts`; the library does not force the package.                                                                            |
| 9   | `types/seo.ts`                                                             | Site specific config shape that imports `SiteDefaults` back from `utils/head`.                                                                                                                      | Removed. Replaced by `SeoConfig` inside `RoutingConfig`.                                                                                                                                               |
| 10  | `types/routes.ts`, `engine/core.ts`                                        | Layout choice is a closed union of the origin site's two layouts.                                                                                                                                   | `layout?: string` with a `Layout` type parameter and a `defaultLayout` option. The engine always resolves it, so a page never receives `undefined`.                                                    |
| 11  | `engine/core.ts`                                                           | Structured data receives `pageProps.item ?? pageProps.post` (a blog convention) and pages without data get `{ isIndex: true }`.                                                                     | Structured data receives the resolved `props` of the page, plus `lang`, `path` and `url`. Default props are `{}`.                                                                                      |
| 12  | site layout                                                                | Locale from `Astro.currentLocale`, path from `Astro.url`, x-default hardcoded to one locale, ~100 lines of head template per layout.                                                                | The engine resolves the head per page and passes `lang`, `path`, `url`, `alternates` and `xDefaultHref`. `renderHead(page)` writes the tags.                                                           |
| 13  | site sitemap generator                                                     | `xmlbuilder2` dependency and the site i18n config.                                                                                                                                                  | Built in `routing.sitemap()`, zero dependencies.                                                                                                                                                       |
| 14  | site endpoints                                                             | `sitemap.xml.ts` and `robots.txt.ts` call `generateAllStaticPaths()`.                                                                                                                               | `routing.sitemap()` and `routing.pages()`.                                                                                                                                                             |

## 4. Defects found in the origin engine

Each one carries its evidence. All are fixed in the library and covered by tests.

1. **Hreflang and page path disagree for a localized root.** Demonstrated: running the origin
   `buildLocalPath` and `generateHreflangs` with `{ es: '', en: '', ca: '' }` (default `es`)
   yields pages `/`, `/en/`, `/ca/` but hreflangs that all point to `/`. Root cause: two separate
   implementations of the same path rule; `hreflang.ts` returns the site root whenever slug and
   parent are empty, without adding the locale prefix. The library derives alternates from the
   same path builder that produces the pages.
2. **Alias collision check skipped async subtrees.** Verified by reading the code:
   `validators.ts` calls an async `children` factory without `await` and walks the returned
   Promise, which has no enumerable keys, so dynamic subtrees were never validated and a
   rejection was unhandled. Aliases were also never turned into redirects. The library drops
   `aliases` in 0.1.0 (see section 7) and validates the tree it already resolved.
3. **Orphan URLs under a partial parent.** Verified by reading the code: when a node has no slug
   for a locale, `nextParentSegments` keeps the grandparent prefix, so its children were still
   generated in that locale, one level up. The library treats the whole subtree as absent in
   that locale.
4. **Noindex pages in the sitemap.** Verified by reading the code: the sitemap only skipped
   `sitemap.include === false`; a `robots.index === false` page needed both flags by hand. The
   library excludes noindex pages unless `sitemap.include` is explicitly `true`.
5. **Stale documentation.** The origin README documents `makeChildrenFromCollection` and slug
   validation helpers that do not exist in the committed source.

## 5. Public API

```ts
import { createRouting, renderHead } from 'astro-localized-routes';

const routing = createRouting({
  site: 'https://example.com',
  locales: ['es', 'en', 'ca'],
  defaultLocale: 'es',
  prefixDefaultLocale: false, // default
  prefixes: { ca: 'ca' }, // optional, defaults to the locale code
  hreflang: { es: 'es', en: 'en', ca: 'ca' }, // optional, defaults to the locale code
  ogLocales: { es: 'es_ES', en: 'en_US', ca: 'ca_ES' }, // optional
  layouts: ['default', 'minimal'], // optional, defaults to ['default']
  defaultLayout: 'default', // optional, defaults to the first layout
  seo: {
    siteName: 'Example',
    defaultTitle: { es: 'Ejemplo', en: 'Example' },
    defaultDescription: 'Example site',
    defaultOgImage: '/og/default.png',
    twitter: { site: '@example', card: 'summary_large_image' },
    noindex: false,
  },
  assetExists: undefined, // optional (href) => boolean | Promise<boolean>
  routes,
});
```

`createRouting(config)` validates the config eagerly and returns:

| Member           | Signature                                               | Purpose                                                 |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `getStaticPaths` | `() => Promise<StaticPath<L, Layout>[]>`                | Export it from `src/pages/[...path].astro`.             |
| `pages`          | `() => Promise<RoutePage<L, Layout>[]>`                 | Every generated page, memoized.                         |
| `sitemap`        | `() => Promise<string>`                                 | Sitemap XML with `xhtml:link` alternates and x-default. |
| `getPath`        | `(id: string, lang: L) => Promise<string \| undefined>` | Localized path of a route, for links and menus.         |
| `resolveHead`    | `(input: StandaloneHeadInput<L>) => ResolvedHead`       | Head with site defaults for pages outside the tree.     |
| `config`         | `ResolvedRoutingConfig<L, Layout>`                      | Normalized config.                                      |

Route definition (one node of the tree):

```ts
interface RouteDefinition<L extends string, Layout extends string> {
  id?: string; // defaults to the dotted key path, e.g. 'services.consulting'
  slugs: Partial<Record<L, string | null>>; // '' adds no segment, missing or null means no page
  component?: unknown; // no component: container node, still contributes its slug
  layout?: Layout;
  props?:
    | Record<string, unknown>
    | ((ctx: {
        lang: L;
        path: string;
        url: string;
      }) => Record<string, unknown> | Promise<Record<string, unknown>>);
  metadata?: RouteMetadata<L>;
  resources?: RouteResources; // feeds, preloads, page stylesheets
  sitemap?: SitemapEntryOptions;
  breadcrumb?: { label?: Localized<string, L>; hidden?: boolean };
  children?:
    | RouteDefinitions<L, Layout>
    | ((ctx: {
        parentPaths: Partial<Record<L, string>>;
      }) => RouteDefinitions<L, Layout> | Promise<RouteDefinitions<L, Layout>>);
}
```

Each `RoutePage` (the props of the catch-all page) carries `component`, `props`, `lang`, `path`,
`url`, `routeId`, `layout`, `alternates` (`{ lang, hreflang, href }[]`, one per locale with a
page, ready for a language switcher), `xDefaultHref` (the default locale version, when it
exists), the resolved `head`, the prepared `jsonLd`, `breadcrumbs` (`{ label, href, current }[]`)
and `sitemap`.

Standalone helpers: `renderHead(page, { jsonLd? })`, `breadcrumbJsonLd(page)`, `prepareJsonLd`,
`serializeJsonLd`, `toAbsoluteUrl`, `escapeHtml`, `robotsContent`.

Smaller API changes against the origin, all deliberate:

- `path: { slugs, aliases }` becomes `slugs`; `aliases` is dropped (section 7).
- `data: { load }` becomes `props`, called per locale with `{ lang, path, url }`, sync or async.
- `metadata.meta.{title, description, canonical, robots}` move up to `metadata.*`; the title is
  optional and falls back to `seo.defaultTitle`, then `seo.siteName`.
- Feeds drop the constant `rel: 'alternate'` and gain an optional `title`.
- Twitter emits a single `twitter:image` for both cards; the indexed `twitter:image0..3` tags
  of the origin layout are not part of the current card markup.
- Image URLs in the resolved head are already absolute, so layouts do not need a helper.

## 6. Library instead of an Astro integration

The site keeps a five line `src/pages/[...path].astro` that exports `getStaticPaths` and picks
its own layout. Alternatives considered:

- **Integration with `injectRoute`.** It would hide the catch-all page, but the injected
  entrypoint must live in the package, so it cannot import the site's layouts without a virtual
  module, and every layout choice becomes configuration. It also ties the library to integration
  hooks and Vite plugin APIs that change between majors.
- **Advanced routing (`src/fetch.ts`, new in Astro 7).** It replaces the request pipeline at
  request time. Its static build story is not documented, and translated slugs must exist as
  prerendered files anyway.

No strong reason for an integration appeared, so the library only exports functions. The cost is
one small file in the site, which is explicit and easy to read.

## 7. Out of scope (origin specific)

- Content series builders, content folder readers and their build date logic.
- Environment switches that remove a whole subtree from the tree (a site can build its
  `routes` object conditionally).
- The navigation engine, menus and language selector components.
- `robots.txt` generation (sites build it from `routing.pages()` and `head.robots`).
- `aliases`: they were validated but never emitted as redirects. A future version can add them
  together with redirect output.
- `metadata.kind` and `metadata.alternates`: declared in the origin types, never read.

## 8. Packaging

- Name `astro-localized-routes`, MIT, ESM only (`type: module`), single entry with an `exports`
  map and bundled declarations.
- Built with tsdown (the tsup README now points to tsdown as its successor).
- Zero runtime dependencies. `astro >=7.4` is a peer dependency; the runtime code does not import
  Astro and runs in Node or workerd.
- `files` ships `dist`, `README.md`, `CHANGELOG.md` and `LICENSE`. `pnpm run check:pack` runs
  publint and asserts the exact tarball contents.
- Node `>=22.23.4`, the same floor as Astro 7.4.2.

## 9. Migration guides (not executed)

### 9.1 The origin site

1. Install `astro-localized-routes` and create `src/routing.ts` with `createRouting(...)`: move
   `locales`, `defaultLocale`, `ogLocales` from the i18n config, `site`, and the SEO defaults
   (brand name, default title, description, OG image, Twitter handles). Pass
   `noindex` from the env flags the metadata module used to read.
2. Route tree, mechanical edits: `path: { slugs }` becomes `slugs`; `data: { load }` becomes
   `props`; `metadata.meta.*` moves up to `metadata.*`; the layout field becomes `layout`, with
   `layouts` listing the two layout names the site uses today; feeds drop `rel`;
   `structuredData` receives `props` instead of `item`. Container nodes keep working unchanged.
   Check every node whose parent lacks a locale: its subtree is no longer generated there.
3. `src/pages/[...path].astro`: export `routing.getStaticPaths` and choose the layout from
   `page.layout`. Pass the page to the layouts instead of `hreflangUrls` and `head`.
4. Layouts: replace the hand written head block with `<Fragment set:html={renderHead(page)} />`
   (or keep the template and read `page.head`, `page.alternates`). Drop `resolveHeadForLang`,
   `Astro.currentLocale` and the hardcoded x-default.
5. `sitemap.xml.ts` returns `routing.sitemap()`; delete the site generator and `xmlbuilder2`.
   `robots.txt.ts` reads `routing.pages()`.
6. Asset validation: pass `assetExists` with an `fs` based check (the site prerenders in Node).
7. Pages that build JSON-LD inline import `prepareJsonLd` from the package; breadcrumb trails can
   come from `page.breadcrumbs` and `breadcrumbJsonLd(page)`.
8. Delete `src/lib/routing/`. Run the existing route tests against the new engine before
   deploying; compare the built sitemap and every page head with the previous build.

### 9.2 A new site

1. `pnpm add astro-localized-routes`, set `site` and `trailingSlash: 'always'` in
   `astro.config.mjs`. Astro's own `i18n` block is optional.
2. Write `src/routes.ts` (the tree) and `src/routing.ts` (`createRouting`).
3. Add `src/pages/[...path].astro`, a layout that calls `renderHead(page)`, and
   `src/pages/sitemap.xml.ts`.
4. See `examples/basic` for a complete site.

## 10. Known limitations

- `trailingSlash: 'always'` URLs only.
- Static output: pages come from `getStaticPaths`; on demand rendering of translated slugs is
  not covered.
- No redirects for renamed slugs yet.
