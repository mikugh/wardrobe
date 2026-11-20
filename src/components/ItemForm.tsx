import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { removeBackground, type DownloadProgress } from '../lib/background'
import { CATEGORIES, COLORS, SEASONS, categoryInfo, paletteHex } from '../lib/constants'
import { detectColor, processPhoto } from '../lib/image'
import { formatBytes, parsePrice } from '../lib/util'
import { useWardrobe } from '../store'
import type { ItemFields, Photo } from '../types'
import { BagIcon, CameraIcon, HeartIcon, UndoIcon, WandIcon } from './icons'
import { BlobImg, Chip, ColorDot } from './ui'

interface Props {
  initial: ItemFields
  photo: Photo
  /** Color name detected from the photo, shown as a hint. */
  detectedColor?: string
  submitLabel: string
  cancelLabel?: string
  onSubmit: (values: ItemFields & Photo) => Promise<void>
  onCancel: () => void
}

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size']

/** A price as an editable number in the user's notation, e.g. "49,90" in Finnish, "49.90" in English. */
const formatPrice = (price: number | undefined) =>
  price === undefined ? '' : price.toLocaleString(undefined, { minimumFractionDigits: price % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: false })

export function defaultName(f: Pick<ItemFields, 'color' | 'category'>) {
  const noun = categoryInfo(f.category).singular.toLowerCase()
  return `${f.color} ${noun}`
}

