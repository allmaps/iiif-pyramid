import { WarpedMapLayer } from '@allmaps/maplibre'
import { Viewport } from '@allmaps/render'
import { lonLatProjection } from '@allmaps/project'

/** Allmaps' stock MapLibre adapter assumes Mercator. This adapter shares its
 * renderer, tile selection and animations, but supplies a flat-space viewport.
 * Cameras stay unpitched and unrotated; the isometry is in each map's GCPs. */
export class PlanarMapLayer extends WarpedMapLayer {
  constructor() {
    super({
      projection: lonLatProjection,
      internalProjection: lonLatProjection,
      // Geometry remains static while opacity changes.
      animatedOptions: ['opacity'],
      renderGrid: false
    })
  }

  override render() {
    if (!this.map || !this.renderer) return
    const canvas = this.map.getCanvas()
    const width = canvas.clientWidth,
      height = canvas.clientHeight
    if (!width || !height) return
    const center = this.map.getCenter()
    const a = this.map.unproject([width / 2, height / 2])
    const b = this.map.unproject([width / 2 + 1, height / 2])
    const viewport = new Viewport(
      [width, height],
      [center.lng, center.lat],
      Math.abs(b.lng - a.lng),
      {
        projection: lonLatProjection,
        rotation: 0,
        devicePixelRatio: window.devicePixelRatio
      }
    )
    this.renderer.render(viewport)
  }
}
