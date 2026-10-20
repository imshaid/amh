// Responses for functions the app calls from the browser (another origin than Supabase).

export const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** An error the caller can act on: `error` is a stable code the app translates. */
export function errorResponse(
  status: number,
  error: string,
  details?: Record<string, unknown>,
): Response {
  return jsonResponse(status, { error, ...details });
}

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
