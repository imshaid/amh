# Progress

Update this file at the end of every session. Newest notes at the top of each segment.

| # | Segment | Status |
|---|---|---|
| 0 | Foundation | done (the first preview deploy waits for the owner's Cloudflare token; see notes) |
| 1 | Design system & shell | done, waiting for the owner's review of the look (Segment 2 waits for it; see notes) |
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

### Segment 1 — Design system & shell

#### 2026-10-20 — session 1 (merged to `main`, tag `seg-01`)

The design system and the app shell are built, tested and merged. The segment's done-criterion, the owner reviewing the look in a browser, is still open: no preview URL exists yet (no Cloudflare token), so the owner reviews locally (see "Left over").

##### Done

- **Tokens** (`src/styles/`):
  - Full light and dark colour sets, each designed on its own.
  - A type scale with role utilities (`type-hero`, `type-title`, `type-heading`, `type-figure`, …), radii by role, overlay and paper elevation, motion easings and keyframes.
  - An 8-slot chart palette validated for colour blindness on our surfaces.
  - `tokens.test.ts` checks every text pair for 4.5:1 and every control edge or status mark for 3:1, in both themes. It found and fixed: muted text, turmeric text and form-field edges.
- **Fonts:** Anek Bangla (weight and width axes), Hind Siliguri, IBM Plex Mono, Noto Serif Bengali, Tinos. Self-hosted, Bengali and Latin subsets only, cached on first use.
- **Icons:** Lucide at 1.75px, under semantic names in `src/ui/icons.ts`.
- **Primitives** (`src/ui/`):
  - Controls: Button, IconButton, ConfirmButton (inline second press), Field with Input, Textarea, SearchInput and Select, ChipGroup/Chip, Tag, Pill, OrderStatusPill (all seven statuses).
  - Containers: Card, CardHeader, Note, PageHeader, Kbd, Menu, Tabs (sliding indicator), Dialog, Sheet (drag to dismiss), toasts with job progress.
  - States: Skeleton, PageSkeleton, EmptyState (empty, no results, error, unavailable).
  - DataTable (TanStack Table v9: sorting, sticky header and footer, phone cards, virtualised rows).
  - Figures: KpiTile, Meter, Sparkline (running month dashed and hollow), ProgressSteps (labels under circles in narrow containers).
- **Motion** (`src/ui/motion/`): reduced-motion aware; screen fade-and-rise, Stagger, CountUp (settles on the exact decimal), a one-off realtime flash.
- **Shell** (`src/app/shell/`):
  - Sidebar (from 1024px) with a sliding highlight and the hotel's AMH mark.
  - Sticky top bar: screen title, search, a live indicator that pulses once (never loops), বাং/EN, and a theme menu.
  - Phone bottom bar: Home, Orders, a raised New button, Receivables, and More (a sheet with the directories and search).
  - Command bar (Ctrl/⌘K): pages and actions, matched in either language and digit set.
  - Focus moves to the new screen after navigation. Skeletons show for slow loads.
  - Designed placeholder screens with their real subtitles; designed not-found and error pages.
  - The PWA update prompt is a toast.
  - A forced theme now also sets `<meta name="theme-color">` (Segment 0 leftover).
- **`/dev/gallery`:** every token, type role, icon and component with sample data, in both languages and themes. Not in the menu; reach it from the command bar or the dashboard.
- **Docs:** 18 entries in `docs/DECISIONS.md`; README layout updated.

##### Verified

- `npm run check` passes: 166 unit tests; 26 end-to-end tests on desktop and phone (2 phone-only tests skip on desktop).
- The new end-to-end tests include axe WCAG 2.1 A/AA scans with no violations on the dashboard and the full gallery, light and dark, desktop and phone. The scans found and fixed: label-in-name on the language and search buttons, document fonts off paper in dark mode, and a scrollable list with no keyboard access.
- Viewed at 1440×900, 1024×768, 834×1112 and 390×844, light and dark, Bangla and English, including open states: command bar, theme menu, select, dialog, More sheet, phone field sheet, toasts with progress. No console errors and no horizontal overflow at any width.
- Keyboard: the Tab order runs skip link → brand → menu → search → language → theme → content, with a visible focus ring at every stop. The command bar works from the keyboard.
- Bundle: the first screen loads about 260 KB of gzipped JS (React, router, query, i18n, Radix, Motion, the shell); the gallery is its own 51 KB chunk. Motion's features load with the app: loading them lazily left the first screen invisible (opacity 0) until they arrived.

##### Left over

**Owner action: review the look** (the segment's done-criterion). Run `npm run dev` and open <http://localhost:5173/dev/gallery>, then the other screens through the menu, on a PC and a phone (same Wi-Fi: `npm run dev -- --host`, then the PC's address on port 5173). Try light and dark, বাং and EN. Once the Cloudflare token exists (Segment 0 notes), the preview URL works too.

**For the record:**

- The pushes of `ef16bbc` and `ad1744c` failed CI. Their end-to-end tests still expected the Segment 0 shell; `4073fc5` fixed them.
- `ad1744c`'s message also lists sparkline, steps and table changes that had already landed in `3ebac6f` and `ef16bbc`; it holds only the sidebar wrap and gallery sample fixes. Pushed history was not rewritten.

##### Next session

- **Before Segment 2:** confirm the owner has reviewed the look and apply their feedback first; it may touch tokens, type or the shell. If the owner has not reviewed it yet, ask rather than start Segment 2.
- Notes for Segment 2:
  - The order statuses in the UI are `draft`, `confirmed`, `delivering`, `billed`, `partlyPaid`, `paid`, `cancelled` (`src/ui/order-status.ts`). Map the database enum to these.
  - Language and theme are still stored per device; BLUEPRINT §4 wants them on the profile.
  - The live indicator reads `useServerStatus()` and `navigator.onLine`. Point it at the Realtime connection state when Realtime arrives.
  - The Segment 0 Supabase notes still apply (open questions in `docs/data-model.md`, `config.toml`, generated `Database` type).
- Notes for later segments:
  - Build screens from `src/ui` and check new pieces in the gallery.
  - DataTable takes stable `columns` and `data` (memoised).
  - Toasts for PDF jobs: `toast.show({ progress })`, then `toast.update(id, { progress, duration })` when done.
  - The command bar gains orders, prices and locations in Segments 3–4 and the AI assistant in 13.
  - Performance pass (Segment 14): consider preloading the two main Bengali fonts and trimming the first-screen JS.
- **Gotchas:**
  - Vitest ignores CSS imports; `vitest.config.ts` whitelists `tokens.css` for the contrast test.
  - Module-level stores (toasts, command bar) outlive a test; reset them in `beforeEach`.
  - Tailwind utility names share namespaces: a `--text-field` size would have collided with the `field` colour, hence `text-input`.
  - `pkill -f` still matches your own shell; stop servers by port (`ss -ltnp`).

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
