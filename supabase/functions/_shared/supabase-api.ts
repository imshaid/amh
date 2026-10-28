// Calls to Supabase Auth and the Data API by plain fetch, so functions need no dependencies.
// Server-side only: most calls carry the project's secret key.

export class SupabaseApiError extends Error {
  readonly status: number;
  /** Postgres SQLSTATE from the Data API (e.g. 23505), or Auth's error code. */
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "SupabaseApiError";
    this.status = status;
    this.code = code;
  }
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export interface SupabaseApiOptions {
  url: string;
  publishableKey: string;
  secretKey: string;
  fetch: typeof fetch;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function errorFrom(response: Response): Promise<SupabaseApiError> {
  let code: string | null = null;
  let message = `HTTP ${String(response.status)}`;
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      // The Data API answers { code: "23505", message }; Auth { error_code, msg } (its `code` is
      // the HTTP status) or, from older versions, { error, error_description }.
      const candidate = [body.error_code, body.code, body.error].find(
        (value) => typeof value === "string",
      );
      code = typeof candidate === "string" ? candidate : null;
      const text = [body.message, body.msg, body.error_description].find(
        (value) => typeof value === "string",
      );
      if (typeof text === "string") message = text;
    }
  } catch {
    // Not JSON: keep the status.
  }
  return new SupabaseApiError(response.status, code, message);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text === "" ? null : (JSON.parse(text) as unknown);
}

export function createSupabaseApi(options: SupabaseApiOptions) {
  const base = options.url.replace(/\/+$/, "");
  const asServer = {
    apikey: options.secretKey,
    Authorization: `Bearer ${options.secretKey}`,
    "Content-Type": "application/json",
  };

  async function call(path: string, init: RequestInit): Promise<Response> {
    return options.fetch(`${base}${path}`, init);
  }

  return {
    /** Calls a Postgres function through the Data API, as the service role. */
    async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
      const response = await call(`/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: asServer,
        body: JSON.stringify(args),
      });
      if (!response.ok) throw await errorFrom(response);
      return readJson(response);
    },

    /** The member's profile (id, phone, active), read as the service role. */
    async selectProfile(
      userId: string,
    ): Promise<{ id: string; phone: string; active: boolean } | null> {
      const query = new URLSearchParams({ id: `eq.${userId}`, select: "id,phone,active" });
      const response = await call(`/rest/v1/profiles?${query.toString()}`, {
        method: "GET",
        headers: asServer,
      });
      if (!response.ok) throw await errorFrom(response);
      const rows = await readJson(response);
      if (!Array.isArray(rows)) return null;
      const [row] = rows as unknown[];
      if (
        !isRecord(row) ||
        typeof row.id !== "string" ||
        typeof row.phone !== "string" ||
        typeof row.active !== "boolean"
      ) {
        return null;
      }
      return { id: row.id, phone: row.phone, active: row.active };
    },

    /** A session for these credentials, or null when Auth rejects them. */
    async signInWithPassword(email: string, password: string): Promise<Session | null> {
      const response = await call("/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: options.publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.status === 400) {
        const error = await errorFrom(response);
        if (error.code === "invalid_credentials" || error.code === "invalid_grant") return null;
        throw error;
      }
      if (!response.ok) throw await errorFrom(response);
      const body = await readJson(response);
      if (
        !isRecord(body) ||
        typeof body.access_token !== "string" ||
        typeof body.refresh_token !== "string"
      ) {
        throw new SupabaseApiError(response.status, null, "Auth returned no session");
      }
      return {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_in: typeof body.expires_in === "number" ? body.expires_in : 3600,
        ...(typeof body.expires_at === "number" ? { expires_at: body.expires_at } : {}),
        token_type: typeof body.token_type === "string" ? body.token_type : "bearer",
      };
    },

    /** Whose access token this is, or null if Auth does not accept it. */
    async getUserId(accessToken: string): Promise<string | null> {
      const response = await call("/auth/v1/user", {
        method: "GET",
        headers: { apikey: options.publishableKey, Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw await errorFrom(response);
      const body = await readJson(response);
      return isRecord(body) && typeof body.id === "string" ? body.id : null;
    },

    async createUser(user: { id: string; email: string; password: string }): Promise<void> {
      const response = await call("/auth/v1/admin/users", {
        method: "POST",
        headers: asServer,
        body: JSON.stringify({ ...user, email_confirm: true }),
      });
      if (!response.ok) throw await errorFrom(response);
    },

    async updateUser(userId: string, attributes: Record<string, unknown>): Promise<void> {
      const response = await call(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: asServer,
        body: JSON.stringify(attributes),
      });
      if (!response.ok) throw await errorFrom(response);
    },

    async deleteUser(userId: string): Promise<void> {
      const response = await call(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: asServer,
      });
      if (!response.ok) throw await errorFrom(response);
    },
  };
}

export type SupabaseApi = ReturnType<typeof createSupabaseApi>;
