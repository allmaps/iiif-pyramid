# Rendering and architecture

- Both surfaces use MapLibre GL 6.16's experimental `identity` projection.
  Image pixels are normalized into its flat coordinate space.
- `PlanarMapLayer` adapts Allmaps' existing MapLibre layer to a planar viewport.
  Allmaps still handles image loading, tile selection, caching and rendering.
  Cameras remain unpitched and unrotated.
- MapLibre owns container resizing and redraws the canvas synchronously, keeping
  loaded imagery visible while resizing. Automatic camera following pauses until
  the layout settles, including splitter drags and switching between layouts.
- Opening a different image replaces the Allmaps rendering layers, clearing old
  visibility and tile state while retaining the MapLibre surfaces and controls.
- Each pyramid plane is an affine, isometric warped map. Its footprint scales
  by the reciprocal of its IIIF scale factor. The explorer keeps its centered,
  overlapping stack by default. Settings also offer the adjacent layout used by
  Tile Hunt: complete planes along an isometric axis, with a gap of 4% of the
  smaller image's short side. Images wider than 2:1 align their left edges and
  step along the short side; other shapes align their top edges. Adjacent layers
  never overlap in either tilt direction. For extreme aspect ratios, stacked
  planes progressively center and space themselves by their short dimension,
  rather than leaving large gaps based on the image's length.
- Every plane has a distinct virtual IIIF service. It keeps the original image
  dimensions and pixel coordinates, while advertising only its represented
  resolution and coarser scale factors. For example, a 1:8 plane can request
  1:8, 1:16, etc., but never 1:4, 1:2 or 1:1. Zooming further magnifies that
  resolution. Only the finest plane can reach the original image's finest level.
- A service worker routes virtual tile requests to the original IIIF service,
  preserving region, size, rotation and quality. The page waits for service-worker
  control before creating Allmaps' tile workers. Tiles use the browser's normal
  HTTP cache; the app does not store a separate offline tile cache.
- SVG grids, active tiles, selection and viewport footprints use each warped
  map's transformer. Visible grid lines are generated on demand; the app does
  not construct polygons for every tile in a gigapixel image.
- Layer opacity is animated through Allmaps options. The minimap shows the
  pyramid camera footprint.

## Supported content and limitations

- IIIF Image API 2/3 and Presentation 2/3 image canvases with a tiled IIIF service.
  The first supported painting image per canvas is used; multi-image composition,
  collections, ranges, audiovisual targets, and authenticated services are not supported.
  Services must permit cross-origin browser requests. Query-bearing image service
  URLs are currently rejected.
- MapLibre's identity projection is experimental. The version is pinned, and
  the planar adapter is isolated for future API changes.

Tests cover resolution ceilings for both IIIF versions, exact forwarding of tile
requests, encoded identifiers, rectangular edge tiles and transformer round trips.

[Back to README](../README.md)
