import { describe, expect, it, vi } from 'vitest';
import { createRouting, type RouteDefinitions, type RoutePage } from '../../src/index.ts';
import { config, type Locale, Page, SITE } from './fixtures.ts';

const routes: RouteDefinitions<Locale> = {
  home: {
    component: Page,
    slugs: { es: '', en: '', ca: '' },
    breadcrumb: { label: { es: 'Inicio', en: 'Home', ca: 'Inici' } },
    children: {
      services: {
        component: Page,
        slugs: { es: 'servicios', en: 'services', ca: 'serveis' },
        breadcrumb: { label: { es: 'Servicios', en: 'Services', ca: 'Serveis' } },
        children: {
          consulting: {
            component: Page,
            slugs: { es: 'consultoria', en: 'consulting', ca: 'consultoria' },
            breadcrumb: { label: { es: 'Consultoría', en: 'Consulting', ca: 'Consultoria' } },
          },
        },
      },
    },
  },
  notes: {
    component: Page,
    slugs: { es: 'notas' },
  },
};

async function pagesOf(defs: RouteDefinitions<Locale>): Promise<RoutePage<Locale>[]> {
  return createRouting(config(defs)).pages();
}

function find(pages: RoutePage<Locale>[], path: string): RoutePage<Locale> {
  const page = pages.find((candidate) => candidate.path === path);
  if (!page) {
    throw new Error(`No page for ${path}. Got: ${pages.map((p) => p.path).join(', ')}`);
  }
  return page;
}

describe('translated slugs', () => {
  it('generates one page per locale with a slug, default locale without prefix', async () => {
    const pages = await pagesOf(routes);

    expect(pages.map((page) => page.path).sort()).toEqual(
      [
        '/',
        '/en/',
        '/ca/',
        '/servicios/',
        '/en/services/',
        '/ca/serveis/',
        '/servicios/consultoria/',
        '/en/services/consulting/',
        '/ca/serveis/consultoria/',
        '/notas/',
      ].sort(),
    );
  });

  it('exposes lang, absolute url and the route id on every page', async () => {
    const page = find(await pagesOf(routes), '/en/services/consulting/');

    expect(page.lang).toBe('en');
    expect(page.url).toBe(`${SITE}/en/services/consulting/`);
    expect(page.routeId).toBe('home.services.consulting');
  });

  it('honors an explicit route id', async () => {
    const pages = await pagesOf({
      about: { id: 'about-page', component: Page, slugs: { es: 'sobre-mi', en: 'about' } },
    });

    expect(pages.every((page) => page.routeId === 'about-page')).toBe(true);
  });

  it('prefixes the default locale when prefixDefaultLocale is true', async () => {
    const pages = await createRouting(config(routes, { prefixDefaultLocale: true })).pages();

    expect(pages.map((page) => page.path)).toContain('/es/servicios/');
    expect(pages.map((page) => page.path)).toContain('/es/');
  });

  it('uses custom locale prefixes', async () => {
    const pages = await createRouting(config(routes, { prefixes: { ca: 'cat' } })).pages();

    expect(pages.map((page) => page.path)).toContain('/cat/serveis/');
    expect(pages.map((page) => page.path)).not.toContain('/ca/serveis/');
  });

  it('cleans slashes around slugs and keeps inner segments', async () => {
    const pages = await pagesOf({
      docs: { component: Page, slugs: { es: '/docs/guia/', en: 'docs/guide' } },
    });

    expect(pages.map((page) => page.path).sort()).toEqual(['/docs/guia/', '/en/docs/guide/']);
  });
});

describe('getStaticPaths', () => {
  it('returns Astro rest params: undefined for the root, no surrounding slashes otherwise', async () => {
    const entries = await createRouting(config(routes)).getStaticPaths();
    const params = entries.map((entry) => entry.params.path);

    expect(params).toContain(undefined);
    expect(params).toContain('en');
    expect(params).toContain('en/services/consulting');
    expect(params.every((param) => param === undefined || !/^\/|\/$/.test(param))).toBe(true);
  });

  it('passes the page as props', async () => {
    const entries = await createRouting(config(routes)).getStaticPaths();
    const entry = entries.find((candidate) => candidate.params.path === 'ca/serveis');

    expect(entry?.props.path).toBe('/ca/serveis/');
    expect(entry?.props.component).toBe(Page);
  });
});

