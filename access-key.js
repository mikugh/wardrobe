// Access-key lock, shared by the Vercel middleware (middleware.ts) and the local server (serve.js).
//
// The key comes from the APP_ACCESS_KEY environment variable, or else from access_key.txt in the
// project root (git-ignored). With neither, the app is unlocked, so local development needs no key.
//
// A visit with ?key=<key> stores the key in an HttpOnly cookie and redirects to the same address
// without it. Later visits pass with the cookie. Everything else gets a 401.
//
// Plain JavaScript (ESM), so serve.js can import it without a build step.

import { createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const COOKIE = 'app_key'
export const ONE_YEAR = 60 * 60 * 24 * 365
// The app icon: phones fetch it for the home screen without the cookie. It's just the logo.
// There are no scheduled jobs, webhooks or other automated callers to exempt.
export const UNCHECKED_PATHS = ['/icon.svg']

const DEFAULT_FILE =fileURLToPath(new URL('./access_key.txt', import.meta.url))

/** The access key: the env var first, then the file. Null when neither is set (app unlocked). */
export function readAccessKey({ env = process.env, file = DEFAULT_FILE, readFile = readFileSync } = {}) {
  const fromEnv = env.APP_ACCESS_KEY?.trim()
  if (fromEnv) return fromEnv
  try {
    const fromFile = String(readFile(file, 'utf8')).trim()
    return fromFile || null
  } catch {
    return null
  }
}

/** Constant-time comparison. Hashing first gives equal lengths, so the length isn't leaked either. */
export function sameKey(given, key) {
  if (typeof given !== 'string' || typeof key !== 'string') return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(key).digest()
  return timingSafeEqual(a, b)
}

function cookieValue(cookieHeader, name) {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) {
      try {
        return decodeURIComponent(v.join('='))
      } catch {
        return null
      }
    }
  }
  return null
}

const wantsJson = (url, accept) =>
  url.pathname.startsWith('/api/') || (/application\/json/.test(accept ?? '') && !/text\/html/.test(accept ?? ''))

/**
 * Decides what to do with a request. `url` is the full request URL; `headers` needs `cookie`,
 * `accept` and, behind a TLS proxy, `x-forwarded-proto`.
 *
 * Returns one of:
 *   { action: 'pass' }
 *   { action: 'redirect', location, setCookie }
 *   { action: 'deny', json }
 */
export function checkAccess({ url, headers }, key) {
  if (!key) return { action: 'pass' }
  const u = new URL(url)
  if (UNCHECKED_PATHS.includes(u.pathname)) return { action: 'pass' }

  const given = u.searchParams.get('key')
  if (given !== null && sameKey(given, key)) {
    u.searchParams.delete('key')
    const https = u.protocol === 'https:' || headers['x-forwarded-proto'] === 'https'
    const setCookie = [
      `${COOKIE}=${encodeURIComponent(key)}`,
      `Max-Age=${ONE_YEAR}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      ...(https ? ['Secure'] : []),
    ].join('; ')
    return { action: 'redirect', location: u.pathname + u.search, setCookie }
  }

  if (sameKey(cookieValue(headers.cookie, COOKIE), key)) return { action: 'pass' }

  return { action: 'deny', json: wantsJson(u, headers.accept) }
}

/**
 * The web app manifest for someone who has the key: its start_url carries the key, so an app added
 * to the home screen gets in on first launch. Installed apps on iPhones keep their own cookies,
 * separate from Safari's, so the cookie from the browser doesn't reach them.
 */
export function manifestWithKey(manifest, key) {
  return key ? { ...manifest, start_url: `./?key=${encodeURIComponent(key)}` } : manifest
}

export const DENIED_TEXT = 'Ask the person who runs this for your personal link.'

export const DENIED_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Wardrobe</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f5;color:#1c1917;font:16px/1.5 system-ui,sans-serif}main{max-width:22rem;padding:1.5rem}</style>
</head><body><main><p>${DENIED_TEXT}</p></main></body></html>`

export const DENIED_JSON = JSON.stringify({ error: 'unauthorized', message: DENIED_TEXT })
