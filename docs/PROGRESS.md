# Progress

Update this file at the end of every session. Newest notes at the top of each segment.

| # | Segment | Status |
|---|---|---|
| 0 | Foundation | in progress (only the preview URL remains; it needs the owner's Cloudflare credentials) |
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

#### 2026-10-19 — session 1 (branch `seg/00-foundation`, pushed, not merged)

Everything in the segment is built, committed, pushed and verified, except deploying to a preview URL. The deploy pipeline is ready and runs as soon as Cloudflare is connected (see "Left over").

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
- **Docs:** `docs/data-model.md` started (with open questions for the owner), 18 entries in `docs/DECISIONS.md`, and the README.

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

##### Left over (owner actions)

1. **The GitHub repository is public.** `CLAUDE.md` says private, and `docs/reference/samples/` contains real names and phone numbers. Claude was not permitted to change the visibility. Use Settings → General → Danger Zone → Change visibility → Private, or run `gh repo edit imshaid/amh --visibility private --accept-visibility-change-consequences`. There were no forks, stars or watchers at the time.
2. **Cloudflare, needed to finish Segment 0:**
   - Create an API token with the permission Account → Cloudflare Pages → Edit.
   - Run `gh variable set CLOUDFLARE_ACCOUNT_ID --body <account id>`.
   - Run `gh secret set CLOUDFLARE_API_TOKEN` and paste the token when asked.
   - Re-run the latest CI run, or push. The first deploy creates the Pages project `amh` with production branch `production`, so every branch, main included, is a preview. The preview URL is printed in the job summary.
3. **Hosted Supabase project:** none exists for AMH; the CLI account has only "Jogan". Create one in the region you choose (ap-south-1, Mumbai, is closest to Thakurgaon; Jogan uses ap-southeast-1, Singapore). Then:
   - run `npx supabase link --project-ref <ref>`;
   - set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as GitHub variables (both are public values).

   Not needed to finish Segment 0; needed before Segment 2's migrations go live.

##### Next session

- If item 2 is done: open the preview URL and check it in Bangla and English, light and dark, on a phone. Then mark Segment 0 `done`, merge `seg/00-foundation` into `main` with `--no-ff`, push, tag `seg-00`, push the tag, delete the branch, and stop.
- Notes for Segment 1:
  - **Fonts:** none are loaded yet; system Bangla fallbacks are in the font tokens. Self-host Anek Bangla (with the width axis), Hind Siliguri, IBM Plex Mono, Noto Serif Bengali and Tinos.
  - **Shell to replace:** `src/app/shell/*` (app shell, preference controls, placeholder, status pages, server status line) and `src/app/update-prompt.tsx`, which should become a toast.
  - **theme-color:** when a user forces light or dark against the device setting, update `<meta name="theme-color">`.
  - **Devtools:** TanStack devtools were left out to keep screenshots clean; add them behind `import.meta.env.DEV` if wanted.
- Notes for Segment 2:
  - Read the open questions at the end of `docs/data-model.md`.
  - `supabase/config.toml` only changed ports, `site_url` and analytics. Decide signups, JWT expiry, `auto_expose_new_tables` and `seed.sql` (the CLI warns that it is missing).
  - Give `createSupabaseClient` the generated `Database` type.
- **Gotchas:**
  - `grep` is aliased to ugrep in this shell, and complex regexes can fail silently behind `||`.
  - `pkill -f` matches your own command line.
  - GitHub push protection rejects real-format keys, even the CLI's local defaults.
  - Vitest 5 does not look for config files in parent directories; run it from the root.
