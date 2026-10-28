// Secrets derived from the server's pepper (AUTH_PIN_PEPPER). Web Crypto only, so this runs in the
// Edge Runtime (Deno) and in Node for tests.

const encoder = new TextEncoder();

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * What the database keeps (as a bcrypt hash) instead of a PIN. Without the pepper, a copy of the
 * database cannot be used to try PINs offline.
 */
export async function pinDigest(pepper: string, pin: string): Promise<string> {
  return toHex(await hmacSha256(pepper, `amh:pin:v1:${pin}`));
}

/** A member's Supabase Auth password: derived, never stored, never typed, never guessable. */
export async function authPassword(pepper: string, userId: string): Promise<string> {
  return toBase64Url(await hmacSha256(pepper, `amh:auth-password:v1:${userId}`));
}

/** Compares two secrets without stopping at the first difference. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}
