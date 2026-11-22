---
name: run-wardrobe
description: Run, start, launch, drive, click through or screenshot the wardrobe app (Vite + React PWA) locally in headless Chromium at phone size - dev server or the built app behind the access-key lock (npm run serve). Use to see a UI change working, check a screen renders, or reproduce a bug in the real app.
---

# Run the wardrobe app

A mobile-first React app built with Vite. It has no backend: all data lives in the browser
(IndexedDB/localStorage), so a fresh browser profile always starts with the built-in **sample
clothes**. The agent path is `driver.mjs` in this folder: Playwright + headless Chromium at
390×844 (phone), one screenshot per screen, exit 1 on any failed step or page error.

All paths below are relative to the project root (`wardrobe/`). Commands are PowerShell (Windows).

## Prerequisites (once per `npm install`/`npm ci`)

Playwright is **not** a project dependency. Install it without touching `package.json`. 1.65.1
matches the Chromium build already downloaded on this machine (`%LOCALAPPDATA%\ms-playwright\chromium-1255`):

```powershell
npm install --no-save playwright@1.65.1
node -e "import('playwright').then(async ({chromium}) => { const b = await chromium.launch(); console.log('chromium', b.version()); await b.close() })"
```

The second line should print `chromium 159...`. `npm ci` / a fresh `npm install` removes Playwright again.

## Run (agent path)

1. Start the dev server in the background (Bash/PowerShell tool with `run_in_background`). It has
   **no access-key lock**:

   ```powershell
   npm run dev -- --port 5173 --strictPort
   ```

2. Drive it. With no steps, it visits every screen in order:

   ```powershell
   node .claude/skills/run-wardrobe/driver.mjs
   ```

   Output, one line per step, then page errors:

   ```
   ok   wardrobe -> ...\.claude\skills\run-wardrobe\shots\1-wardrobe.png
   ok   outfits -> ...\2-outfits.png
   ok   choose-outfit -> ...\3-choose-outfit.png
   ok   bags -> ...\4-bags.png
   ok   settings -> ...\5-settings.png
   ok   add -> ...\6-add.png
   Page errors: none
   ```

   **Open the PNGs with Read and look at them.** Steps: `wardrobe outfits choose-outfit bags settings add`.
   Pick any subset in any order. Each step closes the sheet or overlay it opened, so steps chain:

   ```powershell
   node .claude/skills/run-wardrobe/driver.mjs settings bags add outfits
   ```

   Options: `--url URL`, `--out DIR` (default `.claude/skills/run-wardrobe/shots/`, git-ignored),
   `--key-file FILE`. An unknown step exits 2 and lists the valid ones.

3. To reach a screen the driver doesn't cover, add an entry to `actions` (and `after`, if it opens a sheet)
   in `driver.mjs`, rather than writing a one-off script.

### The built app, behind the access-key lock

`serve.js` serves `dist/` and enforces the same lock as Vercel (`access-key.js`). It reads
`access_key.txt`, so locally it **is** locked:

```powershell
npm run build
$env:WARDROBE_PORT='5181'; node serve.js          # background
node .claude/skills/run-wardrobe/driver.mjs wardrobe choose-outfit --url http://127.0.0.1:5181/ --key-file access_key.txt
```

Without `--key-file` the driver fails with `HTTP 401 ... (locked? pass --key-file access_key.txt)`.
Never print the key, or put it in a command line or output; `--key-file` reads it from the file.

## Run (human path)

`npm run dev`, then open http://localhost:5173/. Stop with Ctrl+C.

## Test

```powershell
npm test
```

Vitest, 47 tests. `middleware.test.ts` also loads `middleware.ts` in plain Node, the way Vercel runs it.

## Gotchas

- **Two buttons are named "Wardrobe"** (the tab, plus the wardrobe switcher in the header).
  `getByRole('button', { name: 'Wardrobe' })` throws a strict-mode violation. The driver's `tab()`
  matches the tab by its exact text and takes the last match.
- **Choose outfit is a full-screen view that covers the tab bar.** Clicking a tab while it's open
  times out with `<button ...>Wearing this today</button> ... intercepts pointer events`. Close it
  with the × (the first button in the heading's parent). Settings and Add clothes are bottom sheets
  that close with Escape.
- **The counts look inconsistent but aren't:** the Wardrobe tab says "6 pieces" (the "Home"
  wardrobe), and Settings says "8 items" (all wardrobes; 2 samples are in "Summer cottage").
- **Vitest runs through Vite, which loads JSON and TypeScript files itself.** Tests can pass while the
  Vercel middleware fails to load in plain Node (this happened: a JSON import without
  `with { type: 'json' }` gave `MIDDLEWARE_INVOCATION_FAILED` on every request). If you
  change `middleware.ts` or `access-key.js`, the plain-Node test in `middleware.test.ts` is the one that counts.
- **The dev server is never locked**; `serve.js` and Vercel are. A 401 on 5181 means the lock works.
- The user's real clothes are only in their own browser. The driver only ever sees the sample data.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find package 'playwright'` | Run the Prerequisites install again (`npm ci` removed it). |
| `FAIL load: HTTP 401 from ...` | The server is locked: add `--key-file access_key.txt`. |
| `strict mode violation: getByRole('button', { name: 'Wardrobe' }) resolved to 2 elements` | Use `tab('Wardrobe')` in the driver, not `getByRole`. |
| A tab click times out, `Wearing this today ... intercepts pointer events` | Choose outfit is still open: close it first (`after['choose-outfit']`). |
