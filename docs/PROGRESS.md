# Progress

Update this file at the end of every session. Newest notes at the top of each segment.

| # | Segment | Status |
|---|---|---|
| 0 | Foundation | done (the first preview deploy waits for the owner's Cloudflare token; see notes) |
| 1 | Design system & shell | done; the owner's review of the look is still open (the owner chose to start Segment 2 first) |
| 2 | Database, auth, security | done (hosted project migrated and member-auth deployed; the owner still adds the admins and turns off sign-ups, see notes) |
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

### Segment 2 — Database, auth, security

#### 2026-10-20 to 2026-10-28 — session 1 (merged to `main`, tag `seg-02`)

The owner had not reviewed Segment 1's look yet and chose to start Segment 2 anyway; the review stays open. The owner also decided the open numbering questions (bill numbers: their own sequence by issue date; revisions: same number with `-R1`) and the PIN length (6 digits).

##### Done

- **Schema** (`supabase/migrations/`, 8 migrations; described in `docs/data-model.md`):
  - Foundation: a `private` schema, default-deny privileges, helpers (Dhaka today, phone, name and reference keys), the business settings row seeded with the legacy header's text, member profiles and `is_member()`.
  - Numbering: locked per-fiscal-year sequences; orders `AMH/26-27/0047` on creation, bills `AMH/27-28/B-0001` at issue by issue date, revisions `-R1`, challans numbered per order and never renumbered.
  - Directories: organisations, projects (deduction rate, default 16%), log codes, areas, locations with aliases, contacts, package categories, packages with item lists, rate history and client codes.
  - Orders and documents: orders (with their draft bill from the start), the package snapshot lines, challans (header defaults from client, place and log code), quantities (keeping `10+2`), summaries, files, bills and revisions, issued documents, import profiles, delivery links.
  - Invariants as triggers, whoever writes: issued-means-locked (delivery and signed-copy tracking stay open), one issued bill and one open revision per order, write-once issued documents and bills, immutable numbers, people-only status changes.
  - Money: payments and allocations with deferred checks (no over-allocation, no over-settlement), the paid status following allocations, and the figures as views (`order_line_totals`, `order_totals`, `bill_balances` with age buckets). Deduction = round(gross × rate, 2); expected net = gross − deduction.
  - Audit: one trigger per business table writes `audit_log` (actor, channel, batch id, order); append-only for everyone.
  - Storage: four private buckets with member policies. Realtime publishes `audit_log` only.
  - Member sign-in: PIN hashes, per-phone throttling with growing lockouts, an attempts log, service-role-only functions.
- **`member-auth` Edge Function** (`supabase/functions/`): sign-in with phone and PIN, change PIN, and for members or the operator: add member, reset PIN, switch on/off (with an Auth ban). Web APIs only, no dependencies; unit-tested in Node.
- **`npm run members`**: add, reset-pin, deactivate/activate, list, and `dev-member` (local: 01300000000 / 135790; `db:reset` recreates it). `--hosted` works with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
- **Generated types** (`apps/web/src/lib/database.gen.ts`, `npm run db:types`; `--check` in CI) and a typed client. UI order statuses now come from the database enum (`partially_paid`).
- **Web app**:
  - A designed sign-in screen: the hotel's blue panel with the proprietor's badge; phone in Bangla or Latin digits; the PIN in six boxes with show/hide; "stay signed in on this device"; every refusal explained (tries left, lock time, switched off, offline, unreachable, no server).
  - Members-only routing: the signed-in layout redirects to sign-in and back; a switched-off member is signed out with a reason; preview mode (no backend) opens without sign-in.
  - Untrusted devices keep the session in sessionStorage. Sign-out is per device. Language and theme follow the profile.
  - The member in the sidebar foot and the phone's More sheet, with Change PIN (dialog) and Sign out.
  - New primitives in the gallery: PinInput, Checkbox, Avatar. Dialog can choose where focus starts.
- **Checks**: `npm run check:stack` (db lint, pgTAP, types check, integration, stack e2e) and a matching CI job, "Database and sign-in"; previews now need both jobs. `npm run dev -- --host` now reaches Vite (it did not before; the Segment 1 note below was wrong).
- **Docs**: `docs/data-model.md` rewritten to match what was built, 21 entries in `docs/DECISIONS.md`, README (members, hosted setup, scripts, layout).

##### Verified

- `npm run verify`: 252 unit tests (222 web, 30 Edge Function).
- `npm run db:test`: 293 pgTAP assertions in 9 files, including the security invariants (RLS, policies, grants, search paths) for every table, view and function. `npm run db:lint`: no plpgsql_check warnings. The tests found and fixed: an interval overflow in long lockouts, missing grants for trigger helpers (now security definer), and counts that assumed an empty database.
- `npm run test:integration`: 10 tests against the real local Auth, Data API, Storage and Edge Runtime, including that the PIN is useless against Auth directly and that sign-ups are refused.
- `npm run e2e`: 28 passed (2 phone-only skipped on desktop). `npm run e2e:stack`: 10 passed, desktop and phone: sign in with Bangla digits and back to the wanted page, sign out, wrong PIN, trusted vs untrusted device, WCAG AA (axe) on the live form in light and dark, no horizontal overflow.
- Mutation checks: weakening the open-redirect guard fails its test; a Node import in function code fails lint.
- GitHub Actions run 40625038463: Check and "Database and sign-in" passed (the database job takes about 3.5 minutes); the preview job skipped (no Cloudflare token yet).
- Viewed at 1440×900, 834×1112 and 390×844, light and dark, Bangla and English: sign-in, a wrong PIN, signed in, the member menu, the Change PIN dialog, the More sheet. No horizontal overflow; the only console error is the browser's own log line for a deliberate wrong PIN (HTTP 401).

##### Left over

**Owner actions:**

1. **Review Segment 1's look** (still open): `npm run dev`, sign in locally as 01300000000 / 135790, open <http://localhost:5173/dev/gallery> and the screens; on a phone on the same Wi-Fi, `npm run dev -- --host` and the PC's address on port 5173.
2. **Hosted project `amh`: finish setting up sign-in.** Done on 2026-10-28, at the owner's request: the project was restored (the owner pressed Restore; it had paused after a week without use), the 8 migrations were pushed, `npx supabase test db --linked` passed all 293 assertions there, a random `AUTH_PIN_PEPPER` was set (shown nowhere, stored nowhere else; changing it voids every PIN), and `member-auth` was deployed. A temporary member then signed in end to end (session, RLS, wrong PIN, anonymous refused, PIN useless against Auth directly) and was deleted. Left for the owner:
   - Dashboard → Authentication → Sign In / Providers: turn **off** "Allow new users to sign up" and keep the **Email** provider on (member-auth signs members in through it). Until then anyone could create an Auth user there, though RLS shows such a user nothing.
   - Add the three admins, each with their own PIN: `SUPABASE_URL=https://bdzgidmoaigeubsowcpo.supabase.co SUPABASE_SECRET_KEY=<Dashboard → Project Settings → API Keys → secret> npm run members -- add --hosted --phone 01XXXXXXXXX --name-bn "নাম" --name-en "Name"`.
   - Set the Site URL once the app has its Cloudflare address.
   - On the free plan the project pauses again after a week without use; restore it from the dashboard (the CLI cannot).
3. **Cloudflare token** for previews (Segment 0 notes), unchanged.
4. Check the English texts seeded in business settings (`proprietor_en` "Md. Ziaur Rahman (Zia)", `tagline_en`): they are Claude's translations. They can be edited once Settings exists (Segment 14), or in Studio.

**For the record:**

- `npm run db:env` was run in this session and rewrote the git-ignored `apps/web/.env.local` to point at the local stack. If it pointed at the hosted project before, set it back from the repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Pushes during the segment cancelled each other's CI runs (`concurrency: cancel-in-progress`); the last run is the one that counts.
- The hosted check left a few rows in `private.sign_in_throttle` / `sign_in_attempts` (a made-up number, 01799999990, and the deleted temporary member's 01300000099) and audit rows for that member. They are harmless.
- The hosted project's API keys are read with `npx supabase projects api-keys --reveal`; without `--reveal` the secret key is masked and Auth answers "Invalid API key".

##### Next session

- Start Segment 3 (Directories). The tables, RLS and audit already exist; Segment 3 builds the screens, the package Excel import and live updates.
- Notes for Segment 3 and later:
  - **New tables** need three calls in their migration: `private.grant_member_access(...)` (RLS, grants, member policy; pass column lists where members must not write some columns), `private.track_updates(...)`, `private.audit_changes(...)`. `00_security.test.sql` and `06_audit.test.sql` fail if one is missing.
  - **New functions in `public`** that members may call must be added to the approved list in `00_security.test.sql`. Put helpers in `private`; grant execute to `authenticated` only when RLS, defaults or checks need them.
  - After changing migrations: `npm run db:reset`, `npm run db:types`, commit the generated file.
  - **Money** from the Data API: select it as text (`gross::text`) and pass the string to `formatMoney`.
  - **Errors**: `AMH01` locked, `AMH02` immutable, `AMH03` status, `AMH04` money totals; PostgREST returns them as `code` with HTTP 400. Translate by code.
  - **Live updates**: subscribe to `audit_log` (Realtime), filter by `entity_type`, invalidate matching queries; point the live indicator at the Realtime channel state then.
  - **Forms**: the sign-in forms use plain state; bring in react-hook-form + zod with the directory forms (BLUEPRINT §3).
  - Segment 4 decides challan uniqueness (open question in `docs/data-model.md`). Segment 5 writes `issue_bill` / `revise_bill` with `private.bill_number_for`, freezing totals from `order_totals` and setting `amh.system_change`; when a revision is issued it must also re-run `private.refresh_payment_status`. Segment 8 adds the two delivery-link token functions (the only door for anon). Segment 10 writes payment recording and the allocation suggestion. Segment 13 sets `amh.channel = 'ai'` and `amh.batch_id` for AI actions.
  - Test helpers: `apps/web/src/test/fake-supabase.ts` plays the backend for app tests; `supabase/tests/database/_setup.psql` has `tests.create_member`, `tests.act_as`, `tests.act_as_anon`, `tests.act_as_service`.
- **Gotchas:**
  - After adding an Edge Function, restart the stack (`npm run db:stop && npm run db:start`): the edge runtime reads its function list at start. If it is not running (`docker ps`), `docker start supabase_edge_runtime_amh`.
  - `[auth.email] enable_signup = false` switches off the whole email provider and breaks sign-in; sign-ups are refused by `[auth] enable_signup = false`.
  - pgTAP files run against whatever the local database holds (members from integration and e2e runs): never count whole tables.
  - The Supabase CLI's `projects` commands cannot restore a paused free project; use the dashboard.

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
