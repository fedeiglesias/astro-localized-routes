/** Every error thrown by the library starts with this tag. */
export const TAG = '[astro-localized-routes]';

export function fail(message: string): never {
  throw new Error(`${TAG} ${message}`);
}
