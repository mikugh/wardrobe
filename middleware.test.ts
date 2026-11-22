import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COOKIE, checkAccess, readAccessKey, sameKey } from './access-key.js'
import middleware, { config } from './middleware'

const KEY = 'test-key-AbC_123-xyz'
const req = (path: string, { cookie, accept }: { cookie?: string; accept?: string } = {}) =>
  new Request(`https://wardrobe.example${path}`, {
    headers: { ...(cookie ? { cookie } : {}), ...(accept ? { accept } : {}) },
  })
const HTML = 'text/html,application/xhtml+xml'

// next() marks "continue to the app" with this header.
const passes = (res: Response) => res.headers.get('x-middleware-next') === '1'

describe('access key lock (Vercel middleware)', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = KEY
  })
  afterEach(() => {
    delete process.env.APP_ACCESS_KEY
  })

  it('answers 401 with a plain page when there is no key', async () => {
    const res = middleware(req('/', { accept: HTML }))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('Ask the person who runs this for your personal link.')
  })

  it('answers 401 with JSON for an API route when there is no key', async () => {
    const res = middleware(req('/api/items'))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
  })

  it('answers 401 to a wrong key, in the address or the cookie', () => {
    expect(middleware(req('/?key=nope', { accept: HTML })).status).toBe(401)
    expect(middleware(req(`/?key=${KEY}x`, { accept: HTML })).status).toBe(401)
    expect(middleware(req('/', { cookie: `${COOKIE}=nope` })).status).toBe(401)
  })

  it('stores the right key in an HttpOnly cookie and redirects to the address without it', () => {
    const res = middleware(req(`/outfits?tab=2&key=${KEY}`, { accept: HTML }))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/outfits?tab=2')
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${COOKIE}=${encodeURIComponent(KEY)}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`)
    expect(cookie).toContain('Secure')
  })

  it('lets a page and an API route through with the cookie', () => {
    const cookie = `other=1; ${COOKIE}=${encodeURIComponent(KEY)}`
    expect(passes(middleware(req('/', { cookie, accept: HTML })))).toBe(true)
    expect(passes(middleware(req('/api/items', { cookie })))).toBe(true)
  })

  it('serves the manifest with the key in start_url, so the home-screen app gets in', async () => {
    const res = middleware(req('/manifest.json', { cookie: `${COOKIE}=${encodeURIComponent(KEY)}` }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.start_url).toBe(`./?key=${encodeURIComponent(KEY)}`)
    expect(body.name).toBe('Wardrobe')
  })

  it('checks every path except the app icon', () => {
    const matches = (p: string) => new RegExp(`^${config.matcher}$`).test(p)
    for (const p of ['/', '/index.html', '/manifest.json', '/assets/index-abc.js', '/api/items']) expect(matches(p)).toBe(true)
    expect(matches('/icon.svg')).toBe(false)
  })
})

describe('access key lock (shared logic)', () => {
  it('lets only the app icon through without the key', () => {
    expect(checkAccess({ url: 'https://wardrobe.example/icon.svg', headers: {} }, KEY)).toEqual({ action: 'pass' })
    expect(checkAccess({ url: 'https://wardrobe.example/icon.svg.js', headers: {} }, KEY).action).toBe('deny')
  })

  it('leaves the app unlocked when no key is configured', () => {
    expect(checkAccess({ url: 'http://localhost:5180/', headers: {} }, null)).toEqual({ action: 'pass' })
  })

  it('leaves out Secure on plain http, and adds it behind an https proxy', () => {
    const plain = checkAccess({ url: `http://127.0.0.1:5180/?key=${KEY}`, headers: {} }, KEY)
    expect(plain).toMatchObject({ action: 'redirect', location: '/' })
    expect(plain.action === 'redirect' && plain.setCookie).not.toContain('Secure')
    const proxied = checkAccess({ url: `http://127.0.0.1:5180/?key=${KEY}`, headers: { 'x-forwarded-proto': 'https' } }, KEY)
    expect(proxied.action === 'redirect' && proxied.setCookie).toContain('Secure')
  })

  it('compares keys exactly', () => {
    expect(sameKey(KEY, KEY)).toBe(true)
    expect(sameKey(KEY.slice(0, -1), KEY)).toBe(false)
    expect(sameKey('', KEY)).toBe(false)
    expect(sameKey(null, KEY)).toBe(false)
  })

  it('reads the key from the env var first, then from the file', () => {
    const readFile = () => 'key-from-file\n'
    expect(readAccessKey({ env: { APP_ACCESS_KEY: 'key-from-env' }, readFile })).toBe('key-from-env')
    expect(readAccessKey({ env: {}, readFile })).toBe('key-from-file')
    expect(readAccessKey({ env: { APP_ACCESS_KEY: '  ' }, readFile })).toBe('key-from-file')
  })

  it('returns null, meaning unlocked, when neither is set', () => {
    const missing = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }
    expect(readAccessKey({ env: {}, readFile: missing })).toBeNull()
    expect(readAccessKey({ env: {}, readFile: () => '' })).toBeNull()
  })
})

// Vitest loads files through Vite, which handles JSON and other imports itself, so the tests above
// pass even when Node can't load the middleware. Vercel runs it in plain Node, so load it there too.
// (A JSON import without `with { type: 'json' }` once broke every request on Vercel this way.)
describe('middleware in plain Node, as Vercel runs it', () => {
  it('loads and answers a request without the key with 401', () => {
    const script = `
      const { default: middleware } = await import('./middleware.ts')
      const res = middleware(new Request('https://wardrobe.example/'))
      console.log('status=' + res.status)
    `
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      env: { ...process.env, APP_ACCESS_KEY: KEY },
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(run.stderr.split('\n').filter((l) => l && !/ExperimentalWarning|--trace-warnings/.test(l))).toEqual([])
    expect(run.stdout.trim()).toBe('status=401')
    expect(run.status).toBe(0)
  })
})
