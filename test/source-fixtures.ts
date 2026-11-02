export const manifestUrl = 'https://example.org/manifest.json'
export const service = 'https://example.org/image'
export const info = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: service,
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level2',
  width: 4000,
  height: 2000,
  tiles: [{ width: 500, scaleFactors: [1, 2, 4, 8] }]
}
export const canvasId = (index: number) => `https://example.org/canvas/${index}`
export function manifest3() {
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifestUrl,
    type: 'Manifest',
    label: { en: ['Test book'] },
    items: [0, 1].map((index) => ({
      id: canvasId(index),
      type: 'Canvas',
      width: 2000,
      height: 1000,
      label: { en: [`Page ${index + 1}`] },
      items: [
        {
          id: `https://example.org/page/${index}`,
          type: 'AnnotationPage',
          items: [
            {
              id: `https://example.org/annotation/${index}`,
              type: 'Annotation',
              motivation: 'painting',
              target: canvasId(index),
              body: {
                id: `${service}/full/max/0/default.jpg`,
                type: 'Image',
                width: 4000,
                height: 2000,
                service: [
                  { id: service, type: 'ImageService3', profile: 'level2' }
                ]
              }
            }
          ]
        }
      ]
    }))
  }
}
export function manifest2() {
  return {
    '@context': 'http://iiif.io/api/presentation/2/context.json',
    '@id': manifestUrl,
    '@type': 'sc:Manifest',
    label: 'Test book v2',
    sequences: [
      {
        '@id': 'https://example.org/sequence',
        '@type': 'sc:Sequence',
        canvases: [0, 1].map((index) => ({
          '@id': canvasId(index),
          '@type': 'sc:Canvas',
          width: 2000,
          height: 1000,
          label: `Page ${index + 1}`,
          images: [
            {
              '@id': `https://example.org/annotation/${index}`,
              '@type': 'oa:Annotation',
              motivation: 'sc:painting',
              on: canvasId(index),
              resource: {
                '@id': `${service}/full/full/0/default.jpg`,
                '@type': 'dctypes:Image',
                width: 4000,
                height: 2000,
                service: {
                  '@context': 'http://iiif.io/api/image/2/context.json',
                  '@id': service,
                  profile: 'http://iiif.io/api/image/2/level2.json'
                }
              }
            }
          ]
        }))
      }
    ]
  }
}
