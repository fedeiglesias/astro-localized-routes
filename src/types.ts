/**
 * A value for every locale, or a partial map of values per locale. Lookups fall back to
 * the default locale and then to the first value present.
 */
export type Localized<T, L extends string = string> = T | Partial<Record<L, T>>;

/** A list for every locale, or a partial map of lists per locale. */
export type LocalizedList<T, L extends string = string> = T[] | Partial<Record<L, T[]>>;

/** Rich Open Graph image. */
export interface OgImage {
  url: string;
  secureUrl?: string | undefined;
  type?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  alt?: string | undefined;
}

/** A plain image URL or a rich image object. */
export type ImageInput = string | OgImage;

/** `<meta name="robots">` directives. Missing `index` or `follow` means allowed. */
export interface RobotsDirectives {
  index?: boolean | undefined;
  follow?: boolean | undefined;
  noarchive?: boolean | undefined;
  nosnippet?: boolean | undefined;
  maxSnippet?: number | undefined;
}

export type OpenGraphType =
  | 'website'
  | 'article'
  | 'profile'
  | 'book'
  | `video.${string}`
  | `music.${string}`;

export type TwitterCard = 'summary' | 'summary_large_image';

/** Plain JSON-LD node. Type it with `schema-dts` on the site side if you want stricter checks. */
export interface JsonLdNode {
  '@context'?: string | Record<string, unknown> | undefined;
  '@type'?: string | string[] | undefined;
  '@id'?: string | undefined;
  [key: string]: unknown;
}

/** JSON-LD document with several entities. */
export interface JsonLdGraph {
  '@context'?: string | Record<string, unknown> | undefined;
  '@graph': JsonLdNode[];
}

export type JsonLd = JsonLdNode | JsonLdGraph;

/** Context passed to `metadata.structuredData` when it is a function. */
export interface StructuredDataContext<L extends string = string> {
  lang: L;
  /** Localized path, with leading and trailing slash. */
  path: string;
  /** Absolute URL of the page. */
  url: string;
  /** Resolved props of the page. */
  props: Record<string, unknown>;
}

/** SEO and social metadata of a route. Every text can be localized. */
export interface RouteMetadata<L extends string = string> {
  title?: Localized<string, L> | undefined;
  description?: Localized<string, L> | undefined;
  /** Canonical URL. Defaults to the page itself. Relative values are made absolute. */
  canonical?: Localized<string, L> | undefined;
  robots?: RobotsDirectives | undefined;
  openGraph?:
    | {
        type?: OpenGraphType | undefined;
        siteName?: string | undefined;
        title?: Localized<string, L> | undefined;
        description?: Localized<string, L> | undefined;
        images?: LocalizedList<ImageInput, L> | undefined;
        url?: Localized<string, L> | undefined;
        locale?: Localized<string, L> | undefined;
        localeAlternate?: LocalizedList<string, L> | undefined;
      }
    | undefined;
  twitter?:
    | {
        card?: TwitterCard | undefined;
        site?: string | undefined;
        creator?: string | undefined;
        title?: Localized<string, L> | undefined;
        description?: Localized<string, L> | undefined;
        images?: LocalizedList<ImageInput, L> | undefined;
        imageAlt?: string | undefined;
      }
    | undefined;
  structuredData?: JsonLd | ((ctx: StructuredDataContext<L>) => JsonLd | undefined) | undefined;
}

/** `<link rel="alternate">` feed (RSS, Atom, JSON Feed). */
export interface Feed {
  type: string;
  href: string;
  title?: string | undefined;
}

/** `<link rel="preload">` hint. */
export interface Preload {
  href: string;
  as: 'font' | 'style' | 'image' | 'script' | 'fetch';
  type?: string | undefined;
  crossorigin?: 'anonymous' | 'use-credentials' | undefined;
}

/**
 * `<link rel="stylesheet">` for CSS that only this page needs. Import the file with `?url`
 * in the route definition so it stays out of the shared stylesheet of the catch-all page.
 */
export interface Stylesheet {
  href: string;
}

/** Technical `<head>` resources of a route, kept apart from SEO metadata. */
export interface RouteResources {
  feeds?: Feed[] | undefined;
  preloads?: Preload[] | undefined;
  stylesheets?: Stylesheet[] | undefined;
}

