import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as db from './lib/db'
import { defaultCurrency, newId, today } from './lib/util'
import type { ClothingItem, Outfit, Place } from './types'

/** The place being viewed: a wardrobe or bag id, or every place at once. */
export type PlaceSelection = string | 'all'

interface WardrobeApi {
  items: ClothingItem[]
  outfits: Outfit[]
  places: Place[]
  /** Oldest first; there is always at least one. */
  wardrobes: Place[]
  bags: Place[]
  currentPlaceId: PlaceSelection
  setCurrentPlaceId: (id: PlaceSelection) => void
  /** Currency code (e.g. "EUR") prices are in. */
  currency: string
  setCurrency: (code: string) => void
  loading: boolean
  error: string | null
  saveItem: (item: ClothingItem) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  toggleItemWornToday: (id: string) => Promise<void>
  /** Marks (or unmarks) several items as worn today, e.g. an outfit that wasn't saved. Only items that track wear are changed. */
  setItemsWornToday: (ids: string[], on: boolean) => Promise<void>
  saveOutfit: (outfit: Outfit) => Promise<void>
  deleteOutfit: (id: string) => Promise<void>
  toggleOutfitWornToday: (id: string) => Promise<void>
  savePlace: (place: Place) => Promise<void>
  /** Deletes a bag (its clothes go back where they came from) or an empty wardrobe. */
  deletePlace: (id: string) => Promise<void>
  /** Moves items into a bag, remembering which wardrobe each came from. */
  packItems: (bagId: string, ids: string[]) => Promise<void>
  /** Takes items out of a bag, into a wardrobe or back to where each was packed from. */
  unpackItems: (ids: string[], to: string | 'origin') => Promise<void>
  importData: (items: ClothingItem[], outfits: Outfit[], places: Place[]) => Promise<void>
  clearAll: () => Promise<void>
  addSamples: () => Promise<void>
  /** Deletes the sample clothes, outfits and wardrobes, and takes sample pieces out of the user's own outfits. */
  removeSamples: () => Promise<void>
}

const WardrobeContext = createContext<WardrobeApi | null>(null)

const SAMPLES_OFFERED_KEY = 'wardrobe:samples-offered'
const CURRENT_PLACE_KEY = 'wardrobe:current-place'
const CURRENCY_KEY = 'wardrobe:currency'
/** Wear tracking used to be one switch for everything; now each piece has its own. */
const OLD_TRACK_WEAR_KEY = 'wardrobe:track-wear'

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Only a convenience; fine to lose.
  }
}

function samplesOffered(): boolean {
  try {
    return localStorage.getItem(SAMPLES_OFFERED_KEY) === '1'
  } catch {
    return true // without storage we can't remember removing them, so don't add them on every visit
  }
}

const byAge = (a: Place, b: Place) => a.createdAt - b.createdAt
const firstWardrobe = (places: Place[]) => [...places].sort(byAge).find((p) => p.kind === 'wardrobe')

/**
 * Makes sure there's at least one wardrobe and that every item is in a place
 * that exists. Covers wardrobes from before there were several (they all go
 * into "Home"), backups from that time, and deleted places. Saves the fixes.
 */
async function ensureConsistent(items: ClothingItem[], places: Place[]): Promise<[ClothingItem[], Place[]]> {
  if (!firstWardrobe(places)) {
    const home: Place = { id: newId(), name: 'Home', kind: 'wardrobe', createdAt: Date.now() }
    await db.put('places', home)
    places = [...places, home]
  }
  const ids = new Set(places.map((p) => p.id))
  const fallback = firstWardrobe(places)!.id
  const fixed = items
    .filter((i) => !ids.has(i.placeId))
    .map((i) => ({ ...i, placeId: i.packedFrom && ids.has(i.packedFrom) ? i.packedFrom : fallback, packedFrom: undefined }))
  if (fixed.length) await db.putMany('items', fixed)
  return [fixed.reduce(upsert, items), places]
}

/** If the old all-clothes wear switch was on, turn tracking on for each piece, once. */
async function migrateWearSetting(items: ClothingItem[]): Promise<ClothingItem[]> {
  const old = readSetting(OLD_TRACK_WEAR_KEY)
  if (old === null) return items
  let updated = items
  if (old === '1') {
    updated = items.map((i) => (i.trackWear === undefined ? { ...i, trackWear: true } : i))
    await db.putMany('items', updated)
  }
  try {
    localStorage.removeItem(OLD_TRACK_WEAR_KEY)
  } catch {
    // Harmless: it would just run again.
  }
  return updated
}

async function createAndStoreSamples(wardrobeId: string) {
  const { createSamples } = await import('./lib/samples')
  const samples = await createSamples(wardrobeId)
  await db.putMany('places', samples.places)
  await db.putMany('items', samples.items)
  await db.putMany('outfits', samples.outfits)
  return samples
}

