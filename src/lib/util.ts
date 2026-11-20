import type { ClothingItem, Season } from '../types'

// crypto.randomUUID is only available in secure contexts, and the dev server is
// often opened over plain http on a phone, so fall back to a random string.
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => localDate()

export function currentSeason(): Season {
  const m = new Date().getMonth()
  return m < 2 || m === 11 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'
}

export const fitsSeason = (item: Pick<ClothingItem, 'seasons'>, season: Season | 'all') =>
  season === 'all' || item.seasons.length === 0 || item.seasons.includes(season)

export function lastWorn(wornOn: string[]): string | null {
  return wornOn.length ? [...wornOn].sort().at(-1)! : null
}

export function daysSince(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, m - 1, d).getTime()
  const now = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  return Math.round((now - then) / 86_400_000)
}

export function describeLastWorn(wornOn: string[]): string {
  const last = lastWorn(wornOn)
  if (!last) return 'Never worn'
  const days = daysSince(last)
  if (days <= 0) return 'Worn today'
  if (days === 1) return 'Worn yesterday'
  if (days < 30) return `Worn ${days} days ago`
  const [y, m, d] = last.split('-').map(Number)
  return `Last worn ${new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/**
 * Reads a price typed by a person: "49.90", "49,90", "1 299", "1.299,50", "1,299.50", "€49" or
 * "499 kr". The last "." or "," followed by one or two digits is the decimal point; other
 * separators group thousands. Anything else (like "45abc") is invalid and gives undefined.
 */
export function parsePrice(text: string): number | undefined {
  // Drop currency symbols, a currency code or "kr" written as its own word, and spaces.
  const s = text
    .replace(/\p{Sc}/gu, '')
    .replace(/\b(kr|[a-z]{3})\b/gi, '')
    .replace(/[\s']/g, '')
  if (!/^[\d.,]*\d[\d.,]*$/.test(s)) return undefined
  const decimal = s.match(/[.,](\d{1,2})$/)
  const whole = (decimal ? s.slice(0, decimal.index) : s).replace(/[.,]/g, '')
  const n = Number(`${whole || '0'}.${decimal?.[1] ?? '0'}`)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

/** Times worn in total: the logged days plus earlier wears added by hand. */
export const wearCount = (item: Pick<ClothingItem, 'wornOn' | 'earlierWears'>) =>
  item.wornOn.length + (item.earlierWears ?? 0)

/** Price divided by times worn; the full price until it's been worn. */
export const costPerWear = (price: number, wears: number) => price / Math.max(1, wears)

// A sensible first guess for the currency, from the browser's region.
const REGION_CURRENCY: Record<string, string> = { US: 'USD', GB: 'GBP', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', CA: 'CAD', AU: 'AUD', JP: 'JPY', PL: 'PLN' }

export function defaultCurrency(): string {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
  const byLanguage: Record<string, string> = { sv: 'SEK', nb: 'NOK', no: 'NOK', da: 'DKK', ja: 'JPY', pl: 'PLN' }
  return REGION_CURRENCY[region] ?? byLanguage[navigator.language.split('-')[0]] ?? 'EUR'
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'CAD', 'AUD', 'JPY', 'PLN']

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
