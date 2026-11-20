// Removes the background from a clothing photo, entirely in the browser. The
// model runs in a Web Worker (see backgroundWorker.ts), which is only started
// the first time someone asks for a cut-out.
import type { WorkerRequest, WorkerResponse } from './backgroundWorker'
import { applyMask, type Mask, type ProcessedPhoto } from './image'

/** Model download progress in bytes; only reported until the model is cached. */
export type DownloadProgress = { loaded: number; total: number }

interface Pending {
  resolve: (mask: Mask) => void
  reject: (error: Error) => void
  onProgress?: (p: DownloadProgress) => void
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./backgroundWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data
    if (msg.type === 'progress') {
      for (const p of pending.values()) p.onProgress?.(msg)
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'result') p.resolve({ data: msg.mask, width: msg.width, height: msg.height })
    else
      p.reject(
        new Error(
          msg.loading
            ? "Couldn't download the background remover. Check your internet connection and try again."
            : `Background removal failed: ${msg.message}`,
        ),
      )
  }
  worker.onerror = (e) => {
    // The worker itself crashed (e.g. out of memory); fail everything and start fresh next time.
    for (const p of pending.values()) p.reject(new Error(`Background removal failed: ${e.message || 'worker error'}`))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

/**
 * Cuts the item out of `photo` (a processed JPEG), returning a transparent,
 * trimmed image and thumbnail plus the item's color without the background.
 */
export async function removeBackground(photo: Blob, onProgress?: (p: DownloadProgress) => void): Promise<ProcessedPhoto> {
  const id = nextId++
  const mask = await new Promise<Mask>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ id, image: photo } satisfies WorkerRequest)
  })
  try {
    return await applyMask(photo, mask)
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message.startsWith('No item')
        ? "Couldn't find the item in this photo. Try a photo with the item on a plain background."
        : `Background removal failed: ${e}`,
    )
  }
}