type Loaded = { items: ClothingItem[]; outfits: Outfit[]; places: Place[] }
let initialLoad: Promise<Loaded> | null = null

/**
 * Reads the wardrobe; on the very first visit, fills an empty wardrobe with
 * sample clothes. Shared, so React's double-run effects in dev can't add them twice.
 */
function loadInitial() {
  initialLoad ??= (async (): Promise<Loaded> => {
    const [storedItems, outfits, storedPlaces] = await Promise.all([
      db.getAll<ClothingItem>('items'),
      db.getAll<Outfit>('outfits'),
      db.getAll<Place>('places'),
    ])
    let [items, places] = await ensureConsistent(storedItems, storedPlaces)
    items = await migrateWearSetting(items)
    if (items.length || outfits.length || samplesOffered()) return { items, outfits, places }
    try {
      localStorage.setItem(SAMPLES_OFFERED_KEY, '1')
      const samples = await createAndStoreSamples(firstWardrobe(places)!.id)
      return { items: samples.items, outfits: samples.outfits, places: [...places, ...samples.places] }
    } catch {
      return { items, outfits, places } // samples are a nicety; never block the app on them
    }
  })()
  return initialLoad
}

function upsert<T extends { id: string }>(list: T[], value: T): T[] {
  const i = list.findIndex((x) => x.id === value.id)
  if (i === -1) return [...list, value]
  const next = list.slice()
  next[i] = value
  return next
}

