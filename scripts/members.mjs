// @ts-check
// Adds and manages members (the admins who sign in) through the member-auth Edge Function, as the
// operator: a caller holding the project's secret key. This is how the first members are added;
// later a member can add others in the app (Settings, Segment 14).
//
// Usage: npm run members -- <command> [options]
//   add         --phone 01XXXXXXXXX --name-bn "নাম" [--name-en "Name"]
//   reset-pin   --phone 01XXXXXXXXX
//   deactivate  --phone 01XXXXXXXXX
//   activate    --phone 01XXXXXXXXX
//   list
//   dev-member  adds (or resets) the local development member: 01300000000, PIN 135790
//
// It works on the local stack (keys from `supabase status`) unless --hosted is given; then it
// reads SUPABASE_URL and SUPABASE_SECRET_KEY from the environment (Supabase Dashboard → Project
// Settings → API Keys). PINs are asked for on the terminal and never shown; set AMH_MEMBER_PIN to
// pass one without a terminal.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEV_MEMBER = {
  phone: "01300000000",
  nameBn: "ডেভেলপার",
  nameEn: "Developer",
  pin: "135790",
};

/** @type {Record<string, string>} */
const ERRORS = {
  not_configured:
    "member-auth is not configured. On the hosted project, set AUTH_PIN_PEPPER with `npx supabase secrets set` and deploy the function.",
  not_allowed: "The secret key was not accepted.",
  phone_taken: "That phone number already belongs to a member.",
  invalid_phone: "That is not a Bangladeshi mobile number (01XXXXXXXXX).",
  invalid_name: "A Bangla name is needed (at most 80 characters).",
  invalid_pin: "A PIN is exactly 6 digits.",
  not_found: "No member has that phone number.",
  server_error:
    "The function failed; see its logs (Supabase Dashboard → Edge Functions → member-auth → Logs).",
};

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/** @returns {{ url: string, secretKey: string, local: boolean }} */
function target(hosted) {
  if (hosted) {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) {
      fail(
        "Set SUPABASE_URL and SUPABASE_SECRET_KEY for --hosted (Dashboard → Project Settings → API Keys).",
      );
    }
    return { url: url.replace(/\/+$/, ""), secretKey, local: false };
  }
  let output;
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
    fail("The local Supabase stack is not running. Start it with `npm run db:start`.");
  }
  /** @type {Record<string, string | undefined>} */
  const status = JSON.parse(output.slice(output.indexOf("{")));
  if (!status.API_URL || !status.SECRET_KEY)
    fail("`supabase status` did not report the API URL and secret key.");
  return { url: status.API_URL, secretKey: status.SECRET_KEY, local: true };
}

/** Reads a PIN from the terminal without showing it. */
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error("No terminal to ask for a PIN; set AMH_MEMBER_PIN."));
      return;
    }
    process.stdout.write(prompt);
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    /** @param {string} chunk */
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        } else if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        } else if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          value += char;
          process.stdout.write("•");
        }
      }
    };
    input.on("data", onData);
  });
}

async function askPin(label) {
  if (process.env.AMH_MEMBER_PIN) return process.env.AMH_MEMBER_PIN;
  const pin = await readHidden(`${label} (6 digits): `);
  if (!/^[0-9০-৯]{6}$/.test(pin)) fail(ERRORS.invalid_pin);
  const again = await readHidden("Once more: ");
  if (again !== pin) fail("The two PINs differ.");
  return pin;
}

