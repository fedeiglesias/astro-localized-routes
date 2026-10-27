import type { Localized, LocalizedList } from './types.ts';

function isLocaleMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Value for `lang`, else the default locale, else the first value present. */
export function pick<T extends string, L extends string>(
  value: Localized<T, L> | undefined,
  lang: L,
  defaultLocale: L,
): T | undefined {
  if (value === undefined) return undefined;
  if (!isLocaleMap(value)) return value as T;
  const map = value as Partial<Record<L, T>>;
  return map[lang] ?? map[defaultLocale] ?? Object.values<T | undefined>(map).find(Boolean);
}

/** List for `lang`, else the default locale, else the first list present. */
export function pickList<T, L extends string>(
  value: LocalizedList<T, L> | undefined,
  lang: L,
  defaultLocale: L,
): T[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  const map = value as Partial<Record<L, T[]>>;
  return map[lang] ?? map[defaultLocale] ?? Object.values<T[] | undefined>(map).find(Boolean);
}
