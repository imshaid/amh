/**
 * Builds the Cloudflare Pages `_headers` file. The Content-Security-Policy lets the app talk only
 * to itself and to the configured Supabase project (HTTP and Realtime WebSocket).
 */

function supabaseOrigins(supabaseUrl: string | undefined): { http: string; ws: string } | null {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    const ws = new URL(supabaseUrl);
    ws.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return { http: url.origin, ws: ws.origin };
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(supabaseUrl?: string): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'"],
    // Inline styles: UI libraries (e.g. scroll locking in dialogs) inject <style> elements.
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", ...(supabase ? [supabase.http] : [])],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...(supabase ? [supabase.http, supabase.ws] : [])],
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  return directives.map((parts) => parts.join(" ")).join("; ");
}

export function buildHeadersFile(supabaseUrl?: string): string {
  return [
    "/*",
    `  Content-Security-Policy: ${buildContentSecurityPolicy(supabaseUrl)}`,
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    // A private business app: keep every deployment, previews included, out of search engines.
    "  X-Robots-Tag: noindex, nofollow",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    // Must always be re-fetched, or clients would keep an old app version or an old theme script.
    "/sw.js",
    "  Cache-Control: no-cache",
    "",
    "/theme-boot.js",
    "  Cache-Control: no-cache",
    "",
  ].join("\n");
}
