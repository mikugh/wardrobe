// Vercel Routing Middleware: only people with the access key can open the app.
//
// Open the app once as https://<host>/?key=<WARDROBE_ACCESS_KEY>. The key is then kept in a cookie,
// so later visits work without it. The key stays in the address too, so "Add to Home Screen" saves
// a link that works; installed apps on iPhones keep their own cookies, separate from Safari's.
//
// The key is set as the WARDROBE_ACCESS_KEY environment variable in the Vercel project. Without it,
// every request is refused, so the app is never open by mistake.
//
// Runs only on Vercel: `npm run dev` and `npm run serve` are not affected.

import { timingSafeEqual } from 'node:crypto'
import { next } from '@vercel/functions'
import manifest from './public/manifest.json'

export const config = {
  runtime: 'nodejs',
  // Built JS/CSS/fonts/wasm and the icon are code that's public on GitHub anyway; skipping them saves
  // invocations, and the icon must load for home-screen installs, which don't always send cookies.
  matcher: '/((?!assets/|icon\\.svg).*)',
}

export const COOKIE = 'wardrobe_key'
const ONE_YEAR = 60 * 60 * 24 * 365

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export default function middleware(request: Request): Response {
  const key = process.env.WARDROBE_ACCESS_KEY
  const url = new URL(request.url)
  const fromUrl = url.searchParams.get('key')
  const fromCookie = cookieValue(request, COOKIE)

  if (!key || !(fromUrl && sameKey(fromUrl, key)) && !(fromCookie && sameKey(fromCookie, key))) {
    return denied()
  }

  // Remember the key, so visits without it in the address still work.
  const headers: HeadersInit = {
    'Set-Cookie': `${COOKIE}=${encodeURIComponent(key)}; Max-Age=${ONE_YEAR}; Path=/; Secure; HttpOnly; SameSite=Lax`,
  }

  // The installed app opens the manifest's start_url; give it the key so it gets in on first launch.
  if (url.pathname.endsWith('/manifest.json')) {
    return Response.json(
      { ...manifest, start_url: `./?key=${encodeURIComponent(key)}` },
      { headers: { ...headers, 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-store' } },
    )
  }

  return next({ headers })
}

function denied(): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wardrobe</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f5;color:#1c1917;font:16px/1.5 system-ui,sans-serif}
main{max-width:22rem;padding:1.5rem}h1{font:600 1.75rem Georgia,serif;margin:0 0 .5rem}p{color:#57534e;margin:0}</style></head>
<body><main><h1>Private wardrobe</h1><p>This app needs a personal link to open. Ask the person who shared it with you for the link.</p></main></body></html>`
  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
