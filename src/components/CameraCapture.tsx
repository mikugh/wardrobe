import { useEffect, useRef, useState } from 'react'
import { FlipIcon, XIcon } from './icons'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
  /** Called when the camera can't start, so the caller can offer a file picker instead. */
  onUnavailable: () => void
}

/** Full-screen live camera (getUserMedia). Used on desktops/laptops; phones use the native camera app instead. */
export function CameraCapture({ onCapture, onClose, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [canFlip, setCanFlip] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    setReady(false)

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setReady(true)
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (e) {
        if (cancelled) return
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser settings, or choose a photo instead.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'The camera could not be started.',
        )
      }
    }
    start()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => blob && onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
        {ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="aspect-[3/4] h-[78%] max-w-full rounded-3xl border-2 border-dashed border-white/50" />
          </div>
        )}
        {ready && (
          <p className="absolute inset-x-0 top-4 text-center text-sm text-white/80">Lay the item flat and fill the frame</p>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-sm text-white/90">{error}</p>
            <button className="btn bg-white text-ink" onClick={onUnavailable}>
              Choose a photo instead
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <button className="icon-btn h-12 w-12 text-white hover:bg-white/10" onClick={onClose} aria-label="Close camera">
          <XIcon size={24} />
        </button>
        <div className="flex justify-center">
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="Take photo"
            className="h-[72px] w-[72px] rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
          />
        </div>
        <div className="flex justify-end">
          {canFlip && (
            <button
              className="icon-btn h-12 w-12 text-white hover:bg-white/10"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              aria-label="Switch camera"
            >
              <FlipIcon size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
