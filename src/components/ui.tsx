import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MULTICOLOR } from '../lib/constants'
import type { Photo } from '../types'
import { XIcon } from './icons'

/** Creates an object URL for a Blob and revokes it when the Blob changes or the component unmounts. */
export function useBlobUrl(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function BlobImg({ blob, alt, className }: { blob: Blob | null | undefined; alt: string; className?: string }) {
  const url = useBlobUrl(blob)
  if (!url) return <div className={`bg-sand ${className ?? ''}`} />
  return <img src={url} alt={alt} className={className} draggable={false} />
}

/**
 * An item's thumbnail filling its box. Photos are cropped to fill it; cut-outs
 * (photos with the background removed) are shown whole, with some breathing room.
 */
export function ItemThumb({ item, alt = item.name, className = '' }: { item: Photo & { name: string }; alt?: string; className?: string }) {
  const fit = item.original ? 'object-contain p-[8%]' : 'object-cover'
  return <BlobImg blob={item.thumb} alt={alt} className={`h-full w-full ${fit} ${className}`} />
}

export function ColorDot({ name, hex, size = 12 }: { name: string; hex: string; size?: number }) {
  const multi = name === MULTICOLOR || !hex
  return (
    <span
      title={name}
      className="inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10"
      style={{
        width: size,
        height: size,
        background: multi ? 'conic-gradient(#e74c3c, #f1c40f, #2ecc71, #3498db, #9b59b6, #e74c3c)' : hex,
      }}
    />
  )
}

interface SheetProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Take (almost) the full viewport height. */
  tall?: boolean
  headerAction?: ReactNode
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ title, onClose, children, footer, tall, headerAction }: SheetProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[94dvh] w-full animate-sheet flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-sheet md:max-w-xl md:animate-dialog md:rounded-[28px] md:shadow-lift ${
          tall ? 'h-[94dvh] md:h-[88dvh]' : ''
        }`}
      >
        {/* Grabber: a visual cue that this is a sheet on phones. */}
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-stone-300/80 md:hidden" />
        <header className="flex items-center gap-1 px-5 pb-3 pt-2 md:pt-5">
          <h2 className="min-w-0 flex-1 truncate font-display text-[1.375rem] font-medium leading-tight">{title}</h2>
          {headerAction}
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mr-2 text-stone-500 hover:bg-transparent hover:text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/[0.06] transition hover:bg-stone-900/10">
              <XIcon size={16} />
            </span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

/** An on/off switch with a title and description; the whole row is clickable. */
export function Switch({
  checked,
  onChange,
  title,
  description,
  className = '',
}: {
  checked: boolean
  onChange: (on: boolean) => void
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 shadow-card ${className}`}>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block leading-relaxed text-stone-500">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      {/* Track and knob */}
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-stone-300 shadow-[inset_0_1px_2px_rgb(28_25_23/0.12)] transition duration-300 ease-out after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgb(28_25_23/0.25)] after:transition after:duration-300 after:ease-out peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
      />
    </label>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-stone-500">
      <span className="h-7 w-7 animate-spin rounded-full border-[1.5px] border-stone-200 border-t-accent" />
      {label}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`chip ${active ? 'chip-on' : 'chip-off'} ${className}`}>
      {children}
    </button>
  )
}

/** Centered illustration, title, text and optional actions for a screen with nothing to show. */
export function EmptyState({
  icon,
  art,
  title,
  children,
  actions,
  className = 'mt-14',
}: {
  icon?: ReactNode
  /** Replaces the icon medallion with custom artwork. */
  art?: ReactNode
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto max-w-sm animate-rise text-center ${className}`}>
      {art ??
        (icon && (
          <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent-light" />
            <span aria-hidden="true" className="absolute inset-2 rounded-full bg-white shadow-card" />
            <span className="relative text-accent">{icon}</span>
          </span>
        ))}
      <h2 className="mt-7 text-balance font-display text-[1.625rem] font-medium leading-tight text-ink">{title}</h2>
      {children && <p className="mx-auto mt-2.5 max-w-xs text-pretty text-[15px] leading-relaxed text-stone-500">{children}</p>}
      {actions && <div className="mt-7 flex flex-col items-center gap-3">{actions}</div>}
    </div>
  )
}
