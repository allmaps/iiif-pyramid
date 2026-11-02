import { exportPyramid } from './export-pyramid'
import { sharePreviewSnapshot } from './share-preview-view'
import type { ShareSnapshot } from './share-view'

/** Create a close-up of the position figure without moving the live cameras. */
export async function createSharePreview(
  snapshot: ShareSnapshot,
  signal: AbortSignal,
  onprogress: (message: string) => void
) {
  const closeup = sharePreviewSnapshot(snapshot.pyramid)
  const width = 1200
  const height = 630
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create a preview.')
  try {
    context.fillStyle = '#f3f8f3'
    context.fillRect(0, 0, canvas.width, canvas.height)
    signal.throwIfAborted()
    const result = await exportPyramid(
      closeup,
      { area: 'current', resolution: 2048, overlays: true, transparent: false },
      signal,
      onprogress
    )
    signal.throwIfAborted()
    const bitmap = await createImageBitmap(result.blob)
    try {
      context.drawImage(bitmap, 0, 0, width, height)
    } finally {
      bitmap.close()
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('Could not encode the preview.')),
        'image/png'
      )
    )
  } finally {
    canvas.width = canvas.height = 0
  }
}
