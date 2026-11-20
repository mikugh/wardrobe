import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { costPerWear, daysSince, describeLastWorn, fitsSeason, formatBytes, lastWorn, localDate, parsePrice, plural, wearCount } from './util'

describe('parsePrice', () => {
  it.each([
    ['49.90', 49.9],
    ['49,90', 49.9],
    ['49', 49],
    ['1 299', 1299],
    ['1 299 kr', 1299],
    ['499 kr', 499],
    ['1.299,50', 1299.5],
    ['1,299.50', 1299.5],
    ['1.299', 1299],
    ['€49', 49],
    ['49 EUR', 49],
    ["1'299.95", 1299.95],
    ['0,5', 0.5],
  ])('reads %j as %d', (text, expected) => {
    expect(parsePrice(text)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '45abc', 'kr', '-5'])('rejects %j', (text) => {
    expect(parsePrice(text)).toBeUndefined()
  })
})

describe('wear and cost per wear', () => {
  it('counts logged days plus earlier wears', () => {
    expect(wearCount({ wornOn: ['2026-01-01', '2026-01-05'], earlierWears: 3 })).toBe(5)
    expect(wearCount({ wornOn: [] })).toBe(0)
  })

  it('divides the price by wears, and shows the full price before the first wear', () => {
    expect(costPerWear(100, 4)).toBe(25)
    expect(costPerWear(100, 0)).toBe(100)
  })

  it('finds the most recent wear regardless of order', () => {
    expect(lastWorn(['2026-03-01', '2026-05-10', '2026-04-02'])).toBe('2026-05-10')
    expect(lastWorn([])).toBeNull()
  })
})

describe('dates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 20, 15, 30)) // 20 Nov 2026, local time
  })
  afterEach(() => vi.useRealTimers())

  it('formats local dates as YYYY-MM-DD', () => {
    expect(localDate()).toBe('2026-11-20')
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('counts whole days since a date', () => {
    expect(daysSince('2026-11-20')).toBe(0)
    expect(daysSince('2026-11-19')).toBe(1)
    expect(daysSince('2026-10-21')).toBe(30)
  })

  it('describes the last wear in words', () => {
    expect(describeLastWorn([])).toBe('Never worn')
    expect(describeLastWorn(['2026-11-20'])).toBe('Worn today')
    expect(describeLastWorn(['2026-11-19'])).toBe('Worn yesterday')
    expect(describeLastWorn(['2026-11-10'])).toBe('Worn 10 days ago')
    expect(describeLastWorn(['2026-01-02'])).toMatch(/^Last worn /)
  })
})

describe('small helpers', () => {
  it('treats an item without seasons as all-year', () => {
    expect(fitsSeason({ seasons: [] }, 'winter')).toBe(true)
    expect(fitsSeason({ seasons: ['summer'] }, 'winter')).toBe(false)
    expect(fitsSeason({ seasons: ['summer'] }, 'all')).toBe(true)
  })

  it('pluralizes', () => {
    expect(plural(1, 'piece')).toBe('1 piece')
    expect(plural(3, 'piece')).toBe('3 pieces')
    expect(plural(2, 'dress', 'dresses')).toBe('2 dresses')
  })

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(85 * 1024 ** 2)).toBe('85.0 MB')
  })
})
