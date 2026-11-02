/// <reference lib="webworker" />
import {
  parseVirtualRequest,
  virtualPrefix,
  virtualImageInfo,
  virtualServiceUrl
} from './lib/virtual-iiif'
import type { ImageInfo } from './lib/virtual-iiif'

const worker = self as unknown as ServiceWorkerGlobalScope
const base = new URL(worker.registration.scope).pathname.replace(/\/$/, '')

worker.addEventListener('install', (event) =>
  event.waitUntil(worker.skipWaiting())
)
worker.addEventListener('activate', (event) =>
  event.waitUntil(worker.clients.claim())
)

worker.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    url.origin !== worker.location.origin ||
    !url.pathname.startsWith(`${base}${virtualPrefix}`)
  )
    return
  event.respondWith(
    (async () => {
      try {
        const request = parseVirtualRequest(url, base)!
        const response = await fetch(request.upstream, {
          signal: event.request.signal,
          mode: 'cors',
          credentials: 'omit'
        })
        if (!response.ok || request.path !== 'info.json') return response
        const info = (await response.json()) as ImageInfo
        return Response.json(
          virtualImageInfo(
            info,
            virtualServiceUrl(
              `${url.origin}${base}`,
              request.source,
              request.scaleFactor
            ),
            request.scaleFactor
          )
        )
      } catch (error) {
        return new Response(
          error instanceof Error
            ? error.message
            : 'The tile could not be loaded.',
          { status: 502 }
        )
      }
    })()
  )
})
