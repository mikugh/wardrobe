import { MULTICOLOR } from './constants'
import type { PhotoFiles } from '../types'

interface Source {
  el: CanvasImageSource
  width: number
  height: number
  release: () => void
}

export async function decode(file: Blob): Promise<Source> {
  if ('createImageBitmap' in window) {
    try {
      // Applies EXIF orientation, so phone photos come out upright.
      const bmp = await createImageBitmap(file)
      return { el: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      // Fall through to <img> decoding, which supports more formats on some browsers (e.g. HEIC on Safari).
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { el: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality),
  )
}

/**
 * Scales the image down to fit `maxSide`. Photos become JPEG on white; with
 * `transparent` the alpha channel is kept and the result is WebP (or PNG on
 * browsers that can't encode WebP).
 */
function resize(src: Source, maxSide: number, quality: number, transparent = false): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height))
  const w = Math.max(1, Math.round(src.width * scale))
  const h = Math.max(1, Math.round(src.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (!transparent) {
    ctx.fillStyle = '#ffffff' // transparent PNGs become white instead of black
    ctx.fillRect(0, 0, w, h)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src.el, 0, 0, w, h)
  return canvasToBlob(canvas, transparent ? 'image/webp' : 'image/jpeg', quality)
}

/**
 * Estimates the garment's main color, weighting pixels near the center more, and
 * returns the average color of the most common color bucket. For photos only the
 * middle is sampled (where the item usually is); for cut-outs the whole image is,
 * skipping the transparent background.
 */
function dominantColor(src: Source, wholeImage = false): string {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const inset = wholeImage ? 0 : 0.2
  const [sx, sy] = [src.width * inset, src.height * inset]
  ctx.drawImage(src.el, sx, sy, src.width - 2 * sx, src.height - 2 * sy, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const d = Math.hypot(x - c, y - c) / c
      const weight = Math.exp(-d * d * 1.5)
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
      const bucket = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 }
      bucket.w += weight
      bucket.r += r * weight
      bucket.g += g * weight
      bucket.b += b * weight
      buckets.set(key, bucket)
    }
  }
  let best = { w: 0, r: 0, g: 0, b: 0 }
  for (const bucket of buckets.values()) if (bucket.w > best.w) best = bucket
  if (!best.w) return '#9ca3af'
  return rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w)
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Maps a hex color to one of the named colors in the palette. */
export function nameForColor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return MULTICOLOR
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const l = (max + min) / 2

  if (chroma < 0.1) return l < 0.22 ? 'Black' : l > 0.82 ? 'White' : 'Grey'
  if (l < 0.12) return 'Black'

  let h: number
  if (max === r) h = ((g - b) / chroma) % 6
  else if (max === g) h = (b - r) / chroma + 2
  else h = (r - g) / chroma + 4
  h = (h * 60 + 360) % 360

  if (h >= 15 && h < 50) {
    if (l < 0.4) return 'Brown'
    if (chroma < 0.35 && l > 0.6) return 'Beige'
  }
  if (h >= 195 && h < 250 && l < 0.3) return 'Navy'
  if (h < 12 || h >= 345) return l > 0.7 ? 'Pink' : 'Red'
  if (h < 42) return 'Orange'
  if (h < 68) return l < 0.35 ? 'Green' : 'Yellow'
  if (h < 170) return 'Green'
  if (h < 255) return 'Blue'
  if (h < 290) return 'Purple'
  return 'Pink'
}

export interface ProcessedPhoto extends PhotoFiles {
  colorHex: string
  colorName: string
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const src = await decode(file)
  try {
    const [image, thumb] = await Promise.all([resize(src, 1200, 0.85), resize(src, 480, 0.8)])
    const colorHex = dominantColor(src)
    return { image, thumb, colorHex, colorName: nameForColor(colorHex) }
  } finally {
    src.release()
  }
}

/** Detects the main color of an already processed photo or cut-out. */
export async function detectColor(image: Blob, cutout: boolean): Promise<{ colorHex: string; colorName: string }> {
  const src = await decode(image)
  try {
    const colorHex = dominantColor(src, cutout)
    return { colorHex, colorName: nameForColor(colorHex) }
  } finally {
    src.release()
  }
}

/** Single-channel foreground mask, 0 = background, 255 = item. */
export interface Mask {
  data: ArrayLike<number>
  width: number
  height: number
}

/**
 * Applies a foreground mask to a photo and trims the empty space around the
 * item, so cut-outs fill their thumbnails. Throws if the mask is (nearly) empty.
 */
export async function applyMask(photo: Blob, mask: Mask): Promise<ProcessedPhoto> {
  const src = await decode(photo)
  const { width: w, height: h } = mask
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  try {
    ctx.drawImage(src.el, 0, 0, w, h)
  } finally {
    src.release()
  }

  const pixels = ctx.getImageData(0, 0, w, h)
  let [left, top, right, bottom, count] = [w, h, -1, -1, 0]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = mask.data[y * w + x]
      pixels.data[(y * w + x) * 4 + 3] = alpha
      if (alpha > 32) {
        count++
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (count < w * h * 0.01) throw new Error('No item found in this photo')
  ctx.putImageData(pixels, 0, 0)

  const pad = Math.round(Math.max(right - left, bottom - top) * 0.04)
  const [cx, cy] = [Math.max(0, left - pad), Math.max(0, top - pad)]
  const cw = Math.min(w, right + pad + 1) - cx
  const ch = Math.min(h, bottom + pad + 1) - cy
  const cropped = document.createElement('canvas')
  cropped.width = cw
  cropped.height = ch
  cropped.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)

  const out: Source = { el: cropped, width: cw, height: ch, release: () => {} }
  const [image, thumb] = await Promise.all([resize(out, 1200, 0.85, true), resize(out, 480, 0.8, true)])
  const colorHex = dominantColor(out, true)
  return { image, thumb, colorHex, colorName: nameForColor(colorHex) }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}
