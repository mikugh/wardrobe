import { useMemo, useState } from 'react'
import { CATEGORIES, COLORS, SEASONS, categoryInfo } from '../lib/constants'
import { costPerWear, daysSince, formatMoney, lastWorn, plural, today, wearCount } from '../lib/util'
import { useWardrobe } from '../store'
import type { Category, ClothingItem, Season } from '../types'
import { BagIcon, CameraIcon, ChevronDownIcon, HeartIcon, SearchIcon, WardrobeIcon, XIcon } from './icons'
import { ItemDetail } from './ItemDetail'
import { WardrobeSwitcher } from './WardrobeSwitcher'
import { Chip, ColorDot, EmptyState, ItemThumb, Spinner } from './ui'

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
          className="group -ml-2 flex min-h-11 max-w-full items-center gap-1.5 rounded-2xl px-2 text-left transition hover:bg-stone-900/[0.04]"
          onClick={() => setSwitching(true)}
          aria-label="Switch wardrobe"
        >
          {place?.kind === 'bag' && <BagIcon size={26} className="shrink-0 text-accent" />}
          <h1 className="truncate font-display text-[2.125rem] font-medium leading-[1.1] sm:text-[2.75rem]">
            {place?.name ?? 'All wardrobes'}
          </h1>
          <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900/[0.05] text-stone-500 transition group-hover:bg-stone-900/10 group-hover:text-ink">
            <ChevronDownIcon size={16} />
          </span>
        </button>
        {!loading && (
          <p className="num mt-1.5 text-[13px] text-stone-500">
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
        <EmptyState
          icon={place?.kind === 'bag' ? <BagIcon size={26} /> : <WardrobeIcon size={26} />}
          title={place?.kind === 'bag' ? 'This bag is empty' : 'This wardrobe is empty'}
        >
          {place?.kind === 'bag'
            ? 'Pack clothes into it from the Bags tab.'
            : 'Add clothes with the camera button, or move clothes here by editing them or unpacking a bag.'}
        </EmptyState>
      ) : (
        <>
          {sampleItems > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-accent-light/70 py-1 pl-4 pr-2 text-[13px] leading-snug text-accent-dark shadow-[inset_0_0_0_1px_rgb(180_88_58/0.14)]">
              <p className="min-w-[12rem] flex-1 py-2">
                These are sample clothes to try the app with. Add your own with the camera button.
              </p>
              <button
                className="-ml-3 inline-flex min-h-11 items-center rounded-full px-3 font-semibold underline decoration-accent/40 underline-offset-[3px] transition hover:bg-accent/10 hover:decoration-accent"
                onClick={confirmRemoveSamples}
              >
                Remove samples
              </button>
            </div>
          )}

          <div className="sticky top-0 z-20 -mx-4 mt-4 space-y-2.5 bg-paper/85 px-4 pb-3 pt-2 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6">
            <div className="relative">
              <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, brand, size, color…"
                className="field pl-11"
                aria-label="Search wardrobe"
              />
            </div>

            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>
                All <span className="text-[11px] opacity-50">{items.length}</span>
              </Chip>
              {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.label} <span className="text-[11px] opacity-50">{counts.get(c.id)}</span>
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
                className={`chip appearance-none ${season !== 'all' ? 'chip-on' : 'chip-off'}`}
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
                className="chip chip-off appearance-none"
                aria-label="Sort"
              >
                {sorts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {colorsInUse.length > 1 && (
                <div className="ml-1 flex items-center border-l border-line pl-2">
                  {colorsInUse.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColor(color === c.name ? null : c.name)}
                      aria-label={`Filter by ${c.name}`}
                      aria-pressed={color === c.name}
                      className="group flex h-11 w-9 shrink-0 items-center justify-center sm:h-9"
                    >
                      <span
                        className={`rounded-full p-[3px] transition duration-200 ${
                          color === c.name ? 'scale-110 ring-[1.5px] ring-ink' : 'ring-1 ring-transparent group-hover:ring-stone-300'
                        }`}
                      >
                        <ColorDot name={c.name} hex={c.hex} size={22} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={24} />}
              title="Nothing matches"
              className="py-12"
              actions={
                <button className="btn-ghost" onClick={resetFilters}>
                  <XIcon size={16} /> Clear filters
                </button>
              }
            >
              Try another search, or loosen the filters.
            </EmptyState>
          ) : (
            <>
              {filtersActive && (
                <p className="num -mt-1 mb-2 flex items-center text-xs text-stone-500">
                  Showing {visible.length} of {items.length}
                  <button className="ml-1 inline-flex min-h-11 items-center px-2 font-semibold text-accent hover:text-accent-dark" onClick={resetFilters}>
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
                      <section key={p.id} className="mb-10">
                        <button
                          className="mb-2 flex min-h-11 items-center gap-2.5 font-display text-[1.375rem] font-medium transition hover:text-accent"
                          onClick={() => setCurrentPlaceId(p.id)}
                        >
                          <span className="text-stone-400">{p.kind === 'bag' ? <BagIcon size={20} /> : <WardrobeIcon size={20} />}</span>
                          {p.name}
                          <span className="num rounded-full bg-stone-900/[0.05] px-2 py-0.5 font-sans text-xs font-medium tracking-normal text-stone-500">
                            {here.length}
                          </span>
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
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item, i) => (
        // Cards rise in one after another; the stagger is capped so long lists don't lag.
        <li key={item.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
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
    <button onClick={onOpen} className="group block w-full rounded-2xl text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-sand shadow-card transition duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-lift group-active:scale-[0.985]">
        <ItemThumb item={item} className="transition duration-500 ease-out group-hover:scale-[1.04]" />
        {item.sample && <SampleBadge />}
        {item.favorite && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-accent shadow-card backdrop-blur">
            <HeartIcon size={14} fill="currentColor" />
          </span>
        )}
        {wornToday && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-medium leading-none text-white backdrop-blur">
            Worn today
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 px-0.5">
        <ColorDot name={item.color} hex={item.colorHex} size={9} />
        <span className="truncate text-[14px] font-medium leading-snug">{item.name}</span>
      </div>
      <p className="num mt-0.5 truncate px-0.5 text-xs text-stone-500">
        {categoryInfo(item.category).singular}
        {item.trackWear && wearCount(item) > 0 && <> · worn {wearCount(item)}×</>}
        {perWear !== undefined && <> · {formatMoney(perWear, currency)}/wear</>}
      </p>
    </button>
  )
}

function SampleBadge() {
  return (
    <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-stone-500 shadow-card backdrop-blur">
      Sample
    </span>
  )
}

function EmptyWardrobe({ onAdd, onAddSamples }: { onAdd: () => void; onAddSamples: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  return (
    <EmptyState
      className="mt-10"
      art={
        // A fanned-out stack of swatches, like garments on a rail.
        <div className="relative mx-auto h-36 w-56" aria-hidden="true">
          {['#d8c3a5', '#1f2f5c', '#f4f4f2', '#7c4a2d', '#b4583a'].map((c, i) => (
            <div
              key={c}
              className="absolute bottom-0 left-1/2 h-32 w-24 origin-bottom"
              style={{
                transform: `translateX(-50%) translateX(${(i - 2) * 30}px) rotate(${(i - 2) * 7}deg)`,
                zIndex: 5 - Math.abs(i - 2),
              }}
            >
              <div
                className="h-full w-full animate-rise rounded-2xl shadow-lift"
                style={{ background: c, animationDelay: `${i * 60}ms` }}
              />
            </div>
          ))}
        </div>
      }
      title="Your wardrobe is empty"
      actions={
        <>
          <button className="btn-primary min-w-[14rem]" onClick={onAdd}>
            <CameraIcon size={18} /> Add your first item
          </button>
          <button
            className="btn-ghost min-w-[14rem]"
            disabled={adding}
            onClick={() => {
              setAdding(true)
              onAddSamples().finally(() => setAdding(false))
            }}
          >
            {adding ? 'Adding samples…' : 'Try with sample clothes'}
          </button>
        </>
      }
    >
      Photograph your clothes to build a catalog you can browse, filter and turn into outfits.
    </EmptyState>
  )
}
