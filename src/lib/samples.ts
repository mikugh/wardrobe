// Sample clothes and outfits so new users can try the app before photographing
// their own. The pictures are drawn here as SVG (a garment lying on a linen
// background, like a real photo) and go through the normal photo pipeline.
import type { Category, ClothingItem, Outfit, Place, Season } from '../types'
import { processPhoto } from './image'
import { localDate, newId } from './util'

/** Wraps a garment drawing (600×800 coordinates) in a background with a soft shadow. */
const scene = (garment: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 600 800">
<defs>
  <radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#d6cdbf"/></radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#5b4a36" flood-opacity="0.28"/></filter>
</defs>
<rect width="600" height="800" fill="url(#bg)"/>
<g filter="url(#shadow)" stroke-linejoin="round" stroke-linecap="round">${garment}</g>
</svg>`

const tee = (fill: string, line: string) => `
<path d="M235 188Q300 232 365 188L465 220L555 320L495 372L445 325L450 625Q300 640 150 625L155 325L105 372L45 320L135 220Z" fill="${fill}"/>
<path d="M235 188Q300 232 365 188" fill="none" stroke="${line}" stroke-width="12"/>
<path d="M155 325L135 220M445 325L465 220" fill="none" stroke="${line}" stroke-width="3"/>
<path d="M114 360L54 312M486 360L546 312M153 607Q300 622 447 607" fill="none" stroke="${line}" stroke-width="3" stroke-dasharray="7 6"/>`

const sweater = (fill: string, line: string) => `
<path d="M240 190Q300 228 360 190L458 210Q530 330 565 575L505 592Q480 450 445 335L442 640L158 640L155 335Q120 450 95 592L35 575Q70 330 142 210Z" fill="${fill}"/>
<path d="M158 605L442 605L442 640L158 640ZM35 575L95 592L101 560L42 542ZM565 575L505 592L499 560L558 542Z" fill="${line}"/>
<path d="M240 190Q300 228 360 190" fill="none" stroke="${line}" stroke-width="16"/>
${[230, 300, 370]
  .map(
    (x) =>
      `<path d="M${x} 250${Array.from({ length: 7 }, (_, i) => `Q${x + (i % 2 ? -14 : 14)} ${265 + i * 48} ${x} ${290 + i * 48}`).join('')}" fill="none" stroke="${line}" stroke-width="5" opacity="0.7"/>`,
  )
  .join('')}`

const trousers = (fill: string, line: string, stitch: string) => `
<path d="M170 150L430 150L432 190L418 690L318 690L300 335L282 690L182 690L168 190Z" fill="${fill}"/>
<path d="M168 190L432 190M300 190Q302 290 300 335" fill="none" stroke="${line}" stroke-width="4"/>
<path d="M188 198Q228 250 262 192M412 198Q372 250 338 192M300 195L300 285Q300 305 280 300M186 670L282 670M318 670L414 670" fill="none" stroke="${stitch}" stroke-width="3" stroke-dasharray="7 5"/>
<path d="M205 150h14v48h-14zM381 150h14v48h-14z" fill="${line}"/>
<circle cx="300" cy="170" r="9" fill="#c9a25b"/>`

const dress = (fill: string, line: string) => `
<path d="M232 214L246 140L262 140L256 216ZM368 214L354 140L338 140L344 216Z" fill="${line}"/>
<path d="M225 210Q300 255 375 210L385 360L482 680Q300 718 118 680L215 360Z" fill="${fill}"/>
<path d="M215 360Q300 378 385 360" fill="none" stroke="${line}" stroke-width="14"/>
<path d="M255 390L215 690M300 395L300 700M345 390L385 690" fill="none" stroke="${line}" stroke-width="3" opacity="0.55"/>
${[
  [245, 450], [330, 430], [280, 520], [370, 520], [200, 600], [300, 610], [400, 615], [250, 660], [350, 670], [300, 300], [255, 260], [345, 280],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fffaf0" opacity="0.9"/>`)
  .join('')}`

const coat = (fill: string, line: string) => `
<path d="M245 170L355 170L462 205Q535 340 562 640L505 655Q480 480 450 340L455 720L145 720L150 340Q120 480 95 655L38 640Q65 340 138 205Z" fill="${fill}"/>
<path d="M245 170L300 335L262 305L218 225ZM355 170L300 335L338 305L382 225Z" fill="${line}"/>
<path d="M300 335L300 720M38 640L95 655M562 640L505 655M175 560L250 560M350 560L425 560" fill="none" stroke="${line}" stroke-width="5"/>
${[400, 480, 560].map((y) => `<circle cx="322" cy="${y}" r="10" fill="#3b2a1f"/>`).join('')}`

const sneaker = (fill: string, sole: string, line: string, accent: string) => `
<path d="M110 520Q110 440 170 425L260 400Q300 380 330 395L380 430Q440 470 500 480Q545 488 545 530L545 560L110 560Z" fill="${fill}" stroke="${line}" stroke-width="3"/>
<path d="M200 535Q300 470 330 400L352 414Q330 490 240 545Z" fill="${accent}"/>
<path d="M110 520Q110 440 170 425L178 520Z" fill="${accent}"/>
<path d="M100 555L555 555Q560 590 530 595L120 595Q95 590 100 555Z" fill="${sole}" stroke="${line}" stroke-width="3"/>
<path d="M100 572L556 572M440 470Q470 500 545 505" fill="none" stroke="${line}" stroke-width="3"/>
<path d="M280 410L330 440M298 400L350 450M316 396L368 462" fill="none" stroke="${line}" stroke-width="6"/>`

const sneakers = (fill: string, sole: string, line: string, accent: string) =>
  `<g transform="translate(-10 -140)">${sneaker(fill, sole, line, accent)}</g><g transform="translate(15 55)">${sneaker(fill, sole, line, accent)}</g>`

const beanie = (fill: string, line: string) => `
<circle cx="300" cy="235" r="52" fill="${fill}"/>
<path d="M160 470Q160 255 300 245Q440 255 440 470Z" fill="${fill}"/>
${[200, 250, 300, 350, 400].map((x) => `<path d="M${x} 455Q${(x + 300) / 2} 330 300 250" fill="none" stroke="${line}" stroke-width="5" opacity="0.6"/>`).join('')}
<rect x="145" y="445" width="310" height="115" rx="20" fill="${line}"/>
${Array.from({ length: 13 }, (_, i) => `<path d="M${168 + i * 22} 458L${168 + i * 22} 548" stroke="${fill}" stroke-width="7" opacity="0.5"/>`).join('')}`

interface SampleItem {
  key: string
  name: string
  category: Category
  color: string
  colorHex: string
  seasons: Season[]
  favorite?: boolean
  price: number
  /** Whether wear tracking is on, to show cost per wear on some samples. */
  track?: boolean
  /** Days ago it was worn. */
  worn: number[]
  svg: string
}

const ITEMS: SampleItem[] = [
  { key: 'tee', price: 15, track: true, name: 'White tee', category: 'tops', color: 'White', colorHex: '#f6f5f1', seasons: [], favorite: true, worn: [2, 9, 16, 30], svg: tee('#f6f5f1', '#d9d5cc') },
  { key: 'sweater', price: 59, name: 'Navy cable knit', category: 'tops', color: 'Navy', colorHex: '#26365f', seasons: ['autumn', 'winter'], worn: [12, 26], svg: sweater('#26365f', '#1b2747') },
  { key: 'jeans', price: 79, track: true, name: 'Straight jeans', category: 'bottoms', color: 'Blue', colorHex: '#3f6b9c', seasons: [], favorite: true, worn: [2, 5, 9, 12, 20, 26], svg: trousers('#3f6b9c', '#2f5582', '#e0a84e') },
  { key: 'chinos', price: 45, name: 'Beige chinos', category: 'bottoms', color: 'Beige', colorHex: '#d4bd93', seasons: ['spring', 'summer'], worn: [5], svg: trousers('#d4bd93', '#b9a179', '#a68d64') },
  { key: 'dress', price: 39, name: 'Yellow sundress', category: 'dresses', color: 'Yellow', colorHex: '#e8c13e', seasons: ['summer'], worn: [], svg: dress('#e8c13e', '#c9a227') },
  { key: 'coat', price: 189, track: true, name: 'Camel coat', category: 'outerwear', color: 'Brown', colorHex: '#8b5a3c', seasons: ['autumn', 'winter'], worn: [12, 26], svg: coat('#8b5a3c', '#6e452d') },
  { key: 'sneakers', price: 89, track: true, name: 'White sneakers', category: 'shoes', color: 'White', colorHex: '#f7f6f2', seasons: [], worn: [2, 5, 9, 12, 16, 26], svg: sneakers('#f7f6f2', '#e4dfd4', '#bdb6a8', '#26365f') },
  { key: 'beanie', price: 19, name: 'Red beanie', category: 'accessories', color: 'Red', colorHex: '#b83a32', seasons: ['autumn', 'winter'], worn: [12, 26], svg: beanie('#b83a32', '#93291f') },
]

const OUTFITS: { name: string; items: string[]; worn: number[] }[] = [
  { name: 'Weekend casual', items: ['tee', 'jeans', 'sneakers'], worn: [2, 9] },
  { name: 'Autumn layers', items: ['sweater', 'jeans', 'coat', 'beanie', 'sneakers'], worn: [12, 26] },
]

const daysAgo = (days: number[]) => days.map((d) => localDate(new Date(Date.now() - d * 86_400_000))).sort()

const SIZES: Record<string, string> = {
  tee: 'M', sweater: 'M', jeans: 'W32 L32', chinos: 'W32 L32', dress: 'S', coat: 'L', sneakers: '42', beanie: 'One size',
}

// Summer clothes live in a second wardrobe, to show off having several.
const AT_COTTAGE = ['dress', 'chinos']

/** Creates the samples; most go into `wardrobeId`, a few into a sample "Summer cottage" wardrobe. */
export async function createSamples(
  wardrobeId: string,
): Promise<{ items: ClothingItem[]; outfits: Outfit[]; places: Place[] }> {
  const now = Date.now()
  const cottage: Place = { id: newId(), name: 'Summer cottage', kind: 'wardrobe', createdAt: now, sample: true }
  const ids = new Map(ITEMS.map((s) => [s.key, newId()]))
  const items = await Promise.all(
    ITEMS.map(async (s, i): Promise<ClothingItem> => {
      const photo = await processPhoto(new Blob([scene(s.svg)], { type: 'image/svg+xml' }))
      return {
        id: ids.get(s.key)!,
        name: s.name,
        category: s.category,
        color: s.color,
        colorHex: s.colorHex,
        seasons: s.seasons,
        brand: '',
        size: SIZES[s.key],
        notes: '',
        favorite: !!s.favorite,
        price: s.price,
        trackWear: !!s.track,
        placeId: AT_COTTAGE.includes(s.key) ? cottage.id : wardrobeId,
        image: photo.image,
        thumb: photo.thumb,
        // Spaced out so "newest first" keeps this order.
        createdAt: now - i * 60_000,
        wornOn: daysAgo(s.worn),
        sample: true,
      }
    }),
  )
  const outfits = OUTFITS.map(
    (o, i): Outfit => ({
      id: newId(),
      name: o.name,
      itemIds: o.items.map((key) => ids.get(key)!),
      createdAt: now - i * 60_000,
      wornOn: daysAgo(o.worn),
      sample: true,
    }),
  )
  return { items, outfits, places: [cottage] }
}