export type Changefreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export type LastmodInput = string | Date;

/** Sitemap options of a route. */
export interface SitemapEntryOptions {
  /**
   * Force inclusion or exclusion. By default a page is included unless its robots
   * directives say `index: false`.
   */
  include?: boolean | undefined;
  changefreq?: Changefreq | undefined;
  /** 0.0 to 1.0, clamped. */
  priority?: number | undefined;
  lastmod?: LastmodInput | (() => LastmodInput | null | undefined) | undefined;
}

/** Breadcrumb options of a route. Only labeled, visible nodes with a page appear in trails. */
export interface BreadcrumbOptions<L extends string = string> {
  label?: Localized<string, L> | undefined;
  hidden?: boolean | undefined;
}

/** Context passed to `props` when it is a function. */
export interface PropsContext<L extends string = string> {
  lang: L;
  path: string;
  url: string;
}

/** Context passed to a `children` factory. */
export interface ChildrenContext<L extends string = string> {
  /** Accumulated parent segments per locale, without locale prefix. Absent locales are omitted. */
  parentPaths: Partial<Record<L, string>>;
}

export type PageProps = Record<string, unknown>;

/** One node of the route tree. */
export interface RouteDefinition<L extends string = string, Layout extends string = 'default'> {
  /** Stable id for `getPath`. Defaults to the dotted key path, for example `services.consulting`. */
  id?: string | undefined;
  /**
   * Slug per locale. `''` adds no segment (a root or a transparent parent). A missing or
   * `null` locale means no page in that locale, for this node and its whole subtree.
   */
  slugs: Partial<Record<L, string | null>>;
  /** Page component. Without it the node only groups children and contributes its slug. */
  component?: unknown;
  /** Layout name, resolved to `defaultLayout` when omitted. */
  layout?: Layout | undefined;
  /** Props for the page component, static or computed per locale. */
  props?: PageProps | ((ctx: PropsContext<L>) => PageProps | Promise<PageProps>) | undefined;
  metadata?: RouteMetadata<L> | undefined;
  resources?: RouteResources | undefined;
  sitemap?: SitemapEntryOptions | undefined;
  breadcrumb?: BreadcrumbOptions<L> | undefined;
  children?:
    | RouteDefinitions<L, Layout>
    | ((
        ctx: ChildrenContext<L>,
      ) => RouteDefinitions<L, Layout> | Promise<RouteDefinitions<L, Layout>>)
    | undefined;
}

export type RouteDefinitions<L extends string = string, Layout extends string = 'default'> = Record<
  string,
  RouteDefinition<L, Layout>
>;

/** Site wide SEO defaults. */
export interface SeoConfig<L extends string = string> {
  /** Used for `og:site_name` and as the last title fallback. */
  siteName: string;
  defaultTitle?: Localized<string, L> | undefined;
  defaultDescription?: Localized<string, L> | undefined;
  defaultOgImage?: ImageInput | undefined;
  twitter?:
    | {
        site?: string | undefined;
        creator?: string | undefined;
        card?: TwitterCard | undefined;
      }
    | undefined;
  /** Force `noindex` on every page (staging, previews). Read your env and pass the result. */
  noindex?: boolean | undefined;
}

export interface RoutingConfig<L extends string = string, Layout extends string = 'default'> {
  /** Absolute site origin, for example `https://example.com`. Any path is ignored. */
  site: string | URL;
  locales: readonly L[];
  defaultLocale: NoInfer<L>;
  /** Prefix the default locale too. Defaults to `false`. */
  prefixDefaultLocale?: boolean | undefined;
  /** URL prefix per locale. Defaults to the locale code. */
  prefixes?: Partial<Record<NoInfer<L>, string>> | undefined;
  /** hreflang code per locale, for example `es-ES`. Defaults to the locale code. */
  hreflang?: Partial<Record<NoInfer<L>, string>> | undefined;
  /** Open Graph locale per locale, for example `es_ES`. */
  ogLocales?: Partial<Record<NoInfer<L>, string>> | undefined;
  /** Layout names routes may declare. Defaults to `['default']`. */
  layouts?: readonly Layout[] | undefined;
  /** Layout for routes that declare none. Defaults to the first layout. */
  defaultLayout?: NoInfer<Layout> | undefined;
  seo: SeoConfig<NoInfer<L>>;
  /**
   * Opt-in check for local images referenced by metadata, the default OG image and image
   * preloads. Receives root relative hrefs such as `/og/home.png`. Keep the core runtime
   * agnostic: pass a Node `fs` check only when the build runs in Node.
   */
  assetExists?: ((href: string) => boolean | Promise<boolean>) | undefined;
  routes: RouteDefinitions<NoInfer<L>, NoInfer<Layout>>;
}

