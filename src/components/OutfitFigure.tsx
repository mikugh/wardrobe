import { categoryInfo } from '../lib/constants'
import { useWardrobe } from '../store'
import type { ClothingItem, Place } from '../types'
import { AlertIcon } from './icons'
import { BODY_ZONES, bodyZone, sortTopToToe, type BodyZone } from './OutfitCollage'
import { BlobImg, ColorDot } from './ui'

// Row heights roughly follow body proportions, so the outfit stacks up like it's worn.
export const ROW_HEIGHT: Record<BodyZone, string> = {
  head: 'h-20 sm:h-24',
  upper: 'h-44 sm:h-52',
  dress: 'h-72 sm:h-80',
  legs: 'h-56 sm:h-64',
  feet: 'h-20 sm:h-24',
  extras: 'h-20 sm:h-24',
}

/**
 * An outfit laid out top to toe: headwear, then jackets and tops side by side,
 * dresses, bottoms and shoes. Other accessories go in a row of their own below.
 */
export function OutfitFigure({ items }: { items: ClothingItem[] }) {
  const sorted = sortTopToToe(items)
  const rows = BODY_ZONES.map((zone) => ({ zone, items: sorted.filter((i) => bodyZone(i) === zone) })).filter(
    (r) => r.items.length,
  )
  const body = rows.filter((r) => r.zone !== 'extras')
  const extras = rows.find((r) => r.zone === 'extras')

  return (
    <div className="rounded-3xl bg-white px-4 py-5 ring-1 ring-stone-200">
      <div className="flex flex-col items-center gap-2">
        {body.map((r) => (
          <Row key={r.zone} zone={r.zone} items={r.items} />
        ))}
      </div>
      {extras && (
        <div className={body.length ? 'mt-5 border-t border-stone-100 pt-4' : ''}>
          <p className="label text-center">Accessories</p>
          <Row zone="extras" items={extras.items} />
        </div>
      )}
    </div>
  )
}

function Row({ zone, items }: { zone: BodyZone; items: ClothingItem[] }) {
  return (
    <div className={`flex w-full justify-center gap-3 ${ROW_HEIGHT[zone]}`}>
      {items.map((item) => (
        <Piece key={item.id} item={item} full />
      ))}
    </div>
  )
}

/** Whether any piece tracks wear, so wearing the outfit has something to log. */
export const tracksWear = (items: ClothingItem[]) => items.some((i) => i.trackWear)

/** How many different wardrobes (or bags) the pieces are in. */
export const placeCount = (items: ClothingItem[]) => new Set(items.map((i) => i.placeId)).size

/**
 * Warns when an outfit's pieces are in different wardrobes or bags, listing
 * what's where. Renders nothing when they're all in one place. `compact` is a
 * single line naming just the places.
 */
export function MixedPlacesWarning({ items, compact = false, className = '' }: { items: ClothingItem[]; compact?: boolean; className?: string }) {
  const { wardrobes, bags } = useWardrobe()
  const groups = [...wardrobes, ...bags]
    .map((place) => ({ place, items: items.filter((i) => i.placeId === place.id) }))
    .filter((g) => g.items.length)
  if (groups.length < 2) return null
  const label = (p: Place) => (p.kind === 'bag' ? `${p.name} (bag)` : p.name)

  return (
    <div role="status" className={`flex gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ${className}`}>
      <AlertIcon size={18} className="mt-0.5 shrink-0 text-amber-600" />
      {compact ? (
        <p className="min-w-0">
          <span className="font-semibold">Clothes in different wardrobes:</span> {groups.map((g) => label(g.place)).join(', ')}
        </p>
      ) : (
        <div className="min-w-0">
          <p className="font-semibold">These clothes are in different wardrobes</p>
          <ul className="mt-1 space-y-0.5">
            {groups.map((g) => (
              <li key={g.place.id}>
                <span className="font-medium">{label(g.place)}:</span> {g.items.map((i) => i.name).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The outfit's pieces as a compact list, top to toe, with where each one is when there are several places. */
export function PieceList({ items }: { items: ClothingItem[] }) {
  const { places } = useWardrobe()
  const placeName = (item: ClothingItem) => places.length > 1 && places.find((p) => p.id === item.placeId)?.name
  return (
    <ul className="mt-4 divide-y divide-stone-200 text-sm">
      {sortTopToToe(items).map((item) => (
        <li key={item.id} className="flex items-center gap-2.5 py-2.5">
          <ColorDot name={item.color} hex={item.colorHex} size={12} />
          <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
          <span className="shrink-0 text-xs text-stone-500">
            {categoryInfo(item.category).singular}
            {placeName(item) && <> · {placeName(item)}</>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * One piece of clothing in a figure row, filling the row's height. Cut-outs float
 * freely at their natural shape; photos are shown as cards.
 */
export function Piece({ item, full = false }: { item: ClothingItem; full?: boolean }) {
  return item.original ? (
    <div className="h-full min-w-0 max-w-[14rem] flex-1">
      <BlobImg blob={full ? item.image : item.thumb} alt={item.name} className="h-full w-full object-contain drop-shadow-md" />
    </div>
  ) : (
    <div className="aspect-[3/4] h-full min-w-0 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5">
      <BlobImg blob={item.thumb} alt={item.name} className="h-full w-full object-cover" />
    </div>
  )
}