function toggleToday(wornOn: string[], on: boolean): string[] {
  const t = today()
  const without = wornOn.filter((d) => d !== t)
  return on ? [...without, t] : without
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [storedPlaceId, setStoredPlaceId] = useState(() => readSetting(CURRENT_PLACE_KEY) ?? '')
  const [currency, setCurrencyState] = useState(() => readSetting(CURRENCY_KEY) ?? defaultCurrency())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInitial()
      .then((data) => {
        setItems(data.items)
        setOutfits(data.outfits)
        setPlaces(data.places)
      })
      .catch((e) => setError(`Could not open the wardrobe database: ${e}`))
      .finally(() => setLoading(false))
    // Ask the browser not to evict the photos when storage runs low.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const sorted = [...places].sort(byAge)
  const wardrobes = sorted.filter((p) => p.kind === 'wardrobe')
  const bags = sorted.filter((p) => p.kind === 'bag')
  const isWardrobe = (id: string | undefined) => wardrobes.some((w) => w.id === id)

  // Fall back to the first wardrobe when the remembered place is gone.
  const currentPlaceId: PlaceSelection =
    storedPlaceId === 'all' || places.some((p) => p.id === storedPlaceId) ? storedPlaceId : (wardrobes[0]?.id ?? 'all')

  const setCurrentPlaceId = (id: PlaceSelection) => {
    setStoredPlaceId(id)
    writeSetting(CURRENT_PLACE_KEY, id)
  }

  const setCurrency = (code: string) => {
    setCurrencyState(code)
    writeSetting(CURRENCY_KEY, code)
  }

  const saveItem = async (item: ClothingItem) => {
    await db.put('items', item)
    setItems((prev) => upsert(prev, item))
  }

  const saveItems = async (updated: ClothingItem[]) => {
    await db.putMany('items', updated)
    setItems((prev) => updated.reduce(upsert, prev))
  }

  const saveOutfit = async (outfit: Outfit) => {
    await db.put('outfits', outfit)
    setOutfits((prev) => upsert(prev, outfit))
  }

  const deleteOutfit = async (id: string) => {
    await db.remove('outfits', id)
    setOutfits((prev) => prev.filter((o) => o.id !== id))
  }

  const deleteItem = async (id: string) => {
    await db.remove('items', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    // Drop the item from outfits; an outfit left with no items is removed.
    for (const o of outfits.filter((o) => o.itemIds.includes(id))) {
      const itemIds = o.itemIds.filter((x) => x !== id)
      if (itemIds.length) await saveOutfit({ ...o, itemIds })
      else await deleteOutfit(o.id)
    }
  }

  const toggleItemWornToday = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await saveItem({ ...item, wornOn: toggleToday(item.wornOn, !item.wornOn.includes(today())) })
  }

  const setItemsWornToday = (ids: string[], on: boolean) =>
    saveItems(
      items.filter((i) => ids.includes(i.id) && i.trackWear).map((i) => ({ ...i, wornOn: toggleToday(i.wornOn, on) })),
    )

  const toggleOutfitWornToday = async (id: string) => {
    const outfit = outfits.find((o) => o.id === id)
    if (!outfit) return
    const on = !outfit.wornOn.includes(today())
    await saveOutfit({ ...outfit, wornOn: toggleToday(outfit.wornOn, on) })
    await setItemsWornToday(outfit.itemIds, on)
  }

  const savePlace = async (place: Place) => {
    await db.put('places', place)
    setPlaces((prev) => upsert(prev, place))
  }

  const packItems = (bagId: string, ids: string[]) =>
    saveItems(
      items
        .filter((i) => ids.includes(i.id) && i.placeId !== bagId)
        // Moving between bags keeps the wardrobe it originally came from.
        .map((i) => ({ ...i, placeId: bagId, packedFrom: isWardrobe(i.placeId) ? i.placeId : i.packedFrom })),
    )

  const unpackItems = (ids: string[], to: string | 'origin') =>
    saveItems(
      items
        .filter((i) => ids.includes(i.id))
        .map((i) => ({
          ...i,
          placeId: to !== 'origin' ? to : isWardrobe(i.packedFrom) ? i.packedFrom! : wardrobes[0].id,
          packedFrom: undefined,
        })),
    )

  const deletePlace = async (id: string) => {
    const place = places.find((p) => p.id === id)
    if (!place) return
    const inside = items.filter((i) => i.placeId === id)
    if (place.kind === 'bag') await unpackItems(inside.map((i) => i.id), 'origin')
    else if (inside.length) throw new Error('Move or delete the clothes in this wardrobe first.')
    else if (wardrobes.length <= 1) throw new Error('You need at least one wardrobe.')
    await db.remove('places', id)
    setPlaces((prev) => prev.filter((p) => p.id !== id))
  }

  const importData = async (newItems: ClothingItem[], newOutfits: Outfit[], newPlaces: Place[]) => {
    // Restoring onto a fresh install: the backup's wardrobes replace the empty "Home" made at startup.
    const blank =
      newPlaces.some((p) => p.kind === 'wardrobe') && places.length === 1 && !items.length ? places[0].id : null
    if (blank) await db.remove('places', blank)
    await db.putMany('places', newPlaces)
    await db.putMany('items', newItems)
    await db.putMany('outfits', newOutfits)
    const [fixedItems, fixedPlaces] = await ensureConsistent(
      newItems.reduce(upsert, items),
      newPlaces.reduce(upsert, places.filter((p) => p.id !== blank)),
    )
    setItems(fixedItems)
    setPlaces(fixedPlaces)
    setOutfits((prev) => newOutfits.reduce(upsert, prev))
  }

  const clearAll = async () => {
    await Promise.all([db.clear('items'), db.clear('outfits'), db.clear('places')])
    const [, freshPlaces] = await ensureConsistent([], [])
    setItems([])
    setOutfits([])
    setPlaces(freshPlaces)
  }

  const addSamples = async () => {
    const samples = await createAndStoreSamples(isWardrobe(currentPlaceId) ? currentPlaceId : wardrobes[0].id)
    setPlaces((prev) => samples.places.reduce(upsert, prev))
    setItems((prev) => samples.items.reduce(upsert, prev))
    setOutfits((prev) => samples.outfits.reduce(upsert, prev))
  }

  const removeSamples = async () => {
    const sampleIds = new Set(items.filter((i) => i.sample).map((i) => i.id))
    const dropped: string[] = []
    const trimmed: Outfit[] = []
    for (const o of outfits) {
      const itemIds = o.itemIds.filter((id) => !sampleIds.has(id))
      if (o.sample || !itemIds.length) dropped.push(o.id)
      else if (itemIds.length < o.itemIds.length) trimmed.push({ ...o, itemIds })
    }
    // Sample wardrobes go too, unless the user has put their own clothes in them.
    const remaining = items.filter((i) => !sampleIds.has(i.id))
    const droppedPlaces = places.filter((p) => p.sample && !remaining.some((i) => i.placeId === p.id)).map((p) => p.id)
    await db.removeMany('items', [...sampleIds])
    await db.removeMany('outfits', dropped)
    await db.putMany('outfits', trimmed)
    await db.removeMany('places', droppedPlaces)
    const [fixedItems, fixedPlaces] = await ensureConsistent(
      remaining,
      places.filter((p) => !droppedPlaces.includes(p.id)),
    )
    setItems(fixedItems)
    setPlaces(fixedPlaces)
    setOutfits((prev) => trimmed.reduce(upsert, prev.filter((o) => !dropped.includes(o.id))))
  }

  return (
    <WardrobeContext.Provider
      value={{
        items,
        outfits,
        places,
        wardrobes,
        bags,
        currentPlaceId,
        setCurrentPlaceId,
        currency,
        setCurrency,
        loading,
        error,
        saveItem,
        deleteItem,
        toggleItemWornToday,
        setItemsWornToday,
        saveOutfit,
        deleteOutfit,
        toggleOutfitWornToday,
        savePlace,
        deletePlace,
        packItems,
        unpackItems,
        importData,
        clearAll,
        addSamples,
        removeSamples,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  )
}

export function useWardrobe(): WardrobeApi {
  const ctx = useContext(WardrobeContext)
  if (!ctx) throw new Error('useWardrobe must be used inside <WardrobeProvider>')
  return ctx
}
