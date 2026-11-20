import { useMemo, useState } from 'react'
import { describeLastWorn, lastWorn, plural, today } from '../lib/util'
import { useWardrobe } from '../store'
import type { ClothingItem, Outfit } from '../types'
import { CheckIcon, LayersIcon, PencilIcon, PlusIcon, SwipeIcon, TrashIcon } from './icons'
import { OutfitBuilder } from './OutfitBuilder'
import { OutfitCollage } from './OutfitCollage'
import { MixedPlacesWarning, OutfitFigure, PieceList, placeCount, tracksWear } from './OutfitFigure'
import { OutfitPicker } from './OutfitPicker'
import { Sheet, Spinner } from './ui'

export function OutfitsView() {
  const { items, outfits, loading } = useWardrobe()
  const [building, setBuilding] = useState<Outfit | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const itemsOf = (o: Outfit) => o.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => !!i)
  const tracked = (o: Outfit) => tracksWear(itemsOf(o))

  // Most recently worn first (for outfits that track wear), then newest.
  const sorted = [...outfits].sort(
    (a, b) =>
      (tracked(b) ? (lastWorn(b.wornOn) ?? '') : '').localeCompare(tracked(a) ? (lastWorn(a.wornOn) ?? '') : '') || b.createdAt - a.createdAt,
  )
  const open = outfits.find((o) => o.id === openId)

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Outfits</h1>
          {outfits.length > 0 && <p className="mt-1 text-sm text-stone-500">{plural(outfits.length, 'outfit')}</p>}
        </div>
        <div className="mt-1 flex shrink-0 gap-2">
          {outfits.length > 0 && (
            <button className="btn-ghost px-3 sm:px-4" onClick={() => setBuilding('new')} aria-label="New outfit">
              <PlusIcon size={18} /> <span className="hidden sm:inline">New</span>
            </button>
          )}
          {items.length > 0 && (
            <button className="btn-primary px-4" onClick={() => setChoosing(true)}>
              <SwipeIcon size={18} /> Choose outfit
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <Spinner />
      ) : outfits.length === 0 ? (
        <div className="mx-auto mt-14 max-w-sm text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-accent">
            <LayersIcon size={28} />
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold">No outfits yet</h2>
          <p className="mt-2 text-stone-500">
            {items.length
              ? 'Combine pieces from your wardrobe into outfits, or let Shuffle suggest one.'
              : 'Add a few clothes to your wardrobe first, then combine them into outfits here.'}
          </p>
          {items.length > 0 && (
            <button className="btn-primary mt-6" onClick={() => setBuilding('new')}>
              <PlusIcon size={18} /> Create an outfit
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((o) => (
            <li key={o.id}>
              <button className="group block w-full text-left" onClick={() => setOpenId(o.id)}>
                <div className="relative transition group-hover:opacity-95">
                  <OutfitCollage items={itemsOf(o)} />
                  {tracked(o) && o.wornOn.includes(today()) && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">
                      Worn today
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{o.name}</p>
                <p className="text-xs text-stone-500">
                  {plural(o.itemIds.length, 'piece')}
                  {tracked(o) && <> · {o.wornOn.length ? `worn ${o.wornOn.length}×` : 'not worn yet'}</>}
                  {o.sample && ' · sample'}
                  {placeCount(itemsOf(o)) > 1 && (
                    <span className="block font-medium text-amber-700">In different wardrobes</span>
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !building && (
        <OutfitDetail
          outfit={open}
          items={itemsOf(open)}
          onClose={() => setOpenId(null)}
          onEdit={() => setBuilding(open)}
        />
      )}
      {building && <OutfitBuilder initial={building === 'new' ? undefined : building} onClose={() => setBuilding(null)} />}
      {choosing && <OutfitPicker onClose={() => setChoosing(false)} />}
    </div>
  )
}

function OutfitDetail({
  outfit,
  items,
  onClose,
  onEdit,
}: {
  outfit: Outfit
  items: ClothingItem[]
  onClose: () => void
  onEdit: () => void
}) {
  const { deleteOutfit, toggleOutfitWornToday } = useWardrobe()
  // Wear is logged on the pieces that track it; with none, there's nothing to log.
  const trackWear = tracksWear(items)
  const wornToday = outfit.wornOn.includes(today())

  const remove = async () => {
    if (!confirm(`Delete the outfit "${outfit.name}"? The clothes stay in your wardrobe.`)) return
    await deleteOutfit(outfit.id)
    onClose()
  }

  return (
    <Sheet
      title={outfit.name}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="icon-btn h-11 w-11 bg-stone-100 text-stone-600 hover:bg-red-50 hover:text-red-600" onClick={remove} aria-label="Delete outfit">
            <TrashIcon size={18} />
          </button>
          <button className={`btn-ghost ${trackWear ? '' : 'flex-1'}`} onClick={onEdit}>
            <PencilIcon size={16} /> Edit
          </button>
          {trackWear && (
            <button className={`${wornToday ? 'btn-ghost' : 'btn-primary'} flex-1`} onClick={() => toggleOutfitWornToday(outfit.id)}>
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
      }
    >
      {trackWear && (
        <p className="-mt-1 mb-4 text-sm text-stone-500">
          {describeLastWorn(outfit.wornOn)}
          {outfit.wornOn.length > 0 && <> · worn {plural(outfit.wornOn.length, 'time')}</>}
        </p>
      )}
      <MixedPlacesWarning items={items} className="mb-4" />
      <OutfitFigure items={items} />
      <PieceList items={items} />
    </Sheet>
  )
}
