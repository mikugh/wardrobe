import { useEffect, useRef, useState } from 'react'
import { downloadBlob, exportBackup, parseBackup } from '../lib/backup'
import { CURRENCIES, formatBytes, localDate, plural } from '../lib/util'
import { useWardrobe } from '../store'
import { DownloadIcon, TrashIcon, UploadIcon } from './icons'
import { Sheet } from './ui'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { items, outfits, places, importData, clearAll, currency, setCurrency } = useWardrobe()
  const [usage, setUsage] = useState<number | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => {})
  }, [items.length])

  const doExport = async () => {
    setBusy(true)
    setStatus(null)
    try {
      downloadBlob(await exportBackup(items, outfits, places), `wardrobe-backup-${localDate()}.json`)
      setStatus({ kind: 'ok', text: 'Backup downloaded.' })
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${e}` })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setStatus(null)
    try {
      const data = await parseBackup(file)
      await importData(data.items, data.outfits, data.places)
      setStatus({
        kind: 'ok',
        text: `Imported ${plural(data.items.length, 'item')} and ${plural(data.outfits.length, 'outfit')}.`,
      })
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const doClear = async () => {
    if (!confirm('Delete all your wardrobes, bags, clothes and outfits from this device? This cannot be undone.')) return
    await clearAll()
    setStatus({ kind: 'ok', text: 'Everything was deleted.' })
  }

  return (
    <Sheet title="Settings & backup" onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat value={items.length} label="items" />
        <Stat value={outfits.length} label="outfits" />
        <Stat value={usage === null ? '—' : formatBytes(usage)} label="used" />
      </div>

      <label className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-ink">Currency</span>
          <span className="mt-0.5 block text-stone-500">For prices and cost per wear.</span>
        </span>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="chip chip-off appearance-none pr-3.5 font-medium"
          aria-label="Currency"
        >
          {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-5 text-sm text-stone-600">
        Your wardrobe is stored only on this device, in this browser. Download a backup now and then. You can also use a
        backup to move your wardrobe to another phone or computer.
      </p>

      <div className="mt-5 grid gap-2">
        <button className="btn-ghost justify-start" onClick={doExport} disabled={busy || !items.length}>
          <DownloadIcon size={18} /> Download backup
        </button>
        <button className="btn-ghost justify-start" onClick={() => importInput.current?.click()} disabled={busy}>
          <UploadIcon size={18} /> Restore from backup
        </button>
        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            doImport(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          className="btn justify-start bg-transparent text-red-600 hover:bg-red-50"
          onClick={doClear}
          disabled={busy || (!items.length && !outfits.length)}
        >
          <TrashIcon size={18} /> Delete everything
        </button>
      </div>

      {busy && <p className="mt-4 text-sm text-stone-500">Working…</p>}
      {status && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            status.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-stone-600 ring-1 ring-stone-200">
        <p className="font-semibold text-ink">Use it like an app</p>
        <p className="mt-1">
          On your phone, open the browser menu and choose <em>Add to Home Screen</em> to get a full-screen wardrobe app
          icon.
        </p>
      </div>
    </Sheet>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-white py-3 ring-1 ring-stone-200">
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  )
}
