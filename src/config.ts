import { fail } from './errors.ts';
import type { ResolvedRoutingConfig, RoutingConfig } from './types.ts';

const PREFIX = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;

function resolveSite(site: string | URL): string {
  let url: URL;
  try {
    url = new URL(String(site));
  } catch {
    return fail(`site must be an absolute http(s) URL, got "${String(site)}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`site must be an absolute http(s) URL, got "${String(site)}".`);
  }
  return `${url.origin}/`;
}

/** Validate the config eagerly and fill every default. */
export function resolveConfig<L extends string, Layout extends string>(
  config: RoutingConfig<L, Layout>,
): ResolvedRoutingConfig<L, Layout> {
  const site = resolveSite(config.site);
  const locales = [...config.locales];
  if (locales.length === 0) fail('config needs at least one locale.');
  const seen = new Set<string>();
  for (const locale of locales) {
    if (seen.has(locale)) fail(`duplicate locale "${locale}" in locales.`);
    seen.add(locale);
  }
  if (!seen.has(config.defaultLocale)) {
    fail(`defaultLocale "${config.defaultLocale}" is not in locales (${locales.join(', ')}).`);
  }

  const prefixDefaultLocale = config.prefixDefaultLocale ?? false;
  const prefixes = {} as Record<L, string>;
  const hreflang = {} as Record<L, string>;
  const usedPrefixes = new Set<string>();
  for (const locale of locales) {
    const unprefixed = locale === config.defaultLocale && !prefixDefaultLocale;
    const prefix = unprefixed ? '' : (config.prefixes?.[locale] ?? locale);
    if (!unprefixed) {
      if (!PREFIX.test(prefix)) fail(`invalid prefix "${prefix}" for locale "${locale}".`);
      if (usedPrefixes.has(prefix)) fail(`prefix "${prefix}" is used by more than one locale.`);
      usedPrefixes.add(prefix);
    }
    prefixes[locale] = prefix;
    hreflang[locale] = config.hreflang?.[locale] ?? locale;
  }

  const layouts = config.layouts?.length ? [...config.layouts] : (['default'] as Layout[]);
  const defaultLayout = config.defaultLayout ?? (layouts[0] as Layout);
  if (!layouts.includes(defaultLayout)) {
    fail(`defaultLayout "${defaultLayout}" is not in layouts (${layouts.join(', ')}).`);
  }

  if (!config.seo?.siteName) fail('seo.siteName is required (used for og:site_name).');

  return {
    site,
    locales,
    defaultLocale: config.defaultLocale,
    prefixDefaultLocale,
    prefixes,
    hreflang,
    ogLocales: { ...config.ogLocales },
    layouts,
    defaultLayout,
    seo: config.seo,
  };
}
