import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { currentSeason, fitsSeason, lastWorn, newId, today } from '../lib/util'
import { useWardrobe, type PlaceSelection } from '../store'
import type { ClothingItem, Outfit } from '../types'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ShuffleIcon, XIcon } from './icons'
import { bodyZone, OutfitCollage, type BodyZone } from './OutfitCollage'
import { MixedPlacesWarning, Piece, PieceList, ROW_HEIGHT, tracksWear } from './OutfitFigure'

/** A swipeable slot in the figure; each holds one piece (or none). */
type Lane = 'head' | 'outerwear' | 'top' | 'bottom' | 'dress' | 'shoes' | 'extras'
type Mode = 'separates' | 'dress'
type Picks = Record<Lane, string | null>

const LANES: Record<Lane, { zone: BodyZone; label: string; none: string; optional: boolean }> = {
  head: { zone: 'head', label: 'hat', none: 'No hat', optional: true },
  outerwear: { zone: 'upper', label: 'jacket', none: 'No jacket', optional: true },
  top: { zone: 'upper', label: 'top', none: 'No top', optional: false },
  bottom: { zone: 'legs', label: 'bottoms', none: 'No bottoms', optional: false },
  dress: { zone: 'dress', label: 'dress', none: 'No dress', optional: false },
  shoes: { zone: 'feet', label: 'shoes', none: 'No shoes', optional: false },
  extras: { zone: 'extras', label: 'accessory', none: 'No accessory', optional: true },
}

// Figure rows top to toe; lanes in the same row sit side by side. Accessories get a row of their own below.
const ROWS: Record<Mode, Lane[][]> = {
  separates: [['head'], ['outerwear', 'top'], ['bottom'], ['shoes']],
  dress: [['head'], ['outerwear'], ['dress'], ['shoes']],
}
const lanesOf = (mode: Mode): Lane[] => [...ROWS[mode].flat(), 'extras']

