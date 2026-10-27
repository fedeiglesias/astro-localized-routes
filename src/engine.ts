import { resolveConfig } from './config.ts';
import { fail } from './errors.ts';
import { resolveHead } from './head.ts';
import { prepareJsonLd } from './jsonld.ts';
import { pick } from './localized.ts';
import { cleanSegment, isValidSlug, joinPath, toRestParam } from './paths.ts';
import { buildSitemap } from './sitemap.ts';
import type {
  Alternate,
  BreadcrumbItem,
  ImageInput,
  LocalizedList,
  PageProps,
  ResolvedRoutingConfig,
  RouteDefinition,
  RouteDefinitions,
  RoutePage,
  Routing,
  RoutingConfig,
} from './types.ts';

/** A node already placed in the tree, as seen by its descendants. */
interface PlacedNode<L extends string, Layout extends string> {
  id: string;
  def: RouteDefinition<L, Layout>;
  /** Page path per locale, only for locales where the node renders a page. */
  pagePaths: Partial<Record<L, string>>;
}

interface AssetRef {
  href: string;
  owner: string;
}

function hasComponent(def: { component?: unknown }): boolean {
  return def.component !== undefined && def.component !== null;
}

function imageHrefs<L extends string>(images: LocalizedList<ImageInput, L> | undefined): string[] {
  if (!images) return [];
  const lists: ImageInput[][] = Array.isArray(images)
    ? [images]
    : Object.values<ImageInput[] | undefined>(images).filter((list) => list !== undefined);
  return lists.flat().map((image) => (typeof image === 'string' ? image : image.url));
}

function isLocalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

function listDuplicates(entries: [string, string][]): string[] {
  const owners = new Map<string, string[]>();
  for (const [value, owner] of entries) owners.set(value, [...(owners.get(value) ?? []), owner]);
  return [...owners]
    .filter(([, list]) => list.length > 1)
    .map(([value, list]) => `- ${value} (${list.join(', ')})`);
}

function breadcrumbsFor<L extends string, Layout extends string>(
  chain: PlacedNode<L, Layout>[],
  lang: L,
  defaultLocale: L,
): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [];
  chain.forEach((node, index) => {
    const href = node.pagePaths[lang];
    const options = node.def.breadcrumb;
    const label = pick(options?.label, lang, defaultLocale);
    if (!href || !label || options?.hidden) return;
    trail.push({ label, href, current: index === chain.length - 1 });
  });
  return trail;
}

class TreeBuilder<L extends string, Layout extends string> {
  readonly pages: RoutePage<L, Layout>[] = [];
  readonly ids: [string, string][] = [];
  readonly assets: AssetRef[] = [];

  constructor(private readonly config: ResolvedRoutingConfig<L, Layout>) {}

  private absolute(path: string): string {
    return new URL(path, this.config.site).href;
  }

  async walk(
    defs: RouteDefinitions<L, Layout>,
    parentPaths: Partial<Record<L, string>>,
    parentId: string,
    ancestors: PlacedNode<L, Layout>[],
  ): Promise<void> {
    const { locales, prefixes } = this.config;
    for (const [key, def] of Object.entries(defs)) {
      const id = def.id ?? (parentId ? `${parentId}.${key}` : key);
      this.ids.push([id, key]);

      for (const locale of Object.keys(def.slugs)) {
        if (!locales.includes(locale as L)) {
          fail(
            `route "${id}": unknown locale "${locale}" in slugs (locales: ${locales.join(', ')}).`,
          );
        }
      }

      const localPaths: Partial<Record<L, string>> = {};
      const pagePaths: Partial<Record<L, string>> = {};
      for (const lang of locales) {
        const parent = parentPaths[lang];
        const slug = def.slugs[lang];
        if (parent === undefined || slug === undefined || slug === null) continue;
        if (!isValidSlug(slug)) fail(`route "${id}": invalid slug "${slug}" for locale "${lang}".`);
        const localPath = [parent, cleanSegment(slug)].filter(Boolean).join('/');
        localPaths[lang] = localPath;
        pagePaths[lang] = joinPath(prefixes[lang], localPath);
      }

      const node: PlacedNode<L, Layout> = {
        id,
        def,
        pagePaths: hasComponent(def) ? pagePaths : {},
      };
      const chain = [...ancestors, node];
      if (hasComponent(def)) await this.emitPages(node, chain);

      const children =
        typeof def.children === 'function'
          ? await def.children({ parentPaths: { ...localPaths } })
          : def.children;
      if (children) await this.walk(children, localPaths, id, chain);
    }
  }

