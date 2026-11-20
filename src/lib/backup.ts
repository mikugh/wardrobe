import { blobToDataUrl, dataUrlToBlob } from './image'
import type { ClothingItem, Outfit, PhotoFiles, Place } from '../types'

const FORMAT = 'virtual-wardrobe-backup'

type SerializedFiles = { image: string; thumb: string }
type SerializedItem = Omit<ClothingItem, 'image' | 'thumb' | 'original'> & SerializedFiles & { original?: SerializedFiles }

const serializeFiles = async (p: PhotoFiles): Promise<SerializedFiles> => ({
  image: await blobToDataUrl(p.image),
  thumb: await blobToDataUrl(p.thumb),
})

const parseFiles = async (p: SerializedFiles): Promise<PhotoFiles> => ({
  image: await dataUrlToBlob(p.image),
  thumb: await dataUrlToBlob(p.thumb),
})

interface Backup {
  format: typeof FORMAT
  /** 1: a single wardrobe (no places, items without placeId). 2: wardrobes and bags. */
  version: 1 | 2
  exportedAt: string
  items: SerializedItem[]
  outfits: Outfit[]
  places?: Place[]
}

export async function exportBackup(items: ClothingItem[], outfits: Outfit[], places: Place[]): Promise<Blob> {
  const serialized: SerializedItem[] = await Promise.all(
    items.map(async (i) => ({
      ...i,
      ...(await serializeFiles(i)),
      original: i.original && (await serializeFiles(i.original)),
    })),
  )
  const backup: Backup = { format: FORMAT, version: 2, exportedAt: new Date().toISOString(), items: serialized, outfits, places }
  return new Blob([JSON.stringify(backup)], { type: 'application/json' })
}

/** Reads a backup. Items from version 1 have no place yet; the store puts them in a wardrobe. */
export async function parseBackup(file: Blob): Promise<{ items: ClothingItem[]; outfits: Outfit[]; places: Place[] }> {
  let data: Backup
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (data?.format !== FORMAT || !Array.isArray(data.items) || !Array.isArray(data.outfits)) {
    throw new Error('That file is not a wardrobe backup.')
  }
  const items: ClothingItem[] = await Promise.all(
    data.items.map(async (i) => ({
      ...i,
      ...(await parseFiles(i)),
      original: i.original && (await parseFiles(i.original)),
    })),
  )
  return { items, outfits: data.outfits, places: Array.isArray(data.places) ? data.places : [] }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
