import { toAbsoluteUrl } from './jsonld.ts';
import { pick, pickList } from './localized.ts';
import type {
  Alternate,
  ImageInput,
  Localized,
  OgImage,
  ResolvedHead,
  ResolvedRoutingConfig,
  RobotsDirectives,
  RouteMetadata,
  RouteResources,
} from './types.ts';

export interface HeadContext<L extends string> {
  config: ResolvedRoutingConfig<L, string>;
  lang: L;
  /** Absolute URL of the page. */
  url: string;
  metadata?: RouteMetadata<L> | undefined;
  resources?: RouteResources | undefined;
  alternates: Alternate<L>[];
}

function toImage(input: ImageInput, site: string): OgImage {
  if (typeof input === 'string') return { url: toAbsoluteUrl(input, site) };
  const image: OgImage = { url: toAbsoluteUrl(input.url, site) };
  if (input.secureUrl !== undefined) image.secureUrl = toAbsoluteUrl(input.secureUrl, site);
  if (input.type !== undefined) image.type = input.type;
  if (input.width !== undefined) image.width = input.width;
  if (input.height !== undefined) image.height = input.height;
  if (input.alt !== undefined) image.alt = input.alt;
  return image;
}

/** Resolve every head field of one page in one locale, applying site defaults. */
export function resolveHead<L extends string>(ctx: HeadContext<L>): ResolvedHead {
  const { config, lang, url, metadata = {}, resources = {}, alternates } = ctx;
  const { site, seo, defaultLocale, ogLocales } = config;
  const local = (value: Localized<string, L> | undefined) => pick(value, lang, defaultLocale);

  const title = local(metadata.title) ?? local(seo.defaultTitle) ?? seo.siteName;
  const description = local(metadata.description) ?? local(seo.defaultDescription);
  const declaredCanonical = local(metadata.canonical);
  const canonical = declaredCanonical ? toAbsoluteUrl(declaredCanonical, site) : url;

  const robots: RobotsDirectives = { ...metadata.robots };
  if (seo.noindex && robots.index !== false) robots.index = false;

  const og = metadata.openGraph ?? {};
  const ogTitle = local(og.title) ?? title;
  const ogDescription = local(og.description) ?? description;
  const declaredOgUrl = local(og.url);
  const ogImageInputs =
    pickList(og.images, lang, defaultLocale) ?? (seo.defaultOgImage ? [seo.defaultOgImage] : []);
  const ogImages = ogImageInputs.map((image) => toImage(image, site));
  const localeAlternate =
    pickList(og.localeAlternate, lang, defaultLocale) ??
    alternates
      .filter((alternate) => alternate.lang !== lang)
      .map((alternate) => ogLocales[alternate.lang])
      .filter((locale): locale is string => Boolean(locale));

  const tw = metadata.twitter ?? {};
  const twImages = (pickList(tw.images, lang, defaultLocale) ?? []).map((image) =>
    toImage(image, site),
  );
  const twImage = twImages[0] ?? ogImages[0];

  return {
    title,
    description,
    canonical,
    robots,
    openGraph: {
      type: og.type ?? 'website',
      siteName: og.siteName ?? seo.siteName,
      title: ogTitle,
      description: ogDescription,
      url: declaredOgUrl ? toAbsoluteUrl(declaredOgUrl, site) : canonical,
      locale: local(og.locale) ?? ogLocales[lang],
      localeAlternate,
      images: ogImages,
    },
    twitter: {
      card: tw.card ?? seo.twitter?.card ?? 'summary_large_image',
      site: tw.site ?? seo.twitter?.site,
      creator: tw.creator ?? seo.twitter?.creator,
      title: local(tw.title) ?? ogTitle,
      description: local(tw.description) ?? ogDescription,
      image: twImage?.url,
      imageAlt: tw.imageAlt ?? twImage?.alt,
    },
    feeds: [...(resources.feeds ?? [])],
    preloads: [...(resources.preloads ?? [])],
    stylesheets: [...(resources.stylesheets ?? [])],
  };
}
