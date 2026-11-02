# Manifests and Content State

`?iiif-content=` accepts a manifest URL, a Content State URL, raw JSON, or a
base64url-encoded Content State. `?manifest=` and the existing `?url=` also work.
Content State parsing uses `@iiif/helpers` (also used by the Theseus viewer), and
manifest/image parsing uses `@allmaps/iiif-parser`.

Canvas targets retain their `partOf` manifest. Fragment selectors (`xywh`, pixel
or percent) open the requested canvas region, converting canvas coordinates to
image coordinates. Multiple targets open the first, with a notice. Unsupported
canvases are omitted with a notice. Use `?canvas=<canvas URI>` or zero-based
`?canvas-index=1` to open a page. Otherwise the manifest's starting canvas or its
first supported canvas is used.

The loaded-resource control combines the source chooser with previous/next canvas
buttons and a page picker. It is available in both the explorer and Tile Hunt.
Click the resource title to open another image or manifest. Navigation buttons
are disabled while loading a canvas, and the numbering keeps a fixed width.
On smaller screens, a folder button before the previous/next arrows opens the
chooser beside the Allmaps logo. The chooser shows the full resource title and a canvas picker.
Opening errors appear directly under the URL input.

Shared links from a manifest include an encoded Content State in `iiif-content`,
as well as the app's exact cameras in the fragment. Share also offers **Copy IIIF
Content State** for other compatible viewers. Direct image services continue to
use `url` links because they have no canvas/manifest context.

See the [IIIF Content State specification](https://iiif.io/api/content-state/1.0/).
A [five-page example manifest](https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json)
from the IIIF Cookbook can be pasted into the source chooser.

[Back to README](../README.md)
