# AMH Billing 2.0

Repository: https://github.com/imshaid/amh (private).

Order, delivery and billing system for আদর্শ মুন্সির হোটেল. Everything about what to build is in `docs/BLUEPRINT.md`; progress is in `docs/PROGRESS.md`; the approved visual prototype is `docs/reference/demo.html`.

## How we work

- Work happens in **segments** (BLUEPRINT §9). One segment per session. Do the first segment not marked done in `docs/PROGRESS.md`, then stop and report. Never start the next segment unless asked.
- At the start: read BLUEPRINT, PROGRESS, `docs/DECISIONS.md`, then plan the segment before writing code.
- Before finishing: typecheck, lint, tests and build all pass; run the app and look at what you built (desktop and phone width, light and dark); commit.
- At the end, update `docs/PROGRESS.md`: what was done, what was verified, anything left over, and notes for the next session. If the session is running out mid-segment, stop at a clean point and write a precise handoff there.
- Record non-obvious choices in `docs/DECISIONS.md` (one short entry each).
- Git: follow BLUEPRINT §10 exactly — a branch per segment, a Conventional Commit after every completed working unit, push after every commit, merge to `main` + tag at segment end. Never leave finished work uncommitted or unpushed.

## Rules

- Code and code comments in English only. All user-facing text goes through i18n (`bn` default, `en`), never hard-coded in components.
- Money math only in the database/server with exact decimals. Never in UI code or AI output.
- Snapshot policy, issued-means-locked, and one bill per order (BLUEPRINT §2, §4) are invariants. Do not weaken them.
- Printed documents must match the legacy design exactly (BLUEPRINT §6).
- Follow the design direction in BLUEPRINT §7. If something looks generic, it is not done.
- Secrets never reach the frontend bundle. AI and PDF calls go through server-side functions.
- Sample files in `docs/reference/samples/` contain real names and phone numbers. Use them as fixtures; never publish them.