  private async emitPages(
    node: PlacedNode<L, Layout>,
    chain: PlacedNode<L, Layout>[],
  ): Promise<void> {
    const { config } = this;
    const { def, id, pagePaths } = node;
    const layout = def.layout ?? config.defaultLayout;
    if (!config.layouts.includes(layout)) {
      fail(`route "${id}": unknown layout "${layout}" (layouts: ${config.layouts.join(', ')}).`);
    }

    const alternates: Alternate<L>[] = [];
    for (const lang of config.locales) {
      const path = pagePaths[lang];
      if (path)
        alternates.push({ lang, hreflang: config.hreflang[lang], href: this.absolute(path) });
    }
    const defaultPath = pagePaths[config.defaultLocale];
    const xDefaultHref = defaultPath ? this.absolute(defaultPath) : undefined;

    for (const alternate of alternates) {
      const { lang } = alternate;
      const path = pagePaths[lang] as string;
      const url = alternate.href;
      const props: PageProps =
        typeof def.props === 'function' ? await def.props({ lang, path, url }) : { ...def.props };
      const data = def.metadata?.structuredData;
      const rawJsonLd = typeof data === 'function' ? data({ lang, path, url, props }) : data;

      this.pages.push({
        routeId: id,
        lang,
        path,
        url,
        component: def.component,
        props,
        layout,
        alternates,
        xDefaultHref,
        head: resolveHead({
          config,
          lang,
          url,
          metadata: def.metadata,
          resources: def.resources,
          alternates,
        }),
        jsonLd: rawJsonLd ? prepareJsonLd(rawJsonLd, config.site) : undefined,
        breadcrumbs: breadcrumbsFor(chain, lang, config.defaultLocale),
        sitemap: def.sitemap,
      });
    }

    const hrefs = [
      ...imageHrefs(def.metadata?.openGraph?.images),
      ...imageHrefs(def.metadata?.twitter?.images),
      ...(def.resources?.preloads ?? []).filter((p) => p.as === 'image').map((p) => p.href),
    ];
    for (const href of hrefs) this.assets.push({ href, owner: `route "${id}"` });
  }
}

async function checkAssets(
  refs: AssetRef[],
  assetExists: (href: string) => boolean | Promise<boolean>,
): Promise<void> {
  const local = refs.filter((ref) => isLocalHref(ref.href));
  const results = new Map<string, Promise<boolean>>();
  for (const { href } of local) {
    if (!results.has(href)) results.set(href, Promise.resolve(assetExists(href)));
  }
  const missing: string[] = [];
  for (const ref of local) {
    if (!(await results.get(ref.href))) missing.push(`- ${ref.href} (${ref.owner})`);
  }
  if (missing.length > 0) {
    fail(
      `Missing assets:\n${[...new Set(missing)].join('\n')}\nPlace them under public/ or fix the references.`,
    );
  }
}

async function buildPages<L extends string, Layout extends string>(
  config: ResolvedRoutingConfig<L, Layout>,
  routes: RouteDefinitions<L, Layout>,
  assetExists: RoutingConfig<L, Layout>['assetExists'],
): Promise<RoutePage<L, Layout>[]> {
  const builder = new TreeBuilder(config);
  const roots = Object.fromEntries(config.locales.map((lang) => [lang, ''])) as Record<L, string>;
  await builder.walk(routes, roots, '', []);

  const duplicatePaths = listDuplicates(builder.pages.map((page) => [page.path, page.routeId]));
  if (duplicatePaths.length > 0) fail(`Duplicate page paths:\n${duplicatePaths.join('\n')}`);
  const duplicateIds = listDuplicates(builder.ids);
  if (duplicateIds.length > 0) fail(`Duplicate route ids:\n${duplicateIds.join('\n')}`);

  if (assetExists) {
    const refs = [...builder.assets];
    const fallback = config.seo.defaultOgImage;
    if (fallback) refs.push({ href: imageHrefs([fallback])[0] ?? '', owner: 'seo.defaultOgImage' });
    await checkAssets(refs, assetExists);
  }
  return builder.pages;
}

/**
 * Create the routing engine of a site. The config is validated immediately; the route
 * tree is walked once, on the first call that needs pages, and memoized.
 */
export function createRouting<const L extends string, const Layout extends string = 'default'>(
  config: RoutingConfig<L, Layout>,
): Routing<L, Layout> {
  const resolved = resolveConfig(config);
  let cache: Promise<RoutePage<L, Layout>[]> | undefined;

  const pages = (): Promise<RoutePage<L, Layout>[]> => {
    cache ??= buildPages(resolved, config.routes, config.assetExists).catch((error: unknown) => {
      cache = undefined;
      throw error;
    });
    return cache;
  };

  return {
    config: resolved,
    pages,
    getStaticPaths: async () =>
      (await pages()).map((page) => ({ params: { path: toRestParam(page.path) }, props: page })),
    sitemap: async () => buildSitemap(await pages()),
    getPath: async (id, lang) =>
      (await pages()).find((page) => page.routeId === id && page.lang === lang)?.path,
    resolveHead: ({ lang, path, metadata, resources }) => {
      if (!resolved.locales.includes(lang)) fail(`resolveHead: unknown locale "${lang}".`);
      return resolveHead({
        config: resolved,
        lang,
        url: new URL(joinPath(path), resolved.site).href,
        metadata,
        resources,
        alternates: [],
      });
    },
  };
}