describe('alternates', () => {
  it('lists every locale of the node with absolute hrefs and x-default to the default locale', async () => {
    const page = find(await pagesOf(routes), '/ca/serveis/');

    expect(page.alternates).toEqual([
      { lang: 'es', hreflang: 'es', href: `${SITE}/servicios/` },
      { lang: 'en', hreflang: 'en', href: `${SITE}/en/services/` },
      { lang: 'ca', hreflang: 'ca', href: `${SITE}/ca/serveis/` },
    ]);
    expect(page.xDefaultHref).toBe(`${SITE}/servicios/`);
  });

  // Regression: the origin engine built hreflangs with a second path routine that
  // returned the site root for any locale whose slug and parent were empty, so
  // /en/ and /ca/ pointed their alternates to /.
  it('derives alternates from the same paths as the pages, also for a localized root', async () => {
    const pages = await pagesOf(routes);
    const home = find(pages, '/en/');

    expect(home.alternates.map((alternate) => alternate.href)).toEqual([
      `${SITE}/`,
      `${SITE}/en/`,
      `${SITE}/ca/`,
    ]);
  });

  it('is reciprocal across every page of the tree', async () => {
    const pages = await pagesOf(routes);
    const byUrl = new Map(pages.map((page) => [page.url, page]));

    for (const page of pages) {
      for (const alternate of page.alternates) {
        const target = byUrl.get(alternate.href);
        expect(target, `${page.path} points to a missing page ${alternate.href}`).toBeDefined();
        expect(target?.alternates.map((a) => a.href)).toContain(page.url);
      }
    }
  });

  it('maps locales to custom hreflang codes', async () => {
    const pages = await createRouting(
      config(routes, { hreflang: { es: 'es-ES', en: 'en-GB' } }),
    ).pages();
    const page = find(pages, '/servicios/');

    expect(page.alternates.map((alternate) => alternate.hreflang)).toEqual([
      'es-ES',
      'en-GB',
      'ca',
    ]);
  });

  it('omits locales without a slug, and x-default when the default locale is missing', async () => {
    const pages = await pagesOf({
      english: { component: Page, slugs: { en: 'only-english', ca: null } },
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.alternates).toEqual([
      { lang: 'en', hreflang: 'en', href: `${SITE}/en/only-english/` },
    ]);
    expect(pages[0]?.xDefaultHref).toBeUndefined();
  });
});

describe('tree semantics', () => {
  it('a node without component emits no page but still nests its children', async () => {
    const pages = await pagesOf({
      blog: {
        slugs: { es: 'blog', en: 'blog' },
        children: { post: { component: Page, slugs: { es: 'hola', en: 'hello' } } },
      },
    });

    expect(pages.map((page) => page.path).sort()).toEqual(['/blog/hola/', '/en/blog/hello/']);
  });

  // The origin engine kept the grandparent prefix and emitted /en/child/ here.
  it('a locale missing on a parent removes the whole subtree in that locale', async () => {
    const pages = await pagesOf({
      parent: {
        component: Page,
        slugs: { es: 'padre' },
        children: { child: { component: Page, slugs: { es: 'hijo', en: 'child' } } },
      },
    });

    expect(pages.map((page) => page.path).sort()).toEqual(['/padre/', '/padre/hijo/']);
  });

  it('awaits async children factories and gives them the parent paths', async () => {
    const factory = vi.fn(async (ctx: { parentPaths: Partial<Record<Locale, string>> }) => {
      expect(ctx.parentPaths).toEqual({ es: 'servicios', en: 'services' });
      return { item: { component: Page, slugs: { es: 'uno', en: 'one' } } };
    });

    const pages = await pagesOf({
      services: { component: Page, slugs: { es: 'servicios', en: 'services' }, children: factory },
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(pages.map((page) => page.path)).toContain('/en/services/one/');
  });

  it('resolves props per locale, with the page context', async () => {
    const pages = await pagesOf({
      about: {
        component: Page,
        slugs: { es: 'sobre-mi', en: 'about' },
        props: async ({ lang, path }) => ({ greeting: lang === 'es' ? 'hola' : 'hello', path }),
      },
      contact: { component: Page, slugs: { es: 'contacto' }, props: { form: true } },
      plain: { component: Page, slugs: { es: 'plano' } },
    });

    expect(find(pages, '/en/about/').props).toEqual({ greeting: 'hello', path: '/en/about/' });
    expect(find(pages, '/sobre-mi/').props).toEqual({ greeting: 'hola', path: '/sobre-mi/' });
    expect(find(pages, '/contacto/').props).toEqual({ form: true });
    expect(find(pages, '/plano/').props).toEqual({});
  });

  it('memoizes the tree walk across pages, getStaticPaths and sitemap', async () => {
    const factory = vi.fn(() => ({ leaf: { component: Page, slugs: { es: 'hoja' } } }));
    const routing = createRouting(config({ root: { slugs: { es: 'raiz' }, children: factory } }));

    await routing.pages();
    await routing.getStaticPaths();
    await routing.sitemap();

    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('layout', () => {
  const Layouts = ['default', 'minimal'] as const;

  it('propagates the declared layout untouched', async () => {
    const routing = createRouting(
      config(
        { landing: { component: Page, layout: 'minimal', slugs: { es: 'aterrizaje' } } },
        { layouts: Layouts },
      ),
    );

    const [page] = await routing.pages();

    expect(page?.layout).toBe('minimal');
  });

  // Failure case: a page that declares nothing must get the default layout, never
  // undefined, so the catch-all page picks a layout from a value and not from an absence.
  it('fills the default layout when the node declares none', async () => {
    const routing = createRouting(
      config({ normal: { component: Page, slugs: { es: 'normal' } } }, { layouts: Layouts }),
    );

    const [page] = await routing.pages();

    expect(page?.layout).toBe('default');
  });

  it('honors defaultLayout and falls back to "default" when no layouts are declared', async () => {
    const custom = createRouting(
      config(
        { normal: { component: Page, slugs: { es: 'normal' } } },
        { layouts: Layouts, defaultLayout: 'minimal' },
      ),
    );
    const implicit = createRouting(
      config({ normal: { component: Page, slugs: { es: 'normal' } } }),
    );

    expect((await custom.pages())[0]?.layout).toBe('minimal');
    expect((await implicit.pages())[0]?.layout).toBe('default');
  });

  it('rejects at compile time a layout outside the declared union', () => {
    const defs: RouteDefinitions<Locale, (typeof Layouts)[number]> = {
      // @ts-expect-error 'commercial' is not one of the declared layouts
      broken: { component: Page, layout: 'commercial', slugs: { es: 'rota' } },
    };

    expect(defs.broken).toBeDefined();
  });

  it('rejects at runtime a layout outside the declared list', async () => {
    const routing = createRouting(
      config(
        // biome-ignore lint/suspicious/noExplicitAny: simulates an untyped caller
        { broken: { component: Page, layout: 'commercial' as any, slugs: { es: 'rota' } } },
        { layouts: Layouts },
      ),
    );

    await expect(routing.pages()).rejects.toThrow(/unknown layout "commercial"/);
  });
});

describe('structured data', () => {
  it('receives lang, path, url and the resolved props, and comes back prepared', async () => {
    const pages = await pagesOf({
      service: {
        component: Page,
        slugs: { es: 'servicio', en: 'service' },
        props: ({ lang }) => ({ name: lang === 'es' ? 'Consultoría' : 'Consulting' }),
        metadata: {
          structuredData: ({ lang, path, url, props }) => ({
            '@type': 'Service',
            name: String(props.name),
            inLanguage: lang,
            url: path,
            identifier: url,
          }),
        },
      },
    });

    expect(find(pages, '/en/service/').jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Consulting',
      inLanguage: 'en',
      url: `${SITE}/en/service/`,
      identifier: `${SITE}/en/service/`,
    });
  });

  it('accepts a static object and leaves jsonLd undefined when absent', async () => {
    const pages = await pagesOf({
      org: {
        component: Page,
        slugs: { es: 'org' },
        metadata: { structuredData: { '@type': 'Organization', logo: '/logo.png' } },
      },
      none: { component: Page, slugs: { es: 'nada' } },
    });

    expect(find(pages, '/org/').jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      logo: `${SITE}/logo.png`,
    });
    expect(find(pages, '/nada/').jsonLd).toBeUndefined();
  });
});

describe('breadcrumbs', () => {
  it('builds the trail from labeled ancestors in the page locale', async () => {
    const page = find(await pagesOf(routes), '/ca/serveis/consultoria/');

    expect(page.breadcrumbs).toEqual([
      { label: 'Inici', href: '/ca/', current: false },
      { label: 'Serveis', href: '/ca/serveis/', current: false },
      { label: 'Consultoria', href: '/ca/serveis/consultoria/', current: true },
    ]);
  });

  it('skips hidden nodes, unlabeled nodes and container nodes without a page', async () => {
    const pages = await pagesOf({
      section: {
        slugs: { es: 'seccion' },
        breadcrumb: { label: 'Sección' },
        children: {
          hidden: {
            component: Page,
            slugs: { es: 'oculta' },
            breadcrumb: { label: 'Oculta', hidden: true },
            children: {
              leaf: { component: Page, slugs: { es: 'hoja' }, breadcrumb: { label: 'Hoja' } },
            },
          },
        },
      },
    });

    expect(find(pages, '/seccion/oculta/hoja/').breadcrumbs).toEqual([
      { label: 'Hoja', href: '/seccion/oculta/hoja/', current: true },
    ]);
  });
});

describe('getPath', () => {
  it('returns the localized path of a route id', async () => {
    const routing = createRouting(config(routes));

    expect(await routing.getPath('home.services', 'ca')).toBe('/ca/serveis/');
    expect(await routing.getPath('home', 'es')).toBe('/');
  });

  it('returns undefined for a locale without page or an unknown id', async () => {
    const routing = createRouting(config(routes));

    expect(await routing.getPath('notes', 'en')).toBeUndefined();
    expect(await routing.getPath('missing', 'es')).toBeUndefined();
  });
});

describe('validation', () => {
  it('throws on duplicate page paths, naming them', async () => {
    const routing = createRouting(
      config({
        a: { component: Page, slugs: { es: 'igual' } },
        b: { component: Page, slugs: { es: 'igual' } },
      }),
    );

    await expect(routing.pages()).rejects.toThrow(/Duplicate page paths[\s\S]*\/igual\/ \(a, b\)/);
  });

  it('throws when a default locale slug collides with a locale prefix', async () => {
    const routing = createRouting(
      config({
        home: { component: Page, slugs: { es: '', en: '' } },
        trap: { component: Page, slugs: { es: 'en' } },
      }),
    );

    await expect(routing.pages()).rejects.toThrow(/Duplicate page paths[\s\S]*\/en\//);
  });

  it('throws on duplicate route ids', async () => {
    const routing = createRouting(
      config({
        a: { id: 'same', component: Page, slugs: { es: 'a' } },
        b: { id: 'same', component: Page, slugs: { es: 'b' } },
      }),
    );

    await expect(routing.pages()).rejects.toThrow(/Duplicate route ids[\s\S]*same/);
  });

  it('throws on a slug keyed by an unknown locale', async () => {
    const routing = createRouting(
      // biome-ignore lint/suspicious/noExplicitAny: simulates a typo in an untyped caller
      config({ typo: { component: Page, slugs: { 'en-US': 'typo' } as any } }),
    );

    await expect(routing.pages()).rejects.toThrow(/route "typo".*unknown locale "en-US"/);
  });

  it.each(['with space', 'query?x', 'hash#x', 'a//b', '../up'])(
    'throws on the invalid slug %j',
    async (slug) => {
      const routing = createRouting(config({ bad: { component: Page, slugs: { es: slug } } }));

      await expect(routing.pages()).rejects.toThrow(/route "bad".*invalid slug/);
    },
  );
});
