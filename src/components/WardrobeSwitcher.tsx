import { useState, type FormEvent, type ReactNode } from 'react'
import { newId, plural } from '../lib/util'
import { useWardrobe, type PlaceSelection } from '../store'
import type { ClothingItem, Place } from '../types'
import { BagIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon, WardrobeIcon } from './icons'
import { ItemThumb, Sheet } from './ui'

/** Pick which wardrobe (or bag) to look at, and add, rename or delete wardrobes. */
export function WardrobeSwitcher({ onClose }: { onClose: () => void }) {
  const { items, wardrobes, bags, currentPlaceId, setCurrentPlaceId, savePlace, deletePlace } = useWardrobe()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const inside = (id: string) => items.filter((i) => i.placeId === id)
  const choose = (id: PlaceSelection) => {
    setCurrentPlaceId(id)
    onClose()
  }
  const startEditing = (id: string | 'new', current = '') => {
    setEditing(id)
    setName(current)
    setError(null)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (editing === 'new') {
      const place: Place = { id: newId(), name: name.trim() || 'New wardrobe', kind: 'wardrobe', createdAt: Date.now() }
      await savePlace(place)
      choose(place.id)
    } else {
      const place = wardrobes.find((w) => w.id === editing)
      if (place && name.trim()) await savePlace({ ...place, name: name.trim() })
      setEditing(null)
    }
  }

  const remove = async (place: Place) => {
    if (!confirm(`Delete the wardrobe "${place.name}"?`)) return
    try {
      await deletePlace(place.id)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const nameForm = (place?: Place) => (
    <form onSubmit={save} className="rounded-2xl bg-white p-3 shadow-card">
      <input
        autoFocus
        className="field"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Wardrobe name, e.g. Summer cottage"
        maxLength={40}
        aria-label="Wardrobe name"
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        {place && (
          <button
            type="button"
            className="icon-btn bg-white shadow-card text-stone-600 hover:bg-red-50 hover:text-red-600"
            onClick={() => remove(place)}
            aria-label="Delete wardrobe"
          >
            <TrashIcon size={18} />
          </button>
        )}
        <button type="button" className="btn-ghost flex-1" onClick={() => setEditing(null)}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1">
          {place ? 'Save' : 'Add wardrobe'}
        </button>
      </div>
    </form>
  )

  return (
    <Sheet title="Wardrobes" onClose={onClose}>
      <ul className="space-y-2">
        <li>
          <PlaceRow
            icon={<WardrobeIcon size={20} />}
            title="All wardrobes"
            items={items}
            active={currentPlaceId === 'all'}
            onClick={() => choose('all')}
          />
        </li>
        {wardrobes.map((w) => (
          <li key={w.id}>
            {editing === w.id ? (
              nameForm(w)
            ) : (
              <PlaceRow
                icon={<WardrobeIcon size={20} />}
                title={w.name}
                items={inside(w.id)}
                active={currentPlaceId === w.id}
                onClick={() => choose(w.id)}
                onEdit={() => startEditing(w.id, w.name)}
              />
            )}
          </li>
        ))}
        <li>
          {editing === 'new' ? (
            nameForm()
          ) : (
            <button className="btn-ghost w-full" onClick={() => startEditing('new')}>
              <PlusIcon size={18} /> New wardrobe
            </button>
          )}
        </li>
      </ul>

      {bags.length > 0 && (
        <>
          <h3 className="label mt-6">Bags</h3>
          <ul className="space-y-2">
            {bags.map((b) => (
              <li key={b.id}>
                <PlaceRow
                  icon={<BagIcon size={20} />}
                  title={b.name}
                  items={inside(b.id)}
                  active={currentPlaceId === b.id}
                  onClick={() => choose(b.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}

function PlaceRow({
  icon,
  title,
  items,
  active,
  onClick,
  onEdit,
}: {
  icon: ReactNode
  title: string
  items: ClothingItem[]
  active: boolean
  onClick: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl bg-white p-2 pr-1 transition duration-200 ${active ? 'shadow-[0_0_0_1.5px_theme(colors.ink),0_4px_12px_-6px_rgb(28_25_23/0.2)]' : 'shadow-card'}`}
    >
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onClick} aria-pressed={active}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-stone-600">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block text-xs text-stone-500">{plural(items.length, 'piece')}</span>
        </span>
        {/* A peek at what's inside */}
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          {items.slice(0, 3).map((i) => (
            <span key={i.id} className="h-11 w-8 overflow-hidden rounded-md bg-sand">
              <ItemThumb item={i} alt="" />
            </span>
          ))}
        </span>
        {active && <CheckIcon size={18} className="shrink-0 text-ink" />}
      </button>
      {onEdit && (
        <button className="icon-btn text-stone-500" onClick={onEdit} aria-label={`Rename or delete ${title}`}>
          <PencilIcon size={16} />
        </button>
      )}
    </div>
  )
}
