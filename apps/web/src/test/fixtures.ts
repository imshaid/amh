/**
 * The bytes of a file imported with Vite's `?inline` suffix (a base64 data URL), for binary
 * fixtures such as the sample spreadsheets in docs/reference.
 */
export function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
