import { useEffect, useRef, useState, type ReactNode } from 'react'
import { processPhoto, type ProcessedPhoto } from '../lib/image'
import { newId } from '../lib/util'
import { useWardrobe } from '../store'
import type { Category } from '../types'
import { CameraCapture } from './CameraCapture'
import { CameraIcon, ImageIcon } from './icons'
import { ItemForm } from './ItemForm'
import { Sheet, Spinner } from './ui'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
const canUseLiveCamera = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

/**
 * The whole "add clothes" flow: pick a source (camera or library), then fill in
 * details for each photo in turn.
 */
export function AddItem({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<'source' | 'camera' | 'details'>('source')
  const [files, setFiles] = useState<File[]>([])
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const takePhoto = () => {
    // Phones get the native camera app (best quality, works without https);
    // computers get a live webcam view.
    if (!isTouchDevice() && canUseLiveCamera()) setStage('camera')
    else cameraInput.current?.click()
  }

  const accept = (list: FileList | File[] | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (!images.length) return
    setFiles(images)
    setStage('details')
  }

  return (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          accept(e.target.files)
          e.target.value = ''
        }}
      />

      {stage === 'source' && (
        <Sheet title="Add clothes" onClose={onClose}>
          <p className="mb-5 text-sm text-stone-500">
            Tip: lay the item flat on a plain background in good light. You can add several photos at once from your library.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SourceButton icon={<CameraIcon size={26} />} title="Take a photo" subtitle="Use your camera" onClick={takePhoto} primary />
            <SourceButton
              icon={<ImageIcon size={26} />}
              title="Choose photos"
              subtitle="From your library"
              onClick={() => libraryInput.current?.click()}
            />
          </div>
        </Sheet>
      )}

      {stage === 'camera' && (
        <CameraCapture
          onClose={() => setStage('source')}
          onCapture={(file) => accept([file])}
          onUnavailable={() => {
            setStage('source')
            libraryInput.current?.click()
          }}
        />
      )}

      {stage === 'details' && <DetailsQueue files={files} onDone={onClose} />}
    </>
  )
}

function SourceButton({
  icon,
  title,
  subtitle,
  onClick,
  primary,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        primary ? 'border-accent bg-accent-light hover:bg-[#f2dccf]' : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          primary ? 'bg-accent text-white' : 'bg-stone-100 text-ink'
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-stone-500">{subtitle}</span>
      </span>
    </button>
  )
}

function DetailsQueue({ files, onDone }: { files: File[]; onDone: () => void }) {
  const { saveItem, currentPlaceId, wardrobes } = useWardrobe()
  // New clothes go where the user is looking (a wardrobe, or a bag on a trip).
  const placeId = currentPlaceId === 'all' ? wardrobes[0].id : currentPlaceId
  const [index, setIndex] = useState(0)
  const [processed, setProcessed] = useState<ProcessedPhoto | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Batches are usually the same kind of item, so remember the last category.
  const [lastCategory, setLastCategory] = useState<Category>('tops')

  useEffect(() => {
    let cancelled = false
    setProcessed(null)
    setError(null)
    processPhoto(files[index])
      .then((p) => !cancelled && setProcessed(p))
      .catch(() => !cancelled && setError("This photo couldn't be read. Try a JPG or PNG."))
    return () => {
      cancelled = true
    }
  }, [files, index])

  const multiple = files.length > 1
  const next = () => (index + 1 < files.length ? setIndex(index + 1) : onDone())

  return (
    <Sheet title={multiple ? `New item ${index + 1} of ${files.length}` : 'New item'} onClose={onDone} tall>
      {error ? (
        <div className="py-12 text-center">
          <p className="mb-5 text-stone-600">{error}</p>
          <button className="btn-ghost" onClick={next}>
            {index + 1 < files.length ? 'Skip to next photo' : 'Close'}
          </button>
        </div>
      ) : !processed ? (
        <Spinner label="Preparing photo…" />
      ) : (
        <ItemForm
          key={index}
          photo={processed}
          detectedColor={processed.colorName}
          initial={{
            name: '',
            category: lastCategory,
            color: processed.colorName,
            colorHex: processed.colorHex,
            seasons: [],
            brand: '',
            notes: '',
            favorite: false,
            placeId,
          }}
          submitLabel={multiple && index + 1 < files.length ? 'Save & next' : 'Add to wardrobe'}
          cancelLabel={multiple ? 'Skip' : 'Cancel'}
          onCancel={multiple ? next : onDone}
          onSubmit={async (values) => {
            await saveItem({ ...values, id: newId(), createdAt: Date.now(), wornOn: [] })
            setLastCategory(values.category)
            next()
          }}
        />
      )}
    </Sheet>
  )
}
