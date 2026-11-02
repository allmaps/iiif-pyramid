export type ImageInfo = {
  id?: string
  '@id'?: string
  '@context'?: unknown
  type?: string
  width: number
  height: number
  tiles?: { width: number; height?: number; scaleFactors: number[] }[]
  [key: string]: unknown
}

export const virtualPrefix = '/__pyramid/iiif/'

export function serviceUrl(value: string): string {
  const url = new URL(value.trim())
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('Enter an HTTP or HTTPS IIIF Image API URL.')
  url.hash = ''
  url.pathname = url.pathname.replace(/\/(?:info\.json)?$/, '')
  if (url.search)
    throw new Error('Use the image service URL without query parameters.')
  return url.href.replace(/\/$/, '')
}

export function virtualServiceUrl(
  origin: string,
  source: string,
  scaleFactor: number
): string {
  return `${origin}${virtualPrefix}${encodeURIComponent(source)}/${scaleFactor}`
}

/** Each service retains original pixel coordinates, but has its own finest level.
 * Coarser levels remain available for Allmaps' ordinary viewport tile selection. */
export function virtualImageInfo(
  info: ImageInfo,
  id: string,
  scaleFactor: number
): ImageInfo {
  const tiles = info.tiles
    ?.map((tileset) => ({
      ...tileset,
      scaleFactors: tileset.scaleFactors.filter(
        (factor) => factor >= scaleFactor
      )
    }))
    .filter((tileset) => tileset.scaleFactors.length)
  if (!tiles?.length)
    throw new Error('This resolution is not available from the image service.')
  return { ...info, ...(info['@id'] ? { '@id': id } : {}), id, tiles }
}

export function parseVirtualRequest(url: URL, base = '') {
  const prefix = `${base}${virtualPrefix}`
  if (!url.pathname.startsWith(prefix)) return undefined
  const [encoded, factor, ...parts] = url.pathname
    .slice(prefix.length)
    .split('/')
  const source = serviceUrl(decodeURIComponent(encoded))
  const scaleFactor = Number(factor)
  if (!Number.isSafeInteger(scaleFactor) || scaleFactor < 1)
    throw new Error('Invalid pyramid resolution.')
  const path = parts.join('/')
  if (
    path !== 'info.json' &&
    !/^(?:full|\d+,\d+,\d+,\d+)\/(?:max|full|\d+,\d*)\/0\/[\w-]+\.[\w]+$/.test(
      path
    )
  )
    throw new Error('Invalid IIIF tile request.')
  return { source, scaleFactor, path, upstream: `${source}/${path}` }
}
