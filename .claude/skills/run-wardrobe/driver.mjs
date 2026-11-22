// Drives the wardrobe app in headless Chromium at phone size and saves screenshots.
//
//   node .claude/skills/run-wardrobe/driver.mjs [steps...] [--url URL] [--out DIR] [--key-file FILE]
//
// Steps (default: all of them, in this order):
//   wardrobe  outfits  choose-outfit  bags  settings  add
// Each step opens that screen, saves <n>-<step>.png in --out and closes any sheet it opened.
//
// --url       app address (default http://localhost:5173/, the dev server)
// --out       screenshot folder (default .claude/skills/run-wardrobe/shots/, git-ignored)
// --key-file  open the app once with ?key=<contents of FILE> first (needed for `npm run serve`
//             and the Vercel URL when access_key.txt / APP_ACCESS_KEY is set)
//
// Every run uses a fresh browser profile, so the app starts with its sample clothes.
// Exits 1 if any step fails or the page logs an error.

import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const url = opt('--url', 'http://localhost:5173/')
const out = opt('--out', fileURLToPath(new URL('./shots/', import.meta.url)))
const keyFile = opt('--key-file', null)
const ALL = ['wardrobe', 'outfits', 'choose-outfit', 'bags', 'settings', 'add']
const steps = args.length ? args : ALL
const unknown = steps.filter((s) => !ALL.includes(s))
if (unknown.length) {
  console.error(`Unknown step(s): ${unknown.join(', ')}. Steps: ${ALL.join(' ')}`)
  process.exit(2)
}
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

// The bottom tab bar. "Add clothes" is the round camera button in the middle.
const tab = (name) => page.locator('nav button, footer button, button').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).last()
const closeSheet = async () => {
  // Sheets (Settings, Add clothes) and the full-screen Choose outfit view close with Escape or ×.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

const actions = {
  wardrobe: async () => tab('Wardrobe').click(),
  outfits: async () => tab('Outfits').click(),
  'choose-outfit': async () => {
    await tab('Outfits').click()
    await page.getByRole('button', { name: /Choose outfit/ }).first().click()
    await page.getByText('Swipe each piece sideways').waitFor()
  },
  bags: async () => tab('Bags').click(),
  settings: async () => {
    await tab('Settings').click()
    await page.getByText('Settings & backup').waitFor()
  },
  add: async () => page.getByRole('button', { name: 'Add clothes' }).click(),
}
const after = {
  // Choose outfit covers the tab bar; its × is the first button in its header.
  'choose-outfit': async () =>
    page.getByRole('heading', { name: 'Choose outfit' }).locator('xpath=..').getByRole('button').first().click(),
  settings: closeSheet,
  add: closeSheet,
}

let failed = false
try {
  if (keyFile) {
    const key = readFileSync(keyFile, 'utf8').trim()
    const target = new URL(url)
    target.searchParams.set('key', key)
    const res = await page.goto(target.href)
    if (!res || res.status() >= 400) throw new Error(`key rejected: HTTP ${res?.status()}`)
  } else {
    const res = await page.goto(url)
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} from ${url} (locked? pass --key-file access_key.txt)`)
  }
  await tab('Wardrobe').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(800)

  for (const [i, step] of steps.entries()) {
    try {
      await actions[step]()
      await page.waitForTimeout(700)
      const file = `${out}${String(i + 1)}-${step}.png`
      await page.screenshot({ path: file })
      console.log(`ok   ${step} -> ${file}`)
      if (after[step]) await after[step]()
      await page.waitForTimeout(300)
    } catch (e) {
      failed = true
      console.log(`FAIL ${step}: ${e.message.split('\n')[0]}`)
      await page.screenshot({ path: `${out}${String(i + 1)}-${step}-FAILED.png` })
    }
  }
} catch (e) {
  failed = true
  console.log('FAIL load:', e.message.split('\n')[0])
}

console.log(errors.length ? 'Page errors:\n  ' + errors.join('\n  ') : 'Page errors: none')
await browser.close()
process.exit(failed || errors.length ? 1 : 0)
