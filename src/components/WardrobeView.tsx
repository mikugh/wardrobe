import { useMemo, useState } from 'react'
import { CATEGORIES, COLORS, SEASONS, categoryInfo } from '../lib/constants'
import { costPerWear, daysSince, formatMoney, lastWorn, plural, today, wearCount } from '../lib/util'
import { useWardrobe } from '../store'
import type { Category, ClothingItem, Season } from '../types'
import { BagIcon, CameraIcon, ChevronDownIcon, HeartIcon, SearchIcon, WardrobeIcon, XIcon } from './icons'
import { ItemDetail } from './ItemDetail'
import { WardrobeSwitcher } from './WardrobeSwitcher'
import { Chip, ColorDot, ItemThumb, Spinner } from './ui'

type SortKey = 'newest' | 'oldest' | 'most-worn' | 'least-worn' | 'cost-per-wear' | 'name'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'most-worn', label: 'Most worn' },
  { id: 'least-worn', label: 'Least worn' },
  { id: 'cost-per-wear', label: 'Highest cost per wear' },
  { id: 'name', label: 'Name A–Z' },
]
// Only offered when some piece tracks wear.
const WEAR_SORTS: SortKey[] = ['most-worn', 'least-worn', 'cost-per-wear']

/** Cost per wear, for pieces that track wear and have a price. */
const cpw = (i: ClothingItem) => (i.trackWear && i.price !== undefined ? costPerWear(i.price, wearCount(i)) : undefined)

// In the wear sorts, pieces that don't track wear (or have no price) go last.
const compare: Record<SortKey, (a: ClothingItem, b: ClothingItem) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  'most-worn': (a, b) =>
    (b.trackWear ? wearCount(b) : -1) - (a.trackWear ? wearCount(a) : -1) || b.createdAt - a.createdAt,
  'least-worn': (a, b) =>
    (a.trackWear ? wearCount(a) : Infinity) - (b.trackWear ? wearCount(b) : Infinity) || a.createdAt - b.createdAt,
  'cost-per-wear': (a, b) => (cpw(b) ?? -1) - (cpw(a) ?? -1) || b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name),
}

