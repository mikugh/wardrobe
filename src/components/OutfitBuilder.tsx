import { useMemo, useState } from 'react'
import { CATEGORIES, SEASONS } from '../lib/constants'
import { currentSeason, fitsSeason, newId } from '../lib/util'
import { useWardrobe } from '../store'
import type { Category, ClothingItem, Outfit, Season } from '../types'
import { CheckIcon, ShuffleIcon, XIcon } from './icons'
import { sortTopToToe } from './OutfitCollage'
import { MixedPlacesWarning } from './OutfitFigure'
import { ItemThumb } from './ui'

// You wear one of these at a time; tops, outerwear and accessories can be layered.
const SINGLE: Category[] = ['bottoms', 'dresses', 'shoes']

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

export function OutfitBuilder({ initial, onClose }: { initial?: Outfit; onClose: () => void }) {
  const { items, outfits, saveOutfit } = useWardrobe()
  const [selected, setSelected] = useState<string[]>(initial?.itemIds ?? [])
  const [name, setName] = useState(initial?.name ?? '')
  const [season, setSeason] = useState<Season | 'all'>(initial ? 'all' : currentSeason())
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const selectedItems = sortTopToToe(selected.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i))

  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: items
      .filter((i) => i.category === c.id && (fitsSeason(i, season) || selected.includes(i.id)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt),
  })).filter((s) => s.items.length)

  const toggle = (item: ClothingItem) =>
    setSelected((prev) => {
      if (prev.includes(item.id)) return prev.filter((id) => id !== item.id)
      const cat = (id: string) => byId.get(id)?.category
      let next = prev
      if (SINGLE.includes(item.category)) next = next.filter((id) => cat(id) !== item.category)
      // A dress replaces bottoms and vice versa.
      if (item.category === 'dresses') next = next.filter((id) => cat(id) !== 'bottoms')
      if (item.category === 'bottoms') next = next.filter((id) => cat(id) !== 'dresses')
      return [...next, item.id]
    })

  const pool = (c: Category) => items.filter((i) => i.category === c && fitsSeason(i, season))
  const canShuffle = items.some((i) => fitsSeason(i, season) && i.category !== 'other')

  const shuffle = () => {
    const tops = pool('tops'), bottoms = pool('bottoms'), dresses = pool('dresses')
    const outerwear = pool('outerwear'), shoes = pool('shoes'), accessories = pool('accessories')
    const result: ClothingItem[] = []
    const hasSeparates = tops.length > 0 && bottoms.length > 0
    if (dresses.length && (!hasSeparates || Math.random() < 0.3)) result.push(pick(dresses))
    else {
      if (tops.length) result.push(pick(tops))
      if (bottoms.length) result.push(pick(bottoms))
    }
    const cold = season === 'winter' || season === 'autumn'
    if (outerwear.length && (cold || Math.random() < 0.35)) result.push(pick(outerwear))
    if (shoes.length) result.push(pick(shoes))
    if (accessories.length && Math.random() < 0.5) result.push(pick(accessories))
    setSelected(result.map((i) => i.id))
  }

  const save = async () => {
    if (!selected.length) return
    setBusy(true)
    await saveOutfit({
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? Date.now(),
      wornOn: initial?.wornOn ?? [],
      name: name.trim() || `Outfit ${outfits.length + (initial ? 0 : 1)}`,
      itemIds: selected,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button className="icon-btn -ml-2" onClick={onClose} aria-label="Close">
          <XIcon />
        </button>
        <h2 className="flex-1 truncate font-display text-[1.375rem] font-medium leading-tight">{initial ? 'Edit outfit' : 'New outfit'}</h2>
      </header>

      <div className="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex items-center gap-2 pt-4">
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value as Season | 'all')}
            className="chip chip-off appearance-none"
            aria-label="Season"
          >
            <option value="all">Any season</option>
            {SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn-ghost px-4" onClick={shuffle} disabled={!canShuffle}>
            <ShuffleIcon size={16} /> Shuffle
          </button>
        </div>

        {/* The outfit being composed */}
        <section className="py-4">
          {selectedItems.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-stone-300/70 bg-white/40 px-6 text-center text-sm text-stone-500">
              Tap pieces below to put an outfit together, or hit Shuffle for a suggestion.
            </div>
          ) : (
            <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 pt-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="relative w-28 shrink-0 sm:w-32">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-sand ring-1 ring-black/[0.04]">
                    <ItemThumb item={item} />
                  </div>
                  <button
                    onClick={() => toggle(item)}
                    aria-label={`Remove ${item.name}`}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow"
                  >
                    <XIcon size={14} />
                  </button>
                  <p className="mt-1 truncate text-xs text-stone-600">{item.name}</p>
                </li>
              ))}
            </ul>
          )}
          {selectedItems.length > 0 && (
            <MixedPlacesWarning items={selectedItems} className="mt-3" />
          )}
        </section>

        {sections.length === 0 && (
          <p className="py-10 text-center text-sm text-stone-500">
            {items.length ? 'No items for this season. Try “Any season”.' : 'Add some clothes to your wardrobe first.'}
          </p>
        )}

        {sections.map((section) => (
          <section key={section.id} className="mt-4">
            <h3 className="label">{section.label}</h3>
            <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
              {section.items.map((item) => {
                const on = selected.includes(item.id)
                return (
                  <li key={item.id} className="w-20 shrink-0 sm:w-24">
                    <button
                      onClick={() => toggle(item)}
                      aria-pressed={on}
                      aria-label={item.name}
                      className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-sand transition ${
                        on ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-paper' : 'ring-1 ring-black/5 hover:opacity-90'
                      }`}
                    >
                      <ItemThumb item={item} alt="" />
                      {on && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                          <CheckIcon size={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <footer className="border-t border-line bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            className="field flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Office Monday)"
            maxLength={60}
            aria-label="Outfit name"
          />
          <button className="btn-primary" onClick={save} disabled={!selected.length || busy}>
            {initial ? 'Save' : 'Save outfit'}
          </button>
        </div>
      </footer>
    </div>
  )
}
