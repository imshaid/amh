# Progress

Update this file at the end of every session. Newest notes at the top of each segment.

| # | Segment | Status |
|---|---|---|
| 0 | Foundation | done (the first preview deploy waits for the owner's Cloudflare token; see notes) |
| 1 | Design system & shell | not started |
| 2 | Database, auth, security | not started |
| 3 | Directories | not started |
| 4 | Orders & schedule | not started |
| 5 | Documents | not started |
| 6 | Page editor | not started |
| 7 | PDF service | not started |
| 8 | Datasheet & delivery | not started |
| 9 | Excel import | not started |
| 10 | Payments & receivables | not started |
| 11 | Dashboard & reports | not started |
| 12 | AI intake | not started |
| 13 | AI assistant | not started |
| 14 | Settings, polish & launch | not started |

Status values: `not started`, `in progress`, `done`, `split` (say how).

## Session notes

### Segment 0 — Foundation

#### 2026-10-19 — session 1 (merged to `main`, tag `seg-00`)

Everything in the segment is built, verified and merged. One exception: no preview has been deployed yet, because that needs a Cloudflare API token only the owner can create. The owner left the choice to Claude, so the segment was closed with the pipeline ready. It deploys on the first push after the token exists (see "Left over" and DECISIONS).

##### Done

- **Layout:** `CLAUDE.md` and `docs/` moved from `amh-v2/` to the repository root, and the older root `BLUEPRINT.md` removed. npm workspaces with the SPA in `apps/web`.
- **Tooling:** TypeScript 6 strict (plus `noUncheckedIndexedAccess`), ESLint 10 with type-aware rules, accessibility rules, a no-hard-coded-text rule and mandatory reasons on disables. Prettier with the Tailwind plugin, Vitest 5 with Testing Library, and Playwright projects for desktop Chrome and Pixel 7.
- **Styling:** Tailwind CSS v4 with the prototype's colour, font and elevation tokens for light and dark (`apps/web/src/styles/index.css`). The default palette is cleared so only tokens exist. `public/theme-boot.js` applies a saved theme before first paint.
- **i18n:** i18next with Bangla as default and English. Keys are typed from `bn.json`, and tests keep `en.json` in step. Formatting helpers give Bangla digits, South Asian grouping and taka from exact decimal strings.
- **Routing shell:** TanStack Router file routes for the prototype's seven sections plus an order page, not-found and error pages, a language switch, a theme choice and a skip link. It is a placeholder for Segment 1's designed shell.
- **Environment and Supabase:**
  - Only allowlisted `VITE_` variables can be bundled. The build fails on any other, and on a secret key passed as the publishable key.
  - `env.ts` validates at run time, and `getSupabase()` is the client factory.
  - The dashboard shows a server status line.
  - Local Supabase runs on ports 544xx; `npm run db:start` then `npm run db:env` connects the app to it.
- **PWA:** manifest with Bangla names, icons drawn from the hotel's logo, a precached app shell, and an update prompt (no automatic reloads).
- **Cloudflare Pages:**
  - `apps/web/wrangler.toml`.
  - The build writes `_headers`: a CSP limited to the app and the configured Supabase origin, hardening headers, `noindex`, and cache rules.
- **CI:**
  - `npm run check` runs typecheck, lint, format, unit tests, build, a bundle secret scan and the e2e tests.
  - `.github/workflows/ci.yml` runs the same steps and deploys branch previews once Cloudflare is configured.
- **Docs:** `docs/data-model.md` started (with open questions for the owner), 21 new entries in `docs/DECISIONS.md`, and the README.

##### Verified

- `npm run check` passes: 45 unit tests and 10 end-to-end tests (desktop and phone).
- GitHub Actions run 39229810979: Check passed in about 80 s; the preview job was skipped as designed.
- Viewed at 1440×900 and 390×844 in light and dark, in Bangla and English: no console errors and no horizontal overflow.
- The local Supabase stack runs and the dashboard reports "সংযোগ আছে" against it.
- Under `wrangler pages dev`:
  - headers and CSP apply, and there are no CSP violations;
  - deep links fall back to the app;
  - the service worker registers and the app reloads offline.
- The build refuses a stray `VITE_` variable and a `sb_secret_` key; the bundle scan catches planted secrets and names no values.
- Mutation check: breaking `theme-boot.js` makes its e2e test fail.
- **Hosted Supabase project:** created at the owner's request as `amh` (ref `bdzgidmoaigeubsowcpo`, ap-southeast-1, Postgres 17) and linked to the repo. Its public URL and publishable key are GitHub repository variables, so CI builds now point at it. A build with these values, served by `wrangler pages dev`, reports "সংযোগ আছে" against the hosted project with no CSP violations.

##### Left over (owner action)

**Cloudflare**, needed for the first preview deploy:

- Create an API token with the permission Account → Cloudflare Pages → Edit.
- Run `gh variable set CLOUDFLARE_ACCOUNT_ID --body <account id>`.
- Run `gh secret set CLOUDFLARE_API_TOKEN` and paste the token when asked.
- Push, or re-run the latest CI run. The first deploy creates the Pages project `amh` with production branch `production`, so every branch, main included, is a preview. The preview URL is printed in the job summary.

The database password of the hosted project is in `~/.config/amh/supabase-db-password` on this machine; keep a copy in a password manager.

##### Next session

- Start Segment 1. If the Cloudflare token now exists, check the first preview deploy (Bangla and English, light and dark, on a phone) and note the URL here.
- Notes for Segment 1:
  - **Fonts:** none are loaded yet; system Bangla fallbacks are in the font tokens. Self-host Anek Bangla (with the width axis), Hind Siliguri, IBM Plex Mono, Noto Serif Bengali and Tinos.
  - **Shell to replace:** `src/app/shell/*` (app shell, preference controls, placeholder, status pages, server status line) and `src/app/update-prompt.tsx`, which should become a toast.
  - **theme-color:** when a user forces light or dark against the device setting, update `<meta name="theme-color">`.
  - **Devtools:** TanStack devtools were left out to keep screenshots clean; add them behind `import.meta.env.DEV` if wanted.
- Notes for Segment 2:
  - Read the open questions at the end of `docs/data-model.md`.
  - `supabase/config.toml` only changed ports, `site_url` and analytics. Decide signups, JWT expiry, `auto_expose_new_tables` and `seed.sql` (the CLI warns that it is missing).
  - The hosted project is linked (`supabase/.temp/`, git-ignored). `npx supabase db push` needs the database password from `~/.config/amh/supabase-db-password`. Its Auth settings (site URL, redirect URLs) are still defaults; set them in Segment 2.
  - Give `createSupabaseClient` the generated `Database` type.
- **Gotchas:**
  - `grep` is aliased to ugrep in this shell, and complex regexes can fail silently behind `||`.
  - `pkill -f` matches your own command line.
  - GitHub push protection rejects real-format keys, even the CLI's local defaults.
  - Vitest 5 does not look for config files in parent directories; run it from the root.