export function ItemForm({ initial, photo: initialPhoto, detectedColor, submitLabel, cancelLabel = 'Cancel', onSubmit, onCancel }: Props) {
  const formId = useId()
  const [values, setValues] = useState<ItemFields>(initial)
  // Only the photo fields; the prop may carry extras (like the detected color) that shouldn't be saved.
  const [photo, setPhoto] = useState<Photo>({
    image: initialPhoto.image,
    thumb: initialPhoto.thumb,
    original: initialPhoto.original,
  })
  const [detected, setDetected] = useState(detectedColor)
  // The exact shade of the photo's color, kept so re-selecting that color doesn't swap it for the palette swatch.
  const [shade, setShade] = useState({ name: initial.color, hex: initial.colorHex })
  const [busy, setBusy] = useState(false)
  // Background removal in progress; holds download progress while the model is first fetched.
  const [cutting, setCutting] = useState<DownloadProgress | true | null>(null)
  const [error, setError] = useState<string | null>(null)
  const replaceInput = useRef<HTMLInputElement>(null)

  // Clothes are moved between wardrobes here; bags are packed from the Bags tab, but
  // an item that's already in a bag (or being added to one) shows that bag too.
  const { wardrobes, places, currency, items } = useWardrobe()

  // Suggestions: brands and sizes already used (most used first), then common letter sizes.
  const byUse = (values: (string | undefined)[]) => {
    const counts = new Map<string, number>()
    for (const v of values) if (v?.trim()) counts.set(v.trim(), (counts.get(v.trim()) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)
  }
  const usedBrands = byUse(items.map((i) => i.brand))
  const usedSizes = byUse(items.filter((i) => i.category === values.category).map((i) => i.size))
  const sizeSuggestions = [...usedSizes, ...COMMON_SIZES.filter((s) => !usedSizes.includes(s))]

  // Typed as text so "49," mid-typing isn't fought; parsed on save.
  const [priceText, setPriceText] = useState(formatPrice(initial.price))
  const priceInvalid = priceText.trim() !== '' && parsePrice(priceText) === undefined
  const placeOptions = [...wardrobes, ...places.filter((p) => p.kind === 'bag' && p.id === initial.placeId)]

  const set = <K extends keyof ItemFields>(key: K, value: ItemFields[K]) => setValues((v) => ({ ...v, [key]: value }))

  /** Takes a newly detected color, unless the user already picked a different one. */
  const adoptColor = (c: { colorName: string; colorHex: string }) => {
    setValues((v) => (v.color === detected || v.color === c.colorName ? { ...v, color: c.colorName, colorHex: c.colorHex } : v))
    setDetected(c.colorName)
    setShade({ name: c.colorName, hex: c.colorHex })
  }

  const replacePhoto = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const p = await processPhoto(file)
      setPhoto({ image: p.image, thumb: p.thumb, original: undefined })
      setDetected(p.colorName)
      setShade({ name: p.colorName, hex: p.colorHex })
      setValues((v) => ({ ...v, color: p.colorName, colorHex: p.colorHex }))
    } catch {
      setError("That photo couldn't be read. Try a JPG or PNG.")
    } finally {
      setBusy(false)
    }
  }

  const cutOut = async () => {
    setCutting(true)
    setError(null)
    try {
      const p = await removeBackground(photo.image, setCutting)
      setPhoto({ image: p.image, thumb: p.thumb, original: { image: photo.image, thumb: photo.thumb } })
      adoptColor(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCutting(null)
    }
  }

  const restoreOriginal = async () => {
    const { original } = photo
    if (!original) return
    setPhoto({ ...original, original: undefined })
    adoptColor(await detectColor(original.image, false))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (priceInvalid) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        ...values,
        name: values.name.trim() || defaultName(values),
        brand: values.brand.trim(),
        size: values.size?.trim() || undefined,
        notes: values.notes.trim(),
        price: parsePrice(priceText),
        // Explicit so restoring the original also clears it on the saved item.
        image: photo.image,
        thumb: photo.thumb,
        original: photo.original,
      })
    } catch (err) {
      setError(`Could not save: ${err instanceof Error ? err.message : err}`)
      setBusy(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-stone-100">
        <BlobImg blob={photo.image} alt="Item photo" className="mx-auto max-h-[40dvh] w-full object-contain" />
        {cutting ? (
          <CuttingOverlay progress={cutting} />
        ) : (
          <div className="absolute inset-x-3 bottom-3 flex justify-between gap-2">
            {photo.original ? (
              <PhotoButton onClick={restoreOriginal} disabled={busy}>
                <UndoIcon size={14} /> Restore original
              </PhotoButton>
            ) : (
              <PhotoButton onClick={cutOut} disabled={busy}>
                <WandIcon size={14} /> Remove background
              </PhotoButton>
            )}
            <PhotoButton onClick={() => replaceInput.current?.click()} disabled={busy}>
              <CameraIcon size={14} /> Replace photo
            </PhotoButton>
          </div>
        )}
        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            replacePhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {placeOptions.length > 1 && (
        <div>
          <label className="label">Where it is</label>
          <div className="flex flex-wrap gap-2">
            {placeOptions.map((p) => (
              <Chip key={p.id} active={values.placeId === p.id} onClick={() => set('placeId', p.id)}>
                {p.kind === 'bag' && <BagIcon size={14} />}
                {p.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={values.category === c.id} onClick={() => set('category', c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="label">
          Color{detected && <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">detected: {detected}</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const active = values.color === c.name
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={active}
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    color: c.name,
                    colorHex: c.name === shade.name ? shade.hex : paletteHex(c.name),
                  }))
                }
                className={`flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-sm transition ${
                  active ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <ColorDot name={c.name} hex={c.hex} size={22} />
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${formId}-name`}>Name</label>
        <input
          id={`${formId}-name`}
          className="field"
          value={values.name}
          placeholder={defaultName(values)}
          onChange={(e) => set('name', e.target.value)}
          maxLength={80}
        />
      </div>

      <div>
        <label className="label">
          Seasons <span className="ml-1 font-normal normal-case tracking-normal text-stone-400">none selected = all year</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => (
            <Chip
              key={s.id}
              active={values.seasons.includes(s.id)}
              onClick={() =>
                set('seasons', values.seasons.includes(s.id) ? values.seasons.filter((x) => x !== s.id) : [...values.seasons, s.id])
              }
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor={`${formId}-brand`}>Brand</label>
          <input
            id={`${formId}-brand`}
            className="field"
            value={values.brand}
            placeholder="Optional"
            onChange={(e) => set('brand', e.target.value)}
            maxLength={60}
            list={`${formId}-brands`}
            autoComplete="off"
          />
          {/* Brands already in the wardrobe, so they're spelled the same way each time. */}
          <datalist id={`${formId}-brands`}>
            {usedBrands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-size`}>Size</label>
          <input
            id={`${formId}-size`}
            className="field"
            value={values.size ?? ''}
            placeholder="Optional"
            onChange={(e) => set('size', e.target.value)}
            maxLength={20}
            list={`${formId}-sizes`}
            autoComplete="off"
          />
          <datalist id={`${formId}-sizes`}>
            {sizeSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-price`}>
            Price <span className="ml-1 font-normal normal-case tracking-normal text-stone-400">{currency}</span>
          </label>
          <input
            id={`${formId}-price`}
            className="field"
            inputMode="decimal"
            value={priceText}
            placeholder="Optional"
            onChange={(e) => setPriceText(e.target.value)}
            onBlur={() => priceText.trim() && parsePrice(priceText) !== undefined && setPriceText(formatPrice(parsePrice(priceText)))}
            maxLength={12}
            aria-invalid={priceInvalid}
          />
          {priceInvalid && <p className="mt-1 text-xs text-red-700">Enter a number, e.g. {formatPrice(49.9)}</p>}
        </div>
        <div className="flex items-end">
          <button
            type="button"
            aria-pressed={values.favorite}
            onClick={() => set('favorite', !values.favorite)}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
              values.favorite ? 'border-accent bg-accent-light text-accent-dark' : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <HeartIcon size={18} fill={values.favorite ? 'currentColor' : 'none'} />
            {values.favorite ? 'Favorite' : 'Mark as favorite'}
          </button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${formId}-notes`}>Notes</label>
        <textarea
          id={`${formId}-notes`}
          className="field h-auto min-h-[80px] py-2.5"
          value={values.notes}
          placeholder="Material, where you bought it, care tips…"
          onChange={(e) => set('notes', e.target.value)}
          maxLength={500}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Offset by the sheet's bottom padding so the bar sits flush with the sheet edge. */}
      <div className="sticky -bottom-6 -mx-5 -mb-6 flex gap-3 border-t border-stone-200 bg-paper px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="submit" className="btn-primary flex-[2]" disabled={busy || !!cutting}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function PhotoButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold shadow backdrop-blur disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function CuttingOverlay({ progress }: { progress: DownloadProgress | true }) {
  // Progress events only arrive while the model is first downloaded; after that it's working on the photo.
  const downloading = progress !== true && progress.loaded < progress.total
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 px-6 text-center text-sm font-medium text-stone-700 backdrop-blur-sm">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-accent" />
      {downloading ? (
        <>
          <span>Downloading background remover…</span>
          <span className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
            <span className="block h-full bg-accent transition-[width]" style={{ width: `${(progress.loaded / progress.total) * 100}%` }} />
          </span>
          <span className="text-xs font-normal text-stone-500">
            {formatBytes(progress.loaded)} of {formatBytes(progress.total)} · one-time download
          </span>
        </>
      ) : (
        'Removing background…'
      )}
    </div>
  )
}
