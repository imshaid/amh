# AMH Billing 2.0

Order, delivery and billing system for আদর্শ মুন্সির হোটেল (Adarsha Munshir Hotel), Thakurgaon.

- What to build and in which order: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- Where we are: [docs/PROGRESS.md](docs/PROGRESS.md) · why things are as they are: [docs/DECISIONS.md](docs/DECISIONS.md) · schema design: [docs/data-model.md](docs/data-model.md)
- Working rules for Claude Code sessions: [CLAUDE.md](CLAUDE.md)

`docs/reference/samples/` contains real names and phone numbers. Keep this repository private.

## Requirements

- Node.js 22 (see `.nvmrc`) and npm
- Docker, for the local Supabase stack

## Getting started

```sh
npm install
npx playwright install chromium   # browser for the end-to-end tests
npm run db:start                  # local Supabase; the first run pulls the images
npm run db:env                    # writes apps/web/.env.local for the local stack
npm run db:dev-member             # a local member: phone 01300000000, PIN 135790
npm run dev                       # http://localhost:5173
```

Sign in with the development member's phone number and PIN. After `npm run db:reset` the member is created again.

The app also runs without Supabase, as a UI preview without sign-in; the live indicator in the top bar then says the server is not set up yet.

Every colour, type style and component is on one page at <http://localhost:5173/dev/gallery> (also in the command bar, Ctrl+K).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run check` | Everything CI runs: typecheck, lint, format, unit tests, build, bundle secret scan, end-to-end smoke tests |
| `npm run verify` | The fast part of `check`: typecheck, lint, format, unit tests |
| `npm run test`, `npm run test:watch` | Vitest |
| `npm run e2e` | Playwright smoke tests (desktop and phone) against a production build without a backend |
| `npm run check:stack` | Everything that needs the local stack: `db:lint`, `db:test`, `db:types -- --check`, `test:integration`, `e2e:stack` |
| `npm run db:start`, `db:stop`, `db:status` | Local Supabase (Studio at <http://127.0.0.1:54423>) |
| `npm run db:reset` | Recreate the local database from the migrations, then the development member |
| `npm run db:env` | Point the web app at the running local Supabase |
| `npm run db:test` | Database tests (pgTAP, `supabase/tests/database/`) |
| `npm run db:lint` | Check the database functions (plpgsql_check) |
| `npm run db:types` | Regenerate `apps/web/src/lib/database.gen.ts` after changing migrations |
| `npm run test:integration` | Sign-in, RLS and Storage against the local stack (`supabase/tests/integration/`) |
| `npm run e2e:stack` | Playwright sign-in tests against a build that talks to the local stack |
| `npm run members -- <command>` | Add members, reset PINs, switch members off and on, list them (see below) |
| `npm run preview:pages -w @amh/web` | Serve `apps/web/dist` with Cloudflare's headers and routing |
| `npm run icons -w @amh/web` | Re-render the app icons from their SVG sources |

## Layout

```text
apps/web/            the app: React 19, TypeScript, Vite, TanStack Router and Query, Tailwind CSS v4, i18next
  src/routes/        file-based routes (src/routeTree.gen.ts is generated)
  src/app/           router, query client, navigation, sign-in screen, app shell (sidebar, top bar, bottom bar, command bar)
  src/ui/            the design system: primitives on Radix, icons, motion (see /dev/gallery)
  src/styles/        tokens (colour, type, motion), fonts, and the contrast test that guards them
  src/dev/           developer pages: the design gallery
  src/i18n/          bn and en catalogues, formatting (Bangla digits, taka, dates)
  src/lib/           environment, Supabase client and generated database types, auth (sign-in, membership,
                     device trust), phone numbers, theme, media and network hooks
  build/             build-time code (Cloudflare security headers)
  e2e/               Playwright smoke tests and axe accessibility checks
  e2e-stack/         Playwright tests against the local Supabase stack (sign-in)
supabase/
  migrations/        the schema: tables, RLS, numbering, money, audit, sign-in (see docs/data-model.md)
  functions/         Edge Functions (member-auth: phone and PIN sign-in, managing members)
  tests/database/    pgTAP tests, including security invariants every migration must keep
  tests/integration/ tests against the running stack's Auth, Data API, Storage and functions
scripts/             repository scripts (bundle secret scan, local env, members, database types)
docs/                blueprint, progress, decisions, data model, reference material
```

## Members

Members (the admins) sign in with their mobile number and a 6-digit PIN. Nobody can sign up. The first members are added by whoever holds the project's secret key:

```sh
npm run members -- add --phone 01XXXXXXXXX --name-bn "নাম" --name-en "Name"   # asks for the PIN twice
npm run members -- reset-pin --phone 01XXXXXXXXX   # also lifts a lock after too many wrong PINs
npm run members -- deactivate --phone 01XXXXXXXXX  # or activate
npm run members -- list
```

These work on the local stack. Add `--hosted` to work on the hosted project, with `SUPABASE_URL` (`https://bdzgidmoaigeubsowcpo.supabase.co`) and `SUPABASE_SECRET_KEY` (Dashboard → Project Settings → API Keys, the secret key) in the environment.

### Setting up sign-in on the hosted project

Once per project (the CLI is linked; `npx supabase db push` asks for the database password kept in `~/.config/amh/supabase-db-password`):

```sh
npx supabase db push                                   # apply the migrations
npx supabase secrets set AUTH_PIN_PEPPER="$(openssl rand -base64 48)"   # once; changing it voids every PIN
npx supabase functions deploy member-auth --no-verify-jwt
```

Then, in the Dashboard under Authentication: turn off "Allow new users to sign up" but keep the Email provider enabled (member-auth signs members in through it), and set the Site URL to the app's address.

## Deployment

GitHub Actions (`.github/workflows/ci.yml`) runs the checks on every push. Once the repository has the `CLOUDFLARE_ACCOUNT_ID` variable and the `CLOUDFLARE_API_TOKEN` secret, it also deploys each pushed branch to a Cloudflare Pages preview. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as repository variables to connect previews to the hosted Supabase project.
