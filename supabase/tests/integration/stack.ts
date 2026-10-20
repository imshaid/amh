// The running local Supabase stack, and small clients for its APIs.
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface Stack {
  url: string;
  publishableKey: string;
  secretKey: string;
}

export function localStack(): Stack {
  let output: string;
  try {
    output = execFileSync(
      join(root, "node_modules", ".bin", "supabase"),
      ["status", "-o", "json"],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    throw new Error("The local Supabase stack is not running. Start it with `npm run db:start`.");
  }
  const status = JSON.parse(output.slice(output.indexOf("{"))) as Record<
    string,
    string | undefined
  >;
  if (!status.API_URL || !status.PUBLISHABLE_KEY || !status.SECRET_KEY) {
    throw new Error("`supabase status` did not report the API URL and keys.");
  }
  return {
    url: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
  };
}

/** Request options whose extra headers are a plain record, so they can be merged. */
type Init = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

async function reply(response: Response): Promise<Reply> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text === "" ? {} : JSON.parse(text);
  } catch {
    body = { text };
  }
  return {
    status: response.status,
    body:
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : { rows: body },
  };
}

/** A fresh, unused-looking mobile number for one test. */
export function uniquePhone(): string {
  return `0139${String(randomInt(1_000_000, 9_999_999))}`;
}

export function clients(stack: Stack) {
  const asOperator = { apikey: stack.secretKey, Authorization: `Bearer ${stack.secretKey}` };
  const anonymous = {
    apikey: stack.publishableKey,
    Authorization: `Bearer ${stack.publishableKey}`,
  };
  const created: string[] = [];

  return {
    /** Calls member-auth as the browser would: with the publishable key, or a member's token. */
    async memberAuth(body: Record<string, unknown>, accessToken?: string): Promise<Reply> {
      const response = await fetch(`${stack.url}/functions/v1/member-auth`, {
        method: "POST",
        headers: {
          ...anonymous,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return reply(response);
    },

    /** Calls member-auth as the operator (`npm run members`). */
    async operator(body: Record<string, unknown>): Promise<Reply> {
      const response = await fetch(`${stack.url}/functions/v1/member-auth`, {
        method: "POST",
        headers: { ...asOperator, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await reply(response);
      const member = result.body.member as { id?: unknown } | undefined;
      if (body.action === "add-member" && typeof member?.id === "string") created.push(member.id);
      return result;
    },

    /** The Data API, signed in or not. */
    async rest(path: string, accessToken?: string, init: Init = {}): Promise<Reply> {
      const response = await fetch(`${stack.url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: stack.publishableKey,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      return reply(response);
    },

    async auth(path: string, init: Init): Promise<Reply> {
      const response = await fetch(`${stack.url}/auth/v1/${path}`, {
        ...init,
        headers: {
          apikey: stack.publishableKey,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      return reply(response);
    },

    async upload(
      bucket: string,
      path: string,
      accessToken: string | undefined,
      contentType: string,
    ): Promise<Reply> {
      const response = await fetch(`${stack.url}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: {
          apikey: stack.publishableKey,
          Authorization: `Bearer ${accessToken ?? stack.publishableKey}`,
          "Content-Type": contentType,
        },
        body: new Blob(["%PDF-1.4 test"], { type: contentType }),
      });
      return reply(response);
    },

    /** Removes every member the tests added (their profiles go with them). */
    async cleanUp(): Promise<void> {
      for (const id of created.splice(0)) {
        await fetch(`${stack.url}/auth/v1/admin/users/${id}`, {
          method: "DELETE",
          headers: asOperator,
        });
      }
    },
  };
}
