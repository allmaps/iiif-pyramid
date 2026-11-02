export type SyncMode = 'none' | 'image-to-pyramid'

/** Keep the original on/off shared links working. */
export function parseSyncMode(value: string | null): SyncMode | undefined {
  if (value === '0' || value === 'none' || value === 'pyramid-to-image')
    return 'none'
  if (value === '1' || value === 'both' || value === 'image-to-pyramid')
    return 'image-to-pyramid'
}
