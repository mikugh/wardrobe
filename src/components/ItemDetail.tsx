import { useState, type ReactNode } from 'react'
import { SEASONS, categoryInfo } from '../lib/constants'
import { costPerWear, describeLastWorn, formatMoney, plural, today, wearCount } from '../lib/util'
import { useWardrobe } from '../store'
import type { ClothingItem } from '../types'
import { CheckIcon, HeartIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon } from './icons'
import { ItemForm } from './ItemForm'
import { BlobImg, ColorDot, Sheet, Switch } from './ui'

export function ItemDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { items, outfits, places, currency, saveItem, deleteItem, toggleItemWornToday } = useWardrobe()
  const [editing, setEditing] = useState(false)
  const [adjustingWears, setAdjustingWears] = useState(false)
  const item = items.find((i) => i.id === id)
  if (!item) return null

  if (editing) {
    return (
      <Sheet title="Edit item" onClose={() => setEditing(false)} tall>
        <ItemForm
          initial={item}
          photo={item}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            // Moved somewhere else by hand: it's no longer "packed from" anywhere.
            const packedFrom = values.placeId === item.placeId ? item.packedFrom : undefined
            await saveItem({ ...item, ...values, packedFrom })
            setEditing(false)
          }}
        />
      </Sheet>
    )
  }

  const place = places.find((p) => p.id === item.placeId)
  const packedFrom = place?.kind === 'bag' ? places.find((p) => p.id === item.packedFrom) : undefined
  const tracking = !!item.trackWear
  const wears = wearCount(item)
  const wornToday = item.wornOn.includes(today())
  const inOutfits = outfits.filter((o) => o.itemIds.includes(item.id)).length
  const seasons = item.seasons.length
    ? SEASONS.filter((s) => item.seasons.includes(s.id)).map((s) => s.label).join(', ')
    : 'All year'

  const remove = async () => {
    const extra = inOutfits ? ` It will also be removed from ${plural(inOutfits, 'outfit')}.` : ''
    if (!confirm(`Delete "${item.name}"?${extra}`)) return
    await deleteItem(item.id)
    onClose()
  }

  return (
    <Sheet
      title={item.name}
      onClose={onClose}
      headerAction={
        <button
          className={`icon-btn ${item.favorite ? 'text-accent' : 'text-stone-500'}`}
          aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={item.favorite}
          onClick={() => saveItem({ ...item, favorite: !item.favorite })}
        >
          <HeartIcon fill={item.favorite ? 'currentColor' : 'none'} />
        </button>
      }
      footer={
        <div className="flex gap-2">
          <button className="icon-btn h-11 w-11 bg-stone-100 text-stone-600 hover:bg-red-50 hover:text-red-600" onClick={remove} aria-label="Delete item">
            <TrashIcon size={18} />
          </button>
          <button className={`btn-ghost ${tracking ? '' : 'flex-1'}`} onClick={() => setEditing(true)}>
            <PencilIcon size={16} /> Edit
          </button>
          {tracking && (
            <button className={`${wornToday ? 'btn-ghost' : 'btn-primary'} flex-1`} onClick={() => toggleItemWornToday(item.id)}>
              {wornToday ? (
                <>
                  <CheckIcon size={18} /> Worn today · undo
                </>
              ) : (
                'I wore this today'
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl bg-stone-100">
        <BlobImg blob={item.image} alt={item.name} className="mx-auto max-h-[50dvh] w-full object-contain" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <Field label={place?.kind === 'bag' ? 'Packed in' : 'Wardrobe'}>
          {place?.name ?? '—'}
          {packedFrom && <span className="block text-xs text-stone-500">from {packedFrom.name}</span>}
        </Field>
        <Field label="Category">{categoryInfo(item.category).label}</Field>
        <Field label="Color">
          <span className="inline-flex items-center gap-2">
            <ColorDot name={item.color} hex={item.colorHex} size={14} /> {item.color}
          </span>
        </Field>
        <Field label="Seasons">{seasons}</Field>
        {item.brand && <Field label="Brand">{item.brand}</Field>}
        {item.size && <Field label="Size">{item.size}</Field>}
        {item.price !== undefined && <Field label="Price">{formatMoney(item.price, currency)}</Field>}
        <Field label="In outfits">{inOutfits || 'None yet'}</Field>
      </dl>

      <Switch
        className="mt-5"
        checked={tracking}
        onChange={(on) => saveItem({ ...item, trackWear: on })}
        title="Wear history"
        description={
          tracking
            ? 'Log the days you wear this piece. Turning it off hides the history but keeps it.'
            : 'Turn on to log the days you wear this piece and see its cost per wear.'
        }
      />
      {tracking && adjustingWears && (
        <WearCountEditor
          item={item}
          onCancel={() => setAdjustingWears(false)}
          onSave={async (total) => {
            const earlier = total - item.wornOn.length
            await saveItem({ ...item, earlierWears: earlier > 0 ? earlier : undefined })
            setAdjustingWears(false)
          }}
        />
      )}
      {tracking && !adjustingWears && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <Stat
            label="Worn"
            value={plural(wears, 'time')}
            sub={[
              item.wornOn.length ? describeLastWorn(item.wornOn) : wears ? 'No dates logged' : 'Never worn',
              item.earlierWears ? `incl. ${item.earlierWears} earlier` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            action={
              <button className="text-xs font-semibold text-accent" onClick={() => setAdjustingWears(true)}>
                Adjust
              </button>
            }
          />
          {item.price !== undefined ? (
            <Stat
              label="Cost per wear"
              value={formatMoney(costPerWear(item.price, wears), currency)}
              sub={wears ? `${formatMoney(item.price, currency)} ÷ ${wears}` : 'Full price until worn'}
            />
          ) : (
            <button
              className="rounded-2xl border-2 border-dashed border-stone-200 p-3 text-left text-stone-500 transition hover:border-stone-300"
              onClick={() => setEditing(true)}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-stone-400">Cost per wear</span>
              <span className="mt-1 block">Add a price to see it</span>
            </button>
          )}
        </div>
      )}

      {item.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-stone-700">{item.notes}</p>}

      <p className="mt-5 text-xs text-stone-400">
        Added {new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </Sheet>
  )
}

/**
 * Sets how many times a piece has been worn in total, for wears that were never
 * logged. Wears logged with a date are the minimum; the rest are stored as
 * "earlier wears" without a date.
 */
function WearCountEditor({
  item,
  onSave,
  onCancel,
}: {
  item: ClothingItem
  onSave: (total: number) => Promise<void>
  onCancel: () => void
}) {
  const logged = item.wornOn.length
  const max = logged + 9999
  const [text, setText] = useState(String(wearCount(item)))
  const parsed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN
  const valid = parsed >= logged && parsed <= max
  const step = (d: number) => setText(String(Math.min(max, Math.max(logged, (Number.isNaN(parsed) ? logged : parsed) + d))))

  return (
    <form
      className="mt-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(parsed)
      }}
    >
      <p className="font-semibold text-ink">Times worn in total</p>
      <p className="mt-0.5 text-stone-500">
        Add the times you wore it before you started logging.
        {logged > 0 && ` At least ${logged}: the days you've logged.`}
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" className="icon-btn h-11 w-11 bg-stone-100" onClick={() => step(-1)} disabled={parsed <= logged} aria-label="One less">
          <MinusIcon size={18} />
        </button>
        <input
          className="field w-24 text-center font-display text-xl font-semibold"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Times worn in total"
          aria-invalid={!valid}
        />
        <button type="button" className="icon-btn h-11 w-11 bg-stone-100" onClick={() => step(1)} disabled={parsed >= max} aria-label="One more">
          <PlusIcon size={18} />
        </button>
      </div>
      {!valid && (
        <p className="mt-2 text-center text-xs text-red-700">
          {logged ? `Enter a whole number, at least ${logged}.` : 'Enter a whole number.'}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={!valid}>
          Save
        </button>
      </div>
    </form>
  )
}

function Stat({ label, value, sub, action }: { label: string; value: string; sub: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</span>
        {action}
      </span>
      <span className="mt-1 block font-display text-xl font-semibold">{value}</span>
      <span className="block text-xs text-stone-500">{sub}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  )
}
