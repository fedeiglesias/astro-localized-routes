/** Strip leading and trailing slashes. */
export function cleanSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/** Join path parts into `/a/b/`, skipping empty parts. The root is `/`. */
export function joinPath(...parts: string[]): string {
  const inner = parts.map(cleanSegment).filter(Boolean).join('/');
  return inner ? `/${inner}/` : '/';
}

/** Astro rest param for a path: `undefined` for the root, no surrounding slashes otherwise. */
export function toRestParam(path: string): string | undefined {
  return cleanSegment(path) || undefined;
}

const INVALID_SLUG = /[\s?#\\]|\/\/|(^|\/)\.{1,2}(\/|$)/;

/** A slug may hold inner slashes but no whitespace, query, hash, empty or dot segments. */
export function isValidSlug(slug: string): boolean {
  return !INVALID_SLUG.test(cleanSegment(slug));
}
