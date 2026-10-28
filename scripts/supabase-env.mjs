// @ts-check
// Writes apps/web/.env.local for the running local Supabase stack, or with `--mode <name>` the
// file Vite reads for that build mode (apps/web/.env.<name>.local; the stack end-to-end tests use
// `--mode stack`). Only the API URL and the publishable key are copied: the stack's secret and
// service-role keys must never reach the frontend.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modeFlag = process.argv.indexOf("--mode");
const mode = modeFlag === -1 ? null : process.argv[modeFlag + 1];
if (mode !== null && !/^[a-z][a-z0-9-]*$/.test(mode ?? "")) {
  console.error("Usage: node scripts/supabase-env.mjs [--mode <name>]");
  process.exit(2);
}
const target = join(root, "apps", "web", mode ? `.env.${mode}.local` : ".env.local");

let output;
try {
  output = execFileSync(join(root, "node_modules", ".bin", "supabase"), ["status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  console.error("The local Supabase stack is not running. Start it with `npm run db:start`.");
  process.exit(1);
}

/** @type {Record<string, string | undefined>} */
const status = JSON.parse(output.slice(output.indexOf("{")));
const url = status.API_URL;
const key = status.PUBLISHABLE_KEY;

if (!url || !key?.startsWith("sb_publishable_")) {
  console.error("`supabase status` did not report an API URL and a publishable key.");
  process.exit(1);
}

writeFileSync(
  target,
  [
    "# Written by `npm run db:env` from the local Supabase stack. Not committed.",
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${key}`,
    "",
  ].join("\n"),
);
console.warn(`Wrote ${target}`);
