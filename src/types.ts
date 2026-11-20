export type Category = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes' | 'accessories' | 'other'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface PhotoFiles {
  /** Resized full image (max 1200px). JPEG, or WebP/PNG with transparency for cut-outs. */
  image: Blob
  /** Small version used in grids. */
  thumb: Blob
}

export interface Photo extends PhotoFiles {
  /** Set when the background was removed: the photo as taken, kept so it can be restored. */
  original?: PhotoFiles
}

export interface ItemFields {
  name: string
  category: Category
  /** Named color, e.g. "Navy". */
  color: string
  /** Swatch color used for the dot; detected from the photo or taken from the palette. */
  colorHex: string
  /** Empty means all-year. */
  seasons: Season[]
  brand: string
  /** Free text: "M", "38", "W32 L34"… */
  size?: string
  notes: string
  favorite: boolean
  /** The wardrobe or bag the item is in. An item is always in exactly one place. */
  placeId: string
  /** What it cost, in the currency chosen in Settings. Used for cost per wear. */
  price?: number
}

export interface ClothingItem extends ItemFields, Photo {
  id: string
  createdAt: number
  /** Local dates (YYYY-MM-DD) the item was worn. */
  wornOn: string[]
  /** Wears without a date, added by hand for times the user forgot to log. Total wears = wornOn + these. */
  earlierWears?: number
  /**
   * Whether wear is tracked for this piece (off by default): "I wore this today",
   * wear counts and cost per wear. Turning it off hides the history but keeps it.
   */
  trackWear?: boolean
  /** While packed in a bag: the wardrobe it was packed from, where "unpack" returns it. */
  packedFrom?: string
  /** One of the sample clothes added for trying out the app. */
  sample?: boolean
}

/**
 * Somewhere clothes are kept: a wardrobe (at home, at the summer cottage…) or a
 * bag they're packed in for a trip or a move between wardrobes.
 */
export interface Place {
  id: string
  name: string
  kind: 'wardrobe' | 'bag'
  createdAt: number
  sample?: boolean
}

export interface Outfit {
  id: string
  name: string
  itemIds: string[]
  createdAt: number
  wornOn: string[]
  sample?: boolean
}
