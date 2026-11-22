// Types for access-key.js, which stays plain JavaScript so serve.js can import it without a build
// step. Vercel type-checks middleware.ts strictly when it bundles it, and without this file it
// reports TS7016 ("implicitly has an 'any' type") in the build log.

export const COOKIE: string
export const ONE_YEAR: number
export const UNCHECKED_PATHS: string[]

export function readAccessKey(options?: {
  env?: Record<string, string | undefined>
  file?: string
  readFile?: (file: string, encoding: 'utf8') => string | Buffer
}): string | null

export function sameKey(given: unknown, key: unknown): boolean

export type AccessDecision =
  | { action: 'pass' }
  | { action: 'redirect'; location: string; setCookie: string }
  | { action: 'deny'; json: boolean }

export function checkAccess(
  request: {
    url: string
    headers: { cookie?: string; accept?: string; 'x-forwarded-proto'?: string }
  },
  key: string | null,
): AccessDecision

export function manifestWithKey<T extends object>(manifest: T, key: string | null): T & { start_url?: string }

export const DENIED_TEXT: string
export const DENIED_HTML: string
export const DENIED_JSON: string