/** @param {{ url: string, secretKey: string }} where @param {Record<string, unknown>} body */
async function callFunction(where, body) {
  let response;
  try {
    response = await fetch(`${where.url}/functions/v1/member-auth`, {
      method: "POST",
      headers: {
        apikey: where.secretKey,
        Authorization: `Bearer ${where.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    fail(`Could not reach ${where.url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 404 && (await response.clone().text()).includes("not found")) {
    fail(
      "The member-auth function is not deployed there (locally: restart the stack with `npm run db:stop && npm run db:start`).",
    );
  }
  /** @type {Record<string, unknown>} */
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

function explain(result) {
  const code = typeof result.error === "string" ? result.error : "unknown";
  return ERRORS[code] ?? `The function answered: ${code}`;
}

async function listMembers(where) {
  const query = new URLSearchParams({
    select: "phone,display_name_bn,display_name_en,active,created_at",
    order: "created_at",
  });
  const response = await fetch(`${where.url}/rest/v1/profiles?${query.toString()}`, {
    headers: { apikey: where.secretKey, Authorization: `Bearer ${where.secretKey}` },
  });
  if (!response.ok) fail(`Could not list members: HTTP ${response.status}`);
  /** @type {{ phone: string, display_name_bn: string, display_name_en: string, active: boolean }[]} */
  const members = await response.json();
  if (members.length === 0) {
    console.warn(
      'No members yet. Add one with `npm run members -- add --phone 01XXXXXXXXX --name-bn "নাম"`.',
    );
    return;
  }
  for (const member of members) {
    console.warn(
      `${member.phone}  ${member.active ? "active  " : "inactive"}  ${member.display_name_bn}${member.display_name_en ? ` (${member.display_name_en})` : ""}`,
    );
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      phone: { type: "string" },
      "name-bn": { type: "string" },
      "name-en": { type: "string" },
      hosted: { type: "boolean", default: false },
    },
  });
  const [command] = positionals;
  const where = target(values.hosted);
  const needPhone = () =>
    values.phone ?? fail("Give the member's phone number with --phone 01XXXXXXXXX.");

  switch (command) {
    case "add": {
      const phone = needPhone();
      const nameBn =
        values["name-bn"] ?? fail('Give the member\'s Bangla name with --name-bn "নাম".');
      const pin = await askPin("New PIN");
      const { ok, result } = await callFunction(where, {
        action: "add-member",
        phone,
        nameBn,
        nameEn: values["name-en"] ?? "",
        pin,
      });
      if (!ok) fail(explain(result));
      console.warn(`Added ${phone}. They can sign in with their phone number and PIN.`);
      break;
    }
    case "reset-pin": {
      const phone = needPhone();
      const pin = await askPin("New PIN");
      const { ok, result } = await callFunction(where, { action: "reset-pin", phone, pin });
      if (!ok) fail(explain(result));
      console.warn(`The PIN for ${phone} is changed, and any lock on the number is lifted.`);
      break;
    }
    case "activate":
    case "deactivate": {
      const phone = needPhone();
      const active = command === "activate";
      const { ok, result } = await callFunction(where, { action: "set-active", phone, active });
      if (!ok) fail(explain(result));
      console.warn(
        active
          ? `${phone} can sign in again.`
          : `${phone} is switched off: they can no longer sign in or see anything.`,
      );
      break;
    }
    case "list":
      await listMembers(where);
      break;
    case "dev-member": {
      if (!where.local) fail("The development member is for the local stack only.");
      const added = await callFunction(where, { action: "add-member", ...DEV_MEMBER });
      if (!added.ok && added.result.error !== "phone_taken") fail(explain(added.result));
      if (!added.ok) {
        const reset = await callFunction(where, {
          action: "reset-pin",
          phone: DEV_MEMBER.phone,
          pin: DEV_MEMBER.pin,
        });
        if (!reset.ok) fail(explain(reset.result));
      }
      console.warn(`Local development member: phone ${DEV_MEMBER.phone}, PIN ${DEV_MEMBER.pin}.`);
      break;
    }
    default:
      fail(
        "Usage: npm run members -- <add|reset-pin|deactivate|activate|list|dev-member> [--phone 01XXXXXXXXX] [--name-bn নাম] [--name-en Name] [--hosted]",
      );
  }
}

await main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