export function WardrobeView({ onAdd }: { onAdd: () => void }) {
  const {
    items: allItems,
    outfits,
    places,
    wardrobes,
    bags,
    currentPlaceId,
    setCurrentPlaceId,
    loading,
    error,
    addSamples,
    removeSamples,
  } = useWardrobe()
  const [switching, setSwitching] = useState(false)
  const place = places.find((p) => p.id === currentPlaceId)
  const items = useMemo(
    () => (currentPlaceId === 'all' ? allItems : allItems.filter((i) => i.placeId === currentPlaceId)),
    [allItems, currentPlaceId],
  )
  // Clothes from this wardrobe that are currently packed in a bag.
  const packedAway = place?.kind === 'wardrobe' ? allItems.filter((i) => i.packedFrom === place.id && i.placeId !== place.id).length : 0
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [season, setSeason] = useState<Season | 'all'>('all')
  const [color, setColor] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [chosenSort, setSort] = useState<SortKey>('newest')
  const [openId, setOpenId] = useState<string | null>(null)
  // Sorting by wear needs some pieces that track it.
  const sorts = items.some((i) => i.trackWear) ? SORTS : SORTS.filter((s) => !WEAR_SORTS.includes(s.id))
  const sort = sorts.some((s) => s.id === chosenSort) ? chosenSort : 'newest'

  const counts = useMemo(() => {
    const c = new Map<Category, number>()
    for (const i of items) c.set(i.category, (c.get(i.category) ?? 0) + 1)
    return c
  }, [items])

  const colorsInUse = useMemo(() => COLORS.filter((c) => items.some((i) => i.color === c.name)), [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((i) => category === 'all' || i.category === category)
      .filter((i) => season === 'all' || i.seasons.length === 0 || i.seasons.includes(season))
      .filter((i) => !color || i.color === color)
      .filter((i) => !favoritesOnly || i.favorite)
      .filter(
        (i) =>
          !q ||
          [i.name, i.brand, i.size ?? '', i.notes, i.color, categoryInfo(i.category).label].some((s) =>
            s.toLowerCase().includes(q),
          ),
      )
      .sort(compare[sort])
  }, [items, query, category, season, color, favoritesOnly, sort])

  // Among pieces that track wear: not worn in 2 months (or never, if added over 2 months ago).
  const forgotten = items.filter((i) => {
    if (!i.trackWear) return false
    const last = lastWorn(i.wornOn)
    return last ? daysSince(last) > 60 : Date.now() - i.createdAt > 60 * 86_400_000
  }).length

  const filtersActive = category !== 'all' || season !== 'all' || color || favoritesOnly || query

  const sampleItems = allItems.filter((i) => i.sample).length
  const sampleOutfits = outfits.filter((o) => o.sample).length

  const confirmRemoveSamples = async () => {
    const what = [plural(sampleItems, 'sample item'), sampleOutfits && plural(sampleOutfits, 'sample outfit')].filter(Boolean)
    if (!confirm(`Remove the ${what.join(' and ')}? Your own clothes stay.`)) return
    await removeSamples()
    resetFilters()
  }

  const resetFilters = () => {
    setQuery('')
    setCategory('all')
    setSeason('all')
    setColor(null)
    setFavoritesOnly(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header>
        <button
          className="-ml-1 flex max-w-full items-center gap-1.5 rounded-xl px-1 text-left transition hover:bg-stone-100"
          onClick={() => setSwitching(true)}
          aria-label="Switch wardrobe"
        >
          {place?.kind === 'bag' && <BagIcon size={26} className="shrink-0 text-accent" />}
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {place?.name ?? 'All wardrobes'}
          </h1>
          <ChevronDownIcon size={26} className="mt-1 shrink-0 text-stone-400" />
        </button>
        {!loading && (
          <p className="mt-1 text-sm text-stone-500">
            {plural(items.length, 'piece')}
            {packedAway > 0 && <> · {packedAway} packed in a bag</>}
            {forgotten > 0 && <> · {forgotten} not worn in 2 months</>}
          </p>
        )}
      </header>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : allItems.length === 0 ? (
        <EmptyWardrobe onAdd={onAdd} onAddSamples={addSamples} />
      ) : items.length === 0 ? (
        <div className="mx-auto mt-14 max-w-sm text-center text-stone-500">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-accent">
            {place?.kind === 'bag' ? <BagIcon size={28} /> : <WardrobeIcon size={28} />}
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold text-ink">
            {place?.kind === 'bag' ? 'This bag is empty' : 'This wardrobe is empty'}
          </h2>
          <p className="mt-2">
            {place?.kind === 'bag'
              ? 'Pack clothes into it from the Bags tab.'
              : 'Add clothes with the camera button, or move clothes here by editing them or unpacking a bag.'}
          </p>
        </div>
      ) : (
        <>
          {sampleItems > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-accent-light px-4 py-3 text-sm text-accent-dark">
              <p className="min-w-[12rem] flex-1">
                These are sample clothes to try the app with. Add your own with the camera button.
              </p>
              <button className="font-semibold underline underline-offset-2" onClick={confirmRemoveSamples}>
                Remove samples
              </button>
            </div>
          )}

          <div className="sticky top-0 z-20 -mx-4 mt-4 space-y-3 bg-paper/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="relative">
              <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, brand, size, color…"
                className="field pl-10"
                aria-label="Search wardrobe"
              />
            </div>

            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>
                All <span className="opacity-60">{items.length}</span>
              </Chip>
              {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.label} <span className="opacity-60">{counts.get(c.id)}</span>
                </Chip>
              ))}
            </div>

            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
                <HeartIcon size={14} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorites
              </Chip>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as Season | 'all')}
                className={`chip appearance-none pr-3.5 ${season !== 'all' ? 'chip-on' : 'chip-off'}`}
                aria-label="Filter by season"
              >
                <option value="all">Any season</option>
                {SEASONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="chip chip-off appearance-none pr-3.5"
                aria-label="Sort"
              >
                {sorts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {colorsInUse.length > 1 && (
                <div className="ml-1 flex items-center gap-1.5 border-l border-stone-200 pl-3">
                  {colorsInUse.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColor(color === c.name ? null : c.name)}
                      aria-label={`Filter by ${c.name}`}
                      aria-pressed={color === c.name}
                      className={`rounded-full p-0.5 transition ${color === c.name ? 'ring-2 ring-ink' : 'ring-1 ring-transparent hover:ring-stone-300'}`}
                    >
                      <ColorDot name={c.name} hex={c.hex} size={22} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="py-16 text-center text-stone-500">
              <p>Nothing matches these filters.</p>
              <button className="btn-ghost mt-4" onClick={resetFilters}>
                <XIcon size={16} /> Clear filters
              </button>
            </div>
          ) : (
            <>
              {filtersActive && (
                <p className="mb-3 text-xs text-stone-500">
                  Showing {visible.length} of {items.length}
                  <button className="ml-2 font-semibold text-accent" onClick={resetFilters}>
                    Clear
                  </button>
                </p>
              )}
              {currentPlaceId === 'all' ? (
                // Everything, grouped by where it is.
                [...wardrobes, ...bags].map((p) => {
                  const here = visible.filter((i) => i.placeId === p.id)
                  return (
                    here.length > 0 && (
                      <section key={p.id} className="mb-8">
                        <button
                          className="mb-3 flex items-center gap-2 font-display text-xl font-semibold hover:text-accent"
                          onClick={() => setCurrentPlaceId(p.id)}
                        >
                          {p.kind === 'bag' ? <BagIcon size={20} /> : <WardrobeIcon size={20} />}
                          {p.name}
                          <span className="font-sans text-sm font-normal text-stone-500">{here.length}</span>
                        </button>
                        <ItemGrid items={here} onOpen={setOpenId} />
                      </section>
                    )
                  )
                })
              ) : (
                <ItemGrid items={visible} onOpen={setOpenId} />
              )}
            </>
          )}
        </>
      )}

      {openId && <ItemDetail id={openId} onClose={() => setOpenId(null)} />}
      {switching && <WardrobeSwitcher onClose={() => setSwitching(false)} />}
    </div>
  )
}

