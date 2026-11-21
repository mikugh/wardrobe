import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import middleware, { COOKIE, config } from './middleware'

const KEY = 'test-key-123'
const req = (path: string, cookie?: string) =>
  new Request(`https://wardrobe.example${path}`, { headers: cookie ? { cookie } : {} })

// next() marks "continue to the app" with this header.
const passes = (res: Response) => res.headers.get('x-middleware-next') === '1'

describe('access key middleware', () => {
  beforeEach(() => {
    process.env.WARDROBE_ACCESS_KEY = KEY
  })
  afterEach(() => {
    delete process.env.WARDROBE_ACCESS_KEY
  })

  it('refuses visitors without the key', async () => {
    const res = middleware(req('/'))
    expect(res.status).toBe(401)
    expect(passes(res)).toBe(false)
    expect(await res.text()).toContain('Private wardrobe')
  })

  it('refuses a wrong key, in the address or the cookie', () => {
    expect(middleware(req('/?key=nope')).status).toBe(401)
    expect(middleware(req('/', `${COOKIE}=nope`)).status).toBe(401)
    expect(middleware(req('/?key=test-key-12')).status).toBe(401)
  })

  it('lets the key in the address through and remembers it in a cookie', () => {
    const res = middleware(req(`/?key=${KEY}`))
    expect(passes(res)).toBe(true)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${COOKIE}=${KEY}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('lets a visitor with the cookie through', () => {
    expect(passes(middleware(req('/', `other=1; ${COOKIE}=${KEY}`)))).toBe(true)
  })

  it('refuses everyone when no key is configured', () => {
    delete process.env.WARDROBE_ACCESS_KEY
    expect(middleware(req('/?key=')).status).toBe(401)
    expect(middleware(req('/?key=anything')).status).toBe(401)
  })

  it('serves the manifest with the key in start_url, so the installed app gets in', async () => {
    const res = middleware(req('/manifest.json', `${COOKIE}=${KEY}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('manifest+json')
    const body = await res.json()
    expect(body.start_url).toBe(`./?key=${KEY}`)
    expect(body.name).toBe('Wardrobe')
  })

  it('does not run on built assets or the icon', () => {
    const matches = (p: string) => new RegExp(`^${config.matcher}$`).test(p)
    expect(matches('/')).toBe(true)
    expect(matches('/manifest.json')).toBe(true)
    expect(matches('/assets/index-abc.js')).toBe(false)
    expect(matches('/icon.svg')).toBe(false)
  })
})
