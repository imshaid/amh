import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_MEMBERS } from "./members";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Makes sure the test members exist with their PINs, which also clears any lock from earlier runs. */
export default async function globalSetup(): Promise<void> {
  const output = execFileSync(
    join(root, "node_modules", ".bin", "supabase"),
    ["status", "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const status = JSON.parse(output.slice(output.indexOf("{"))) as Record<
    string,
    string | undefined
  >;
  const url = status.API_URL;
  const secretKey = status.SECRET_KEY;
  if (!url || !secretKey)
    throw new Error("The local Supabase stack is not running (`npm run db:start`).");

  async function asOperator(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${url}/functions/v1/member-auth`, {
      method: "POST",
      headers: {
        apikey: secretKey ?? "",
        Authorization: `Bearer ${secretKey ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  for (const member of Object.values(TEST_MEMBERS)) {
    const added = await asOperator({ action: "add-member", ...member });
    if (added.status === 409) {
      const reset = await asOperator({ action: "reset-pin", phone: member.phone, pin: member.pin });
      if (!reset.ok)
        throw new Error(`Could not reset the PIN of ${member.phone}: HTTP ${String(reset.status)}`);
      const active = await asOperator({ action: "set-active", phone: member.phone, active: true });
      if (!active.ok)
        throw new Error(`Could not switch ${member.phone} on: HTTP ${String(active.status)}`);
    } else if (!added.ok) {
      throw new Error(
        `Could not add ${member.phone}: HTTP ${String(added.status)} ${await added.text()}`,
      );
    }
  }
}
