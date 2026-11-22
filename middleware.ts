// Vercel Routing Middleware: the access-key lock for the deployed app. The logic lives in
// access-key.js, which serve.js uses too. On Vercel the key comes from the APP_ACCESS_KEY
// environment variable (access_key.txt is git-ignored, so it isn't deployed).
//
// Runs only on Vercel: `npm run dev` is not affected.

import { next } from '@vercel/functions'
import { DENIED_HTML, DENIED_JSON, checkAccess, manifestWithKey, readAccessKey } from './access-key.js'
// Vercel runs this as a native ES module, and Node only imports JSON with this attribute.
import manifest from './public/manifest.json' with { type: 'json' }

export const config = {
  runtime: 'nodejs',
  // Every request, except the app icon: phones and browsers fetch it for the home screen without
  // the link or the cookie. It's the only path not checked, and it's just the logo.
  matcher: '/((?!icon\\.svg).*)',
}

export default function middleware(request: Request): Response {
  const key = readAccessKey()
  const decision = checkAccess(
    {
      url: request.url,
      headers: {
        cookie: request.headers.get('cookie') ?? undefined,
        accept: request.headers.get('accept') ?? undefined,
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') ?? undefined,
      },
    },
    key,
  )

  if (decision.action === 'redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: decision.location, 'Set-Cookie': decision.setCookie, 'Cache-Control': 'no-store' },
    })
  }

  if (decision.action === 'deny') {
    return new Response(decision.json ? DENIED_JSON : DENIED_HTML, {
      status: 401,
      headers: {
        'Content-Type': decision.json ? 'application/json' : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  }

  if (key && new URL(request.url).pathname.endsWith('/manifest.json')) {
    return Response.json(manifestWithKey(manifest, key), {
      headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-store' },
    })
  }

  return next()
}
