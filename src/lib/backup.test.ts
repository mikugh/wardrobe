import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const json = (data: unknown) => new Blob([JSON.stringify(data)], { type: 'application/json' })

const item = {
  id: 'a',
  createdAt: 1,
  name: 'White tee',
  category: 'tops',
  color: 'White',
  colorHex: '#ffffff',
  seasons: [],
  brand: '',
  notes: '',
  favorite: false,
  placeId: 'home',
  wornOn: [],
  image: PIXEL,
  thumb: PIXEL,
}

describe('parseBackup', () => {
  it('rejects files that are not JSON', async () => {
    await expect(parseBackup(new Blob(['not json']))).rejects.toThrow('not valid JSON')
  })

  it('rejects JSON that is not a wardrobe backup', async () => {
    await expect(parseBackup(json({ hello: 'world' }))).rejects.toThrow('not a wardrobe backup')
    await expect(parseBackup(json(null))).rejects.toThrow('not a wardrobe backup')
  })

  it('restores photos as Blobs and keeps wardrobes', async () => {
    const places = [{ id: 'home', name: 'Home', kind: 'wardrobe', createdAt: 1 }]
    const result = await parseBackup(
      json({ format: 'virtual-wardrobe-backup', version: 2, exportedAt: '', items: [item], outfits: [], places }),
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0].image).toBeInstanceOf(Blob)
    expect(result.items[0].image.type).toBe('image/png')
    expect(result.items[0].thumb).toBeInstanceOf(Blob)
    expect(result.items[0].original).toBeUndefined()
    expect(result.places).toEqual(places)
  })

  it('reads version 1 backups, which have no wardrobes', async () => {
    const { placeId: _, ...v1Item } = item
    const result = await parseBackup(json({ format: 'virtual-wardrobe-backup', version: 1, exportedAt: '', items: [v1Item], outfits: [] }))
    expect(result.items).toHaveLength(1)
    expect(result.places).toEqual([])
  })

  it('restores the original photo kept after background removal', async () => {
    const result = await parseBackup(
      json({ format: 'virtual-wardrobe-backup', version: 2, exportedAt: '', items: [{ ...item, original: { image: PIXEL, thumb: PIXEL } }], outfits: [] }),
    )
    expect(result.items[0].original?.image).toBeInstanceOf(Blob)
  })
})