/** Normalized config exposed as `routing.config`. */
export interface ResolvedRoutingConfig<
  L extends string = string,
  Layout extends string = 'default',
> {
  /** Origin with a trailing slash, for example `https://example.com/`. */
  site: string;
  locales: readonly L[];
  defaultLocale: L;
  prefixDefaultLocale: boolean;
  prefixes: Record<L, string>;
  hreflang: Record<L, string>;
  ogLocales: Partial<Record<L, string>>;
  layouts: readonly Layout[];
  defaultLayout: Layout;
  seo: SeoConfig<L>;
}

/** hreflang alternate of a page. */
export interface Alternate<L extends string = string> {
  lang: L;
  hreflang: string;
  href: string;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
  current: boolean;
}

/** Head fields resolved for one page and locale. URLs are absolute. */
export interface ResolvedHead {
  title: string;
  description: string | undefined;
  canonical: string;
  robots: RobotsDirectives;
  openGraph: {
    type: OpenGraphType;
    siteName: string;
    title: string;
    description: string | undefined;
    url: string;
    locale: string | undefined;
    localeAlternate: string[];
    images: OgImage[];
  };
  twitter: {
    card: TwitterCard;
    site: string | undefined;
    creator: string | undefined;
    title: string;
    description: string | undefined;
    image: string | undefined;
    imageAlt: string | undefined;
  };
  feeds: Feed[];
  preloads: Preload[];
  stylesheets: Stylesheet[];
}

/** One generated page. This object is the props of the catch-all page. */
export interface RoutePage<L extends string = string, Layout extends string = 'default'> {
  routeId: string;
  lang: L;
  /** Localized path with leading and trailing slash, for example `/en/services/`. */
  path: string;
  /** Absolute URL. */
  url: string;
  component: unknown;
  props: PageProps;
  layout: Layout;
  /** One entry per locale that has this page, in `locales` order. */
  alternates: Alternate<L>[];
  /** URL of the default locale version, when it exists. */
  xDefaultHref: string | undefined;
  head: ResolvedHead;
  /** Structured data with `@context` and absolute URLs. */
  jsonLd: JsonLd | undefined;
  breadcrumbs: BreadcrumbItem[];
  sitemap: SitemapEntryOptions | undefined;
}

/** Entry returned by `getStaticPaths`. */
export interface StaticPath<L extends string = string, Layout extends string = 'default'> {
  params: { path: string | undefined };
  props: RoutePage<L, Layout>;
}

/** Input of `routing.resolveHead` for pages that live outside the tree, such as a 404. */
export interface StandaloneHeadInput<L extends string = string> {
  lang: L;
  path: string;
  metadata?: RouteMetadata<L> | undefined;
  resources?: RouteResources | undefined;
}

export interface Routing<L extends string = string, Layout extends string = 'default'> {
  config: ResolvedRoutingConfig<L, Layout>;
  /** Export from `src/pages/[...path].astro`. */
  getStaticPaths: () => Promise<StaticPath<L, Layout>[]>;
  /** Every generated page. The tree is walked once and memoized. */
  pages: () => Promise<RoutePage<L, Layout>[]>;
  /** Sitemap XML with hreflang alternates and x-default. */
  sitemap: () => Promise<string>;
  /** Localized path of a route id, or `undefined` when that locale has no page. */
  getPath: (id: string, lang: L) => Promise<string | undefined>;
  /** Resolve a head with the site defaults for a page outside the tree. */
  resolveHead: (input: StandaloneHeadInput<L>) => ResolvedHead;
}
