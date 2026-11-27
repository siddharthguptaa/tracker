# Tracker (React + Vite + TypeScript)

The classic single-file Tracker rebuilt as a React 19 app, **side by side** with the original.
Both use the same browser storage (`goal-tracker.v1`, `tally:*`), so your data is shared and nothing is lost by switching.

* Classic app: `https://<you>.github.io/tracker/` (unchanged)
* React app:  `https://<you>.github.io/tracker/next/`

## Commands

| Command | What it does |
|---|---|
| `npm install` | install and write `package-lock.json`. Run once, then commit that file |
| `npm ci` | install exactly what `package-lock.json` pins (CI uses this; needs internet once) |
| `npm run dev` | local dev server |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serve `dist/` on :4173 — **works with no internet** |
| `npm test` | Vitest unit tests (≈240) |
| `npm run test:e2e` | Playwright: every tab, every screen at 16 sizes (320–2560 px, landscape phones, tablets, laptops, 200% zoom) in light and dark, offline reload, add/edit/undo flows, backup |
| `npm run parity` | regenerates `PARITY.md` (classic features vs. React) |
| `npm run verify` | all of the above in order |

## What runs on every push (`.github/workflows/ci.yml`)

type-check → unit tests → build → browser tests → parity report → **deploy only if all passed**.
A pull request runs the same checks but never deploys.

## How the tests protect you

* **Golden tests** (`tests/unit/golden.test.ts`): `tests/fixtures/golden.json` holds outputs recorded from the *classic* app at a frozen clock
  (goal %, pace, forecast, outlook, 24 assistant replies word-for-word, quick-add parsing, search). If a change alters behaviour, a test fails.
  Re-record only when you *intend* to change behaviour: `node scripts/capture-golden.cjs`.
* **Logic tests**: validation, undo, repeat to-dos, corrupt/partial storage, unknown fields preserved, backup round-trip, XSS escaping.
* **Layout tests** (`tests/e2e/app.spec.ts`): no header button overlaps another or the title, no sideways scroll, long names don't overflow, at 8 widths in light and dark.
* **Responsive sweep** (`tests/e2e/responsive.spec.ts`, rules in `tests/e2e/layout.ts`): opens 24 screens (every tab, sheet, dialog, goal form, year-end review, the Money app inside its frame, and disclosure sections opened) at 16 viewports from 320 px phones to 2560 px monitors, plus landscape phones, tablets and 200% zoom. Each screen must not scroll sideways, keep every element on screen, avoid overlapping text or controls, cut no text off, and fit or scroll its sheet. Floating buttons and snackbars are allowed to sit over content.
* **Offline**: the e2e suite fails if any request leaves the app's own origin, and reloads the app with the network off.

## Online data analyst (optional)

Assistant sheet → ⚙. Paste your own Anthropic API key and switch it on. With internet it answers like an analyst: it calls read-only tools that run **on your device**
(goals, to-dos, Money summaries/records, exact arithmetic, charts) and writes the answer from those numbers. Without internet, without a key, or when the service errors, the
offline assistant answers instead. Commands that change data ("add…", "delete…") always go to the offline assistant, which asks first and can undo.

* **Sent:** your question and the goal / to-do / Money figures a tool returns (Money notes are never included).
* **Never sent:** the Vault, passwords, backups. No tool can write anything (tested).
* The key is stored only in this browser (`tracker.ai.v1`), not in your data or backups. Calls go straight from the browser to `api.anthropic.com`; you pay your own usage.
* Tests mock the API (`tests/unit/online.test.ts`, `tests/e2e/analyst.spec.ts`). A live call with a real key is the one thing CI cannot check: use **Test** in the settings panel once.

## Layout

```
src/domain/     pure logic (goals, to-dos, outlook, search, backup)  ← unit-tested
src/assistant/  offline engine + online analyst (online.ts)             ← unit-tested
src/storage/    localStorage store + Money helpers
src/ui/         React screens
public/         money.html (Money module, same-origin iframe), sw.js, icons, manifest
legacy/         copy of the classic index.html used for parity/golden recording
```

## GitHub Pages setup (one time)

The deploy job copies `dist/` into the **`next/`** folder of the branch your Pages site is served from (default `gh-pages`;
set the repo variable `PAGES_BRANCH` if you serve from another branch, e.g. `main`). `keep_files: true` leaves the classic app's files alone.
The classic app keeps working at `/tracker/`; the React app appears at `/tracker/next/`.
See `PARITY.md` for what is still pending before the React app can replace the classic one.

## Goals area (full parity)
Goal detail and edit form, logs, milestones, habits, recurring entries, dependencies, focus years, Yearly / Timeline / Trends / Outlook, year-end review, plan handover, archive, categories and plans, Excel/CSV import-export for goals, to-dos and the Vault, old master-password Vault import, "where you were" restore, Back-gesture guard, update check and home-screen shortcuts. Logic lives in `src/domain/goalOps.ts` (unit-tested); screens in `src/ui/Goals*.tsx`, `GoalSheets.tsx`, `Settings.tsx`. Excel needs internet once to load the SheetJS reader; CSV always works offline.
