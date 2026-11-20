import { useState, type FormEvent } from 'react'
import { CATEGORIES } from '../lib/constants'
import { newId, plural } from '../lib/util'
import { useWardrobe } from '../store'
import type { ClothingItem, Place } from '../types'
import { BagIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon, WardrobeIcon, XIcon } from './icons'
import { OutfitCollage, sortTopToToe } from './OutfitCollage'
import { Chip, EmptyState, ItemThumb, Sheet, Spinner } from './ui'

/** The Bags tab: bags for trips or for moving clothes between wardrobes. */
export function BagsView() {
  const { items, bags, places, savePlace, loading } = useWardrobe()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const inside = (bag: Place) => items.filter((i) => i.placeId === bag.id)
  const placeName = (id: string | undefined) => places.find((p) => p.id === id)?.name

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const bag: Place = { id: newId(), name: name.trim() || `Bag ${bags.length + 1}`, kind: 'bag', createdAt: Date.now() }
    await savePlace(bag)
    setCreating(false)
    setName('')
    setOpenId(bag.id)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.125rem] font-medium leading-[1.1] sm:text-[2.75rem]">Bags</h1>
          {bags.length > 0 && <p className="num mt-1.5 text-[13px] text-stone-500">{plural(bags.length, 'bag')}</p>}
        </div>
        {bags.length > 0 && (
          <button className="btn-primary mt-1 px-4" onClick={() => setCreating(true)}>
            <PlusIcon size={18} /> New bag
          </button>
        )}
      </header>

      {loading ? (
        <Spinner />
      ) : bags.length === 0 ? (
        <EmptyState
          icon={<BagIcon size={26} />}
          title="No bags yet"
          actions={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <PlusIcon size={18} /> Pack a bag
            </button>
          }
        >
          Pack clothes into a bag when you go on a trip, or to move them from one wardrobe to another. Packed clothes are in
          the bag until you unpack them.
        </EmptyState>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
          {bags.map((bag, i) => {
            const packed = inside(bag)
            const from = [...new Set(packed.map((i) => placeName(i.packedFrom)).filter(Boolean))]
            return (
              <li key={bag.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <button className="group block w-full text-left" onClick={() => setOpenId(bag.id)}>
                  {packed.length ? (
                    <OutfitCollage items={packed} />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-2xl border-[1.5px] border-dashed border-stone-300/70 bg-white/40 text-stone-300">
                      <BagIcon size={36} />
                    </div>
                  )}
                  <p className="mt-2.5 truncate px-0.5 text-[14px] font-medium">{bag.name}</p>
                  <p className="num mt-0.5 truncate px-0.5 text-xs text-stone-500">
                    {packed.length ? plural(packed.length, 'piece') : 'Empty'}
                    {from.length > 0 && <> · from {from.join(', ')}</>}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {creating && (
        <Sheet title="New bag" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <input
              autoFocus
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend in Stockholm"
              maxLength={40}
              aria-label="Bag name"
            />
            <button type="submit" className="btn-primary mt-4 w-full">
              Create and start packing
            </button>
          </form>
        </Sheet>
      )}
      {openId && <BagView bagId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

/**
 * Packing a bag: tap clothes from a wardrobe (or a whole outfit) to move them
 * into the bag, tap packed clothes to take them out, and unpack when done.
 */
function BagView({ bagId, onClose }: { bagId: string; onClose: () => void }) {
  const { items, outfits, places, wardrobes, currentPlaceId, packItems, unpackItems, savePlace, deletePlace } = useWardrobe()
  const [source, setSource] = useState(() =>
    wardrobes.some((w) => w.id === currentPlaceId) ? currentPlaceId : wardrobes[0].id,
  )
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [unpacking, setUnpacking] = useState(false)

  const bag = places.find((p) => p.id === bagId)
  if (!bag) return null

  const placeName = (id: string | undefined) => places.find((p) => p.id === id)?.name
  const packed = sortTopToToe(items.filter((i) => i.placeId === bag.id))
  const available = items.filter((i) => i.placeId === source)
  const sections = CATEGORIES.map((c) => ({ ...c, items: available.filter((i) => i.category === c.id) })).filter(
    (s) => s.items.length,
  )
  // Outfits with something left to pack from this wardrobe.
  const packableOutfits = outfits
    .map((o) => ({ outfit: o, here: available.filter((i) => o.itemIds.includes(i.id)) }))
    .filter((o) => o.here.length)

  const rename = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) await savePlace({ ...bag, name: name.trim() })
    setRenaming(false)
  }

  const remove = async () => {
    const extra = packed.length ? ` The ${plural(packed.length, 'piece')} in it go back to where they came from.` : ''
    if (!confirm(`Delete the bag "${bag.name}"?${extra}`)) return
    await deletePlace(bag.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button className="icon-btn -ml-2" onClick={onClose} aria-label="Close">
          <XIcon />
        </button>
        {renaming ? (
          <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
            <input
              autoFocus
              className="field h-11 min-w-0 flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              aria-label="Bag name"
            />
            <button type="submit" className="btn-primary px-4">
              Save
            </button>
          </form>
        ) : (
          <>
            <BagIcon size={20} className="shrink-0 text-accent" />
            <h2 className="min-w-0 flex-1 truncate font-display text-[1.375rem] font-medium leading-tight">{bag.name}</h2>
            <button
              className="icon-btn text-stone-500"
              onClick={() => {
                setName(bag.name)
                setRenaming(true)
              }}
              aria-label="Rename bag"
            >
              <PencilIcon size={18} />
            </button>
            <button className="icon-btn -mr-2 text-stone-500 hover:text-red-600" onClick={remove} aria-label="Delete bag">
              <TrashIcon size={18} />
            </button>
          </>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <section className="py-4">
          <h3 className="label">In the bag · {packed.length}</h3>
          {packed.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-stone-300/70 bg-white/40 px-6 text-center text-sm text-stone-500">
              Tap clothes below to pack them. They move out of their wardrobe and into this bag.
            </div>
          ) : (
            <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 pt-2">
              {packed.map((item) => (
                <li key={item.id} className="relative w-24 shrink-0 sm:w-28">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-sand ring-1 ring-black/[0.04]">
                    <ItemThumb item={item} />
                  </div>
                  <button
                    onClick={() => unpackItems([item.id], 'origin')}
                    aria-label={`Take ${item.name} out`}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow"
                  >
                    <XIcon size={14} />
                  </button>
                  <p className="mt-1 truncate text-xs font-medium">{item.name}</p>
                  {item.packedFrom && <p className="truncate text-[11px] text-stone-500">from {placeName(item.packedFrom)}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-line pt-4">
          <h3 className="label">Pack from</h3>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {wardrobes.map((w) => (
              <Chip key={w.id} active={source === w.id} onClick={() => setSource(w.id)}>
                <WardrobeIcon size={14} /> {w.name}
                <span className="opacity-60">{items.filter((i) => i.placeId === w.id).length}</span>
              </Chip>
            ))}
          </div>

          {packableOutfits.length > 0 && (
            <div className="mt-5">
              <h3 className="label">Pack a whole outfit</h3>
              <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                {packableOutfits.map(({ outfit, here }) => (
                  <li key={outfit.id} className="w-20 shrink-0">
                    <button
                      className="block w-full text-left"
                      onClick={() => packItems(bag.id, here.map((i) => i.id))}
                      aria-label={`Pack ${outfit.name}`}
                    >
                      <OutfitCollage items={here} />
                      <p className="mt-1 truncate text-[11px] text-stone-600">{outfit.name}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sections.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">
              {packed.some((i) => i.packedFrom === source)
                ? 'Everything from this wardrobe is packed.'
                : 'No clothes in this wardrobe.'}
            </p>
          ) : (
            sections.map((section) => (
              <section key={section.id} className="mt-5">
                <h3 className="label">{section.label}</h3>
                <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
                  {section.items.map((item) => (
                    <li key={item.id} className="w-20 shrink-0 sm:w-24">
                      <button
                        onClick={() => packItems(bag.id, [item.id])}
                        aria-label={`Pack ${item.name}`}
                        className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-sand ring-1 ring-black/[0.04] transition hover:opacity-90"
                      >
                        <ItemThumb item={item} alt="" />
                        <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm">
                          <PlusIcon size={14} strokeWidth={2.5} />
                        </span>
                      </button>
                      <p className="mt-1 truncate text-[11px] text-stone-600">{item.name}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      </div>

      <footer className="border-t border-line bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button className="btn-ghost flex-1" onClick={() => setUnpacking(true)} disabled={!packed.length}>
            Unpack…
          </button>
          <button className="btn-primary flex-1" onClick={onClose}>
            <CheckIcon size={18} /> Done
          </button>
        </div>
      </footer>

      {unpacking && (
        <UnpackSheet
          items={packed}
          wardrobes={wardrobes}
          placeName={placeName}
          countIn={(id) => items.filter((i) => i.placeId === id).length}
          onUnpack={async (to) => {
            await unpackItems(
              packed.map((i) => i.id),
              to,
            )
            setUnpacking(false)
          }}
          onClose={() => setUnpacking(false)}
        />
      )}
    </div>
  )
}

function UnpackSheet({
  items,
  wardrobes,
  placeName,
  countIn,
  onUnpack,
  onClose,
}: {
  items: ClothingItem[]
  wardrobes: Place[]
  placeName: (id: string | undefined) => string | undefined
  countIn: (placeId: string) => number
  onUnpack: (to: string | 'origin') => Promise<void>
  onClose: () => void
}) {
  // "Back home" summary, e.g. "Home 5 · Summer cottage 2".
  const origins = new Map<string, number>()
  for (const i of items) {
    const name = placeName(i.packedFrom) ?? wardrobes[0].name
    origins.set(name, (origins.get(name) ?? 0) + 1)
  }
  const option = (to: string | 'origin', title: string, subtitle: string) => (
    <button
      key={to}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-card transition duration-200 hover:shadow-lift active:scale-[0.99]"
      onClick={() => onUnpack(to)}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-stone-600">
        <WardrobeIcon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-stone-500">{subtitle}</span>
      </span>
    </button>
  )

  return (
    <Sheet title={`Unpack ${plural(items.length, 'piece')}`} onClose={onClose}>
      <div className="space-y-2">
        {option(
          'origin',
          'Back where they came from',
          [...origins].map(([name, n]) => `${name} ${n}`).join(' · '),
        )}
        <h3 className="label pt-4">Or move everything into</h3>
        {wardrobes.map((w) => option(w.id, w.name, `${plural(countIn(w.id), 'piece')} there now`))}
      </div>
    </Sheet>
  )
}
