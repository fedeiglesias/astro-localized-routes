# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-27

### Added

- `createRouting(config)`: route tree with translated slugs per locale, default locale without
  prefix (configurable), custom prefixes and hreflang codes.
- `getStaticPaths` for a single `src/pages/[...path].astro`, memoized tree walk shared with
  `pages()`, `sitemap()` and `getPath()`.
- Reciprocal hreflang alternates with x-default, derived from the same paths as the pages.
- Per locale head resolution (title, description, canonical, robots, Open Graph, Twitter,
  feeds, preloads, page stylesheets) and `renderHead()`.
- JSON-LD preparation (`@context`, absolute URLs), safe serialization and `breadcrumbJsonLd()`.
- Breadcrumb trails from the route tree.
- Layout name per route with a typed union and a default.
- Sitemap with `xhtml:link` alternates; noindex pages excluded by default.
- Validation of the config, slugs, duplicate paths, duplicate ids, layouts, and optional local
  asset checks through `assetExists`.

[0.1.0]: https://github.com/fedeiglesias/astro-localized-routes/releases/tag/v0.1.0