function laneOf(item: ClothingItem): Lane {
  switch (item.category) {
    case 'outerwear':
      return 'outerwear'
    case 'tops':
      return 'top'
    case 'bottoms':
      return 'bottom'
    case 'dresses':
      return 'dress'
    case 'shoes':
      return 'shoes'
    default:
      return bodyZone(item) === 'head' ? 'head' : 'extras'
  }
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

/**
 * Put an outfit together by swiping through alternatives for each part of the
 * body, or start from a saved outfit. The result can be saved or worn today.
 * Only clothes from one place are offered (you can only wear what's there),
 * by default the wardrobe or bag being viewed.
 */
export function OutfitPicker({ onClose }: { onClose: () => void }) {
  const { currentPlaceId } = useWardrobe()
  const [placeId, setPlaceId] = useState<PlaceSelection>(currentPlaceId)
  // A fresh start for each place, so no picks linger from somewhere else.
  return <Picker key={placeId} placeId={placeId} onPlaceChange={setPlaceId} onClose={onClose} />
}

function Picker({
  placeId,
  onPlaceChange,
  onClose,
}: {
  placeId: PlaceSelection
  onPlaceChange: (id: PlaceSelection) => void
  onClose: () => void
}) {
  const {
    items: allItems,
    outfits: allOutfits,
    wardrobes,
    bags,
    saveOutfit,
    toggleOutfitWornToday,
    setItemsWornToday,
  } = useWardrobe()
  const items = useMemo(
    () => (placeId === 'all' ? allItems : allItems.filter((i) => i.placeId === placeId)),
    [allItems, placeId],
  )
  // Only outfits that can be worn from here.
  const here = new Set(items.map((i) => i.id))
  const outfits = allOutfits.filter((o) => o.itemIds.every((id) => here.has(id)))
  const season = currentSeason()

  // Each lane's clothes: ones for this season first, then favorites, then newest.
  const byLane = useMemo(() => {
    const lanes = Object.fromEntries(Object.keys(LANES).map((l) => [l, [] as ClothingItem[]])) as Record<Lane, ClothingItem[]>
    for (const item of items) lanes[laneOf(item)].push(item)
    for (const list of Object.values(lanes))
      list.sort(
        (a, b) =>
          Number(fitsSeason(b, season)) - Number(fitsSeason(a, season)) ||
          Number(b.favorite) - Number(a.favorite) ||
          b.createdAt - a.createdAt,
      )
    return lanes
  }, [items, season])

  const hasSeparates = byLane.top.length + byLane.bottom.length > 0
  const hasDresses = byLane.dress.length > 0

  const [mode, setMode] = useState<Mode>(hasSeparates || !hasDresses ? 'separates' : 'dress')
  // Optional pieces start empty; the rest start with the first fitting piece.
  const [picks, setPicks] = useState<Picks>(
    () =>
      Object.fromEntries(
        (Object.keys(LANES) as Lane[]).map((l) => [l, LANES[l].optional ? null : (byLane[l][0]?.id ?? null)]),
      ) as Picks,
  )
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const selected = lanesOf(mode)
    .map((l) => (picks[l] ? byId.get(picks[l]!) : undefined))
    .filter((i): i is ClothingItem => !!i)
  const selectedIds = selected.map((i) => i.id)
  const match = selectedIds.length
    ? outfits.find((o) => o.itemIds.length === selectedIds.length && selectedIds.every((id) => o.itemIds.includes(id)))
    : undefined
  // Wear is logged only on pieces that track it.
  const trackWear = tracksWear(selected)
  const wornToday = match
    ? match.wornOn.includes(today())
    : trackWear && selected.filter((i) => i.trackWear).every((i) => i.wornOn.includes(today()))

  const setPick = (lane: Lane, id: string | null) => setPicks((p) => ({ ...p, [lane]: id }))

  const applyOutfit = (o: Outfit) => {
    const pieces = o.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i)
    const has = (lane: Lane) => pieces.some((i) => laneOf(i) === lane)
    setMode(has('dress') && !has('top') && !has('bottom') ? 'dress' : 'separates')
    setPicks(
      Object.fromEntries((Object.keys(LANES) as Lane[]).map((l) => [l, pieces.find((i) => laneOf(i) === l)?.id ?? null])) as Picks,
    )
  }

  const shuffle = () => {
    const cold = season === 'winter' || season === 'autumn'
    const chance: Partial<Record<Lane, number>> = { head: season === 'winter' ? 0.6 : 0.2, outerwear: cold ? 0.8 : 0.3, extras: 0.4 }
    const pool = (lane: Lane) => {
      const fitting = byLane[lane].filter((i) => fitsSeason(i, season))
      return fitting.length ? fitting : byLane[lane]
    }
    if (hasDresses && hasSeparates) setMode(Math.random() < 0.3 ? 'dress' : 'separates')
    setPicks(
      Object.fromEntries(
        (Object.keys(LANES) as Lane[]).map((l) => {
          const options = pool(l)
          const skip = !options.length || (LANES[l].optional && Math.random() >= (chance[l] ?? 0.5))
          return [l, skip ? null : pick(options).id]
        }),
      ) as Picks,
    )
  }

  const wear = () => (match ? toggleOutfitWornToday(match.id) : setItemsWornToday(selectedIds, !wornToday))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    await saveOutfit({
      id: newId(),
      name: name.trim() || `Outfit ${allOutfits.length + 1}`,
      itemIds: selectedIds,
      createdAt: Date.now(),
      wornOn: [],
    })
    setNaming(false)
    setName('')
  }

  const savedOutfits = [...outfits].sort(
    (a, b) =>
      (lastWorn(b.wornOn) ?? '').localeCompare(lastWorn(a.wornOn) ?? '') || b.createdAt - a.createdAt,
  )
  const itemsOf = (o: Outfit) => o.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i)

  const laneView = (lane: Lane) =>
    byLane[lane].length > 0 && (
      <LaneCarousel
        key={lane}
        lane={lane}
        options={LANES[lane].optional ? [null, ...byLane[lane]] : [...byLane[lane], null]}
        pickedId={picks[lane]}
        onPick={(id) => setPick(lane, id)}
      />
    )
  const rows = ROWS[mode].filter((row) => row.some((l) => byLane[l].length))

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button className="icon-btn -ml-2" onClick={onClose} aria-label="Close">
          <XIcon />
        </button>
        <h2 className="flex-1 truncate font-display text-[1.375rem] font-medium leading-tight">Choose outfit</h2>
        <button className="btn-ghost px-4" onClick={shuffle}>
          <ShuffleIcon size={16} /> Shuffle
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 pb-6">
          {wardrobes.length + bags.length > 1 && (
            <label className="mt-4 flex items-center gap-2 text-sm text-stone-500">
              Clothes from
              <select
                value={placeId}
                onChange={(e) => onPlaceChange(e.target.value)}
                className="chip chip-off appearance-none font-medium text-ink"
                aria-label="Clothes from"
              >
                {wardrobes.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
                {bags.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bag: {b.name}
                  </option>
                ))}
                <option value="all">All wardrobes</option>
              </select>
            </label>
          )}

          {items.length === 0 && (
            <p className="mt-10 text-center text-sm text-stone-500">No clothes here. Pick another place above.</p>
          )}

          {savedOutfits.length > 0 && (
            <section className="pt-4">
              <h3 className="label">Start from an outfit</h3>
              <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 pt-1">
                {savedOutfits.map((o) => (
                  <li key={o.id} className="w-20 shrink-0">
                    <button className="block w-full text-left" onClick={() => applyOutfit(o)} aria-pressed={match?.id === o.id}>
                      <div className={`rounded-2xl ${match?.id === o.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}>
                        <OutfitCollage items={itemsOf(o)} />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-stone-600">{o.name}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasDresses && hasSeparates && (
            <div className="mt-4 flex justify-center">
              <div className="inline-flex rounded-full bg-stone-900/[0.06] p-1 text-sm font-medium">
                {(['separates', 'dress'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`h-10 rounded-full px-4 transition duration-200 ${mode === m ? 'bg-white text-ink shadow-card' : 'text-stone-500 hover:text-ink'}`}
                  >
                    {m === 'separates' ? 'Top & bottoms' : 'Dress'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mb-2 mt-4 text-center text-xs text-stone-500">Swipe each piece sideways to try alternatives.</p>

          <div className="rounded-3xl bg-white px-2 py-5 shadow-card">
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.join()} className="flex w-full gap-2">
                  {row.map(laneView)}
                </div>
              ))}
            </div>
            {byLane.extras.length > 0 && (
              <div className={rows.length ? 'mt-5 border-t border-line pt-4' : ''}>
                <p className="label text-center">Accessories</p>
                {laneView('extras')}
              </div>
            )}
          </div>

          {selected.length > 0 && <PieceList items={selected} />}
        </div>
      </div>

      <footer className="border-t border-line bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <MixedPlacesWarning items={selected} compact className="mx-auto mb-3 max-w-md py-2.5" />
        {naming ? (
          <form className="mx-auto flex max-w-md gap-2" onSubmit={save}>
            <input
              autoFocus
              className="field min-w-0 flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Outfit ${allOutfits.length + 1}`}
              maxLength={60}
              aria-label="Outfit name"
            />
            <button type="button" className="btn-ghost px-4" onClick={() => setNaming(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4">
              Save
            </button>
          </form>
        ) : (
          <div className="mx-auto flex max-w-md items-center gap-2">
            {match ? (
              <p className="flex h-11 min-w-0 flex-1 items-center truncate text-sm">
                <span className="truncate">
                  <span className="text-stone-500">Your outfit</span> <span className="font-semibold">{match.name}</span>
                </span>
              </p>
            ) : (
              // Without wear tracking, saving is the main thing to do here.
              <button
                className={trackWear ? 'btn-ghost' : 'btn-primary flex-1'}
                onClick={() => setNaming(true)}
                disabled={!selected.length}
              >
                Save outfit
              </button>
            )}
            {trackWear && (
              <button className={`${wornToday ? 'btn-ghost' : 'btn-primary'} flex-1`} onClick={wear} disabled={!selected.length}>
                {wornToday ? (
                  <>
                    <CheckIcon size={18} /> Worn today · undo
                  </>
                ) : (
                  'Wearing this today'
                )}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

/** A horizontally swipeable row of alternatives (snap scrolling), with arrow buttons for mouse users. */
function LaneCarousel({
  lane,
  options,
  pickedId,
  onPick,
}: {
  lane: Lane
  options: (ClothingItem | null)[]
  pickedId: string | null
  onPick: (id: string | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const index = Math.max(0, options.findIndex((o) => (o?.id ?? null) === pickedId))
  // The slide the scroller rests on, so a pick made by swiping isn't scrolled to again.
  const shown = useRef<number | null>(null)
  const settleTimer = useRef<number>()
  const { zone, label, none } = LANES[lane]

  useEffect(() => {
    const el = ref.current
    if (!el || shown.current === index) return
    el.scrollTo({ left: index * el.clientWidth, behavior: shown.current === null ? 'auto' : 'smooth' })
    shown.current = index
  }, [index])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  // Scroll events keep coming while a swipe (or smooth scroll) is moving; act once it settles.
  const onScroll = () => {
    clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(options.length - 1, Math.round(el.scrollLeft / el.clientWidth))
      shown.current = i
      if (i !== index) onPick(options[i]?.id ?? null)
    }, 120)
  }

  const step = (d: number) => onPick(options[(index + d + options.length) % options.length]?.id ?? null)

  return (
    <div className={`relative min-w-0 flex-1 ${ROW_HEIGHT[zone]}`}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        aria-label={`Choose ${label}`}
      >
        {options.map((item, i) => (
          <div key={item?.id ?? 'none'} className="flex h-full w-full shrink-0 snap-center snap-always justify-center px-1" aria-hidden={i !== index}>
            {item ? (
              <Piece item={item} />
            ) : (
              <div className="flex h-full w-full max-w-[9rem] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-stone-300/70 bg-white/40 px-2 text-center text-xs text-stone-400">
                {none}
              </div>
            )}
          </div>
        ))}
      </div>
      {options.length > 1 && (
        <>
          <ArrowButton side="left" label={`Previous ${label}`} onClick={() => step(-1)} />
          <ArrowButton side="right" label={`Next ${label}`} onClick={() => step(1)} />
        </>
      )}
    </div>
  )
}

function ArrowButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  // Only on devices with a mouse; touch users swipe.
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-card backdrop-blur transition hover:text-ink [@media(hover:hover)]:flex ${
        side === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      {side === 'left' ? <ChevronLeftIcon size={18} /> : <ChevronRightIcon size={18} />}
    </button>
  )
}
