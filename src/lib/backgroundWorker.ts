// Runs the background-removal model off the main thread. The model (~85 MB) is
// downloaded from Hugging Face on first use and then cached by the browser;
// photos never leave the device.
import { env, pipeline, RawImage, type ImageSegmentationPipeline } from '@huggingface/transformers'

export type WorkerRequest = { id: number; image: Blob }

export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; id: number; mask: Uint8Array; width: number; height: number }
  | { type: 'error'; id: number; message: string; loading: boolean }

const MODEL = 'briaai/RMBG-1.4'

env.allowLocalModels = false

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

let segmenter: Promise<ImageSegmentationPipeline> | null = null

const create = (device: 'webgpu' | 'wasm') =>
  pipeline('image-segmentation', MODEL, {
    device,
    // The 8-bit quantized model is half the size but leaves speckled holes in the mask.
    dtype: 'fp16',
    // RMBG-1.4 is an IS-Net model, but its config doesn't say so in a way the library recognizes.
    config: { model_type: 'isnet' } as never,
    progress_callback: (p) => {
      if (p.status === 'progress_total') post({ type: 'progress', loaded: p.loaded, total: p.total })
    },
  }) as Promise<ImageSegmentationPipeline>

// The GPU is many times faster; the CPU is the fallback where WebGPU is missing,
// or the GPU can't do fp16 math (e.g. NVIDIA GTX 10-series), or the GPU fails.
let useGpu = 'gpu' in navigator

async function createOnBestDevice() {
  if (useGpu) {
    try {
      return await create('webgpu')
    } catch {
      useGpu = false
    }
  }
  return create('wasm')
}

function load() {
  segmenter ??= createOnBestDevice().catch((e) => {
    segmenter = null // let the next request retry, e.g. after coming back online
    throw e
  })
  return segmenter
}

async function segment(image: RawImage) {
  try {
    return await (await load())(image)
  } catch (e) {
    // Some GPUs load the model but fail to run it; retry once on the CPU.
    if (!useGpu || !segmenter) throw e
    segmenter.then((s) => s.dispose()).catch(() => {})
    useGpu = false
    segmenter = null
    return (await load())(image)
  }
}

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const { id, image } = e.data
  let loading = true
  try {
    await load()
    loading = false
    const [{ mask }] = await segment(await RawImage.fromBlob(image))
    const data = new Uint8Array(mask.data)
    post({ type: 'result', id, mask: data, width: mask.width, height: mask.height }, [data.buffer])
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err), loading })
  }
})