function ItemGrid({ items, onOpen }: { items: ClothingItem[]; onOpen: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} onOpen={() => onOpen(item.id)} />
        </li>
      ))}
    </ul>
  )
}

function ItemCard({ item, onOpen }: { item: ClothingItem; onOpen: () => void }) {
  const { currency } = useWardrobe()
  const wornToday = item.trackWear && item.wornOn.includes(today())
  const perWear = cpw(item)
  return (
    <button onClick={onOpen} className="group block w-full text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5">
        <ItemThumb item={item} className="transition duration-300 group-hover:scale-[1.03]" />
        {item.sample && <SampleBadge />}
        {item.favorite && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-accent shadow-sm">
            <HeartIcon size={14} fill="currentColor" />
          </span>
        )}
        {wornToday && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">
            Worn today
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <ColorDot name={item.color} hex={item.colorHex} size={10} />
        <span className="truncate text-sm font-medium">{item.name}</span>
      </div>
      <p className="text-xs text-stone-500">
        {categoryInfo(item.category).singular}
        {item.trackWear && wearCount(item) > 0 && <> · worn {wearCount(item)}×</>}
        {perWear !== undefined && <> · {formatMoney(perWear, currency)}/wear</>}
      </p>
    </button>
  )
}

function SampleBadge() {
  return (
    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-stone-600 shadow-sm">
      Sample
    </span>
  )
}

function EmptyWardrobe({ onAdd, onAddSamples }: { onAdd: () => void; onAddSamples: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="mx-auto mt-10 max-w-sm text-center">
      <div className="mx-auto grid w-48 grid-cols-3 gap-2 opacity-70" aria-hidden="true">
        {['#d8c3a5', '#1f2f5c', '#f4f4f2', '#7c4a2d', '#b4583a', '#9ca3af'].map((c) => (
          <div key={c} className="aspect-[3/4] rounded-xl ring-1 ring-black/5" style={{ background: c }} />
        ))}
      </div>
      <h2 className="mt-8 font-display text-2xl font-semibold">Your wardrobe is empty</h2>
      <p className="mt-2 text-stone-500">
        Photograph your clothes to build a catalog you can browse, filter and turn into outfits.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button className="btn-primary" onClick={onAdd}>
          <CameraIcon size={18} /> Add your first item
        </button>
        <button
          className="btn-ghost"
          disabled={adding}
          onClick={() => {
            setAdding(true)
            onAddSamples().finally(() => setAdding(false))
          }}
        >
          {adding ? 'Adding samples…' : 'Try with sample clothes'}
        </button>
      </div>
    </div>
  )
}
