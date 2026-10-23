# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fiamma: an Android PWA for writing intervention reports ("rapporti di intervento") for boiler / heat-pump / air-conditioner technicians, with Testo 330 combustion-analyzer measurements read from the analyzer's QR code. It is a **static site**: no server, no build step, no `npm`. Data lives on the phone (IndexedDB + `localStorage`). `main` is deployed as-is by GitHub Pages, so `main` is the live app.

The UI, code comments, commit messages and all documentation are **in Italian**: write new ones in Italian, and reply to the user in Italian. Full documentation is in `docs/` (`docs/uso/` for users, `docs/sviluppo/` for developers); this file only covers what you need to be productive quickly.

## Commands

```
python3 -m http.server 8000                      # serve the app (http://localhost:8000; a secure context)
node --test                                      # all logic tests (tests/unit/*.test.mjs, ~1 s)
node --test tests/unit/model.test.mjs            # one file
node --test --test-name-pattern="chiusura" tests/unit/model.test.mjs   # one test, by name
tests/e2e/run.sh                                 # all browser tests (Playwright + Chromium, a few minutes)
tests/e2e/run.sh pdf units                       # some suites (names are listed in run.sh)
```

- `tests/e2e/run.sh` needs a global Playwright (the script sets `NODE_PATH` from `npm root -g`), Pillow, ffmpeg and poppler (`pdftotext`, `pdfinfo`, `pdftoppm`, `pdfimages`). Env vars: `OUT` (work dir, default `/tmp/testoqr-e2e`) and `PORT`. Screenshots and generated PDFs end up in `$OUT/shots5` and `$OUT/pdf5`.
- There is no linter or build. When moving code between modules there are no types to catch a missing `import`; ESLint with `no-undef` and `no-unused-vars` (throwaway config, nothing is committed) finds it fast.
- Before merging: `node --test` **and** the full `tests/e2e/run.sh`.

## Architecture (what spans several files)

- **Layers in `src/`**, each importing only from lower ones: `screens → backup / pdf / ui / data → model → qr / lib` (`app.js` boots everything). `model/`, `qr/tjf/` and `lib/` are pure logic (no DOM, no database) and are tested directly with Node. `tests/unit/layers.test.mjs` enforces the dependency order and that every relative `import` resolves.
- **A report is one JSON object** (`customer`, `plant.units[]`, `intervention`, `measures[]`, …; see `docs/sviluppo/03-modello-dati.md`). Anything read from outside (backup ZIP, the copy folder) must go through `normalizeReport` (`src/model/normalize.js`). A measure stores the **original TJF JSON** decoded from the QR; the table shown on screen and in the PDF is rebuilt with `buildReport` (`src/qr/tjf/`) every time.
- **Path of a change**: the editor (`src/screens/editor/session.js`: `touch()` → 400 ms debounce → `store.saveReport`) → `src/data/store.js` writes to IndexedDB and emits a `change` event → `src/backup/folder/index.js` listens, queues the id (the queue is persisted in IndexedDB) and ~2 s later `writer.js` writes `rapporto.json`, photos and (for closed reports) the PDF into the user's folder. Reacting to saves is done by listening to that event, never by calling the folder code from elsewhere.
- **PDF** (`src/pdf/`): `sheet.js` owns the vertical cursor `sheet.y` and the box helpers (`fieldsBox` with per-field `span` / `grow`, `textBox`); each part of the page (`header`, `parties`, `materials`, `measures`, `photos`, `footer`) draws through `sheet`, and `index.js` orders them. Always draw with `sheet.page` and `sheet.y`, never a stored `page`: it changes when a new page starts.
- **UI**: `index.html` holds **all** screens (`#view-<name>`) and the prefixed element ids the JS and the tests rely on. `src/ui/nav.js` (history API) shows a screen only after its `enter()` resolves; every screen exports `init` / `enter` / `leave`. Styling is Tailwind 4's *browser* build (no compile step): classes used **from JavaScript** must be declared in `src/ui/classes.js` (registered by `registerClasses`), otherwise they get no style. In the editor, `session.doc` is the open report: async functions compare the report they started with against `session.doc` before using their result.

## Rules that are easy to break

- **Service worker** (`sw.js`) is cache-first. After changing any app file, **bump `CACHE`** (`fiamma-vN`) and add new files to `FILES`; `tests/unit/sw.test.mjs` checks `FILES` coverage but *not* the version. Locally, enable "Bypass for network" in DevTools or you will see stale code. Changes to `docs/`, `README.md`, `CLAUDE.md` and `tests/` need neither.
- **Do not rename** the internal names `testoqr-reports` (IndexedDB), `testoqr.config`, `testoqr.scans` (`localStorage`): it would wipe every phone's data.
- **No migrations or compatibility code** for data from earlier versions: this is a deliberate decision of the user, do not add bridges.
- **No `innerHTML`**: build DOM with `el()` / `fieldElement()` (`src/ui/util.js`). Warnings (fiscal code, email) never block the user.
- **Docs are tested**: every file in `src/` must be named in `docs/sviluppo/02-struttura-del-codice.md` and every test in `docs/sviluppo/09-test.md`; `tests/unit/docs.test.mjs` also checks links, heading anchors and mermaid blocks. If behaviour changes, update the matching page in `docs/`.
- **Workflow**: one branch per change, run the tests, `git merge --ff-only` into `main`, `git push origin main` (GitHub Pages publishes). Commit messages in Italian.

## Testing notes

- `page.waitForFunction` does **not** await `async` predicates; use `until` from `tests/e2e/lib.cjs`. Every suite starts from `lib.cjs` (`start`, `finish`, `dialogs`, `errors`).
- E2E runs in the `Europe/Rome` time zone while the machine may be UTC: compute dates with `toLocaleDateString(..., { timeZone: 'Europe/Rome' })`.
- Call app code from a test with `page.evaluate(async () => (await import('/src/data/store.js'))...)`.
- The native folder picker cannot be automated: tests replace `showDirectoryPicker` with an OPFS directory and use `folder.testing.permission` to fake an expired permission.
- For a PDF layout change, compare pages (`pdftoppm -png`) and text (`pdftotext -layout`) against the previous version; a pure refactor must give identical pages.
