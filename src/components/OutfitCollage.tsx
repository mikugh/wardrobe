import type { ClothingItem } from '../types'
import { ItemThumb } from './ui'

/** Where on the body a piece is worn, top to toe. Bags, scarves, jewelry etc. are "extras". */
export type BodyZone = 'head' | 'upper' | 'dress' | 'legs' | 'feet' | 'extras'

export const BODY_ZONES: BodyZone[] = ['head', 'upper', 'dress', 'legs', 'feet', 'extras']

// Hats are filed under accessories, so recognize them by name (English, plus Finnish and Swedish compounds).
const HEADWEAR = /\b(hats?|caps?|beanies?|berets?|fedoras?|headbands?|bandanas?|balaclavas?)\b|pipo|hattu|lippis|mössa|keps/i

export function bodyZone(item: ClothingItem): BodyZone {
  switch (item.category) {
    case 'outerwear':
    case 'tops':
      return 'upper'
    case 'dresses':
      return 'dress'
    case 'bottoms':
      return 'legs'
    case 'shoes':
      return 'feet'
    case 'accessories':
      return HEADWEAR.test(item.name) ? 'head' : 'extras'
    default:
      return 'extras'
  }
}

// Within a zone, outer layers come first.
const CATEGORY_ORDER = ['outerwear', 'tops', 'dresses', 'bottoms', 'shoes', 'accessories', 'other']

/** Orders pieces top-to-toe, the way they're worn, so collages and outfits read naturally. */
export function sortTopToToe(items: ClothingItem[]) {
  return [...items].sort(
    (a, b) =>
      BODY_ZONES.indexOf(bodyZone(a)) - BODY_ZONES.indexOf(bodyZone(b)) ||
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )
}

export function OutfitCollage({ items, className = '' }: { items: ClothingItem[]; className?: string }) {
  const sorted = sortTopToToe(items)
  const shown = sorted.slice(0, 4)
  const extra = sorted.length - shown.length

  if (!shown.length) return <div className={`aspect-square rounded-2xl bg-stone-100 ${className}`} />

  const layout =
    shown.length === 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'

  return (
    <div className={`grid aspect-square gap-1 overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-black/5 ${layout} ${className}`}>
      {shown.map((item, i) => (
        <div
          key={item.id}
          className={`relative overflow-hidden rounded-xl bg-stone-100 ${shown.length === 3 && i === 0 ? 'row-span-2' : ''}`}
        >
          <ItemThumb item={item} />
          {extra > 0 && i === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-lg font-semibold text-white">
              +{extra}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
