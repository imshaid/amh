// @ts-check
// Fails if a built frontend contains anything secret: a known secret-key format, a JWT for any role
// other than `anon`, or the value of a secret-looking environment variable that was present at
// build time. Reports names and files only, never the secret itself.
//
// Usage: node scripts/check-bundle.mjs <dist directory>
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const dist = process.argv[2];
if (!dist) {
  console.error("Usage: node scripts/check-bundle.mjs <dist directory>");
  process.exit(2);
}

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".css",
  ".html",
  ".json",
  ".webmanifest",
  ".svg",
  ".map",
  ".txt",
]);

/** @type {[string, RegExp][]} */
const PATTERNS = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const SECRET_NAME =
  /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|SERVICE_ROLE|API_KEY|ACCESS_KEY|CREDENTIAL/i;

const secretEnv = Object.entries(process.env).filter(
  ([name, value]) =>
    SECRET_NAME.test(name) && !name.startsWith("VITE_") && value && value.length >= 12,
);

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** @param {string} payload */
function jwtRole(payload) {
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims?.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}

const findings = [];
let scanned = 0;
for (const file of files(dist)) {
  const name = relative(dist, file);
  if (!TEXT_EXTENSIONS.has(extname(file)) && !name.startsWith("_")) continue;
  const text = readFileSync(file, "utf8");
  scanned += 1;
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(text)) findings.push(`${name}: contains a ${kind}`);
  }
  for (const match of text.matchAll(JWT)) {
    const role = jwtRole(match[1] ?? "");
    if (role !== "anon") findings.push(`${name}: contains a JWT for role "${String(role)}"`);
  }
  for (const [variable, value] of secretEnv) {
    if (value && text.includes(value)) findings.push(`${name}: contains the value of $${variable}`);
  }
}

if (findings.length > 0) {
  console.error(`Secrets found in ${dist}:\n- ${findings.join("\n- ")}`);
  process.exit(1);
}
console.warn(
  `Bundle check: scanned ${String(scanned)} files in ${dist}; no secrets ` +
    `(checked ${String(PATTERNS.length + 1)} formats and ${String(secretEnv.length)} secret environment values).`,
);
