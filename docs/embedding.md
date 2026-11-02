# Embedding

Export and share → Embed pyramid generates iframe code and an `/embed/` preview link.
Choose the current cameras or overview, frame height, layout, tilt, grid, figure,
minimaps, view controls, zoom-table button, source/app controls, and image-to-pyramid sync.
The Allmaps IIIF Pyramid title stays in the top left, including when controls are hidden,
and opens the same image or manifest in the main app in a new tab. The `header`
option controls the source picker and extra app links, not this title.
Scroll-wheel zoom defaults off so an embed does not capture page scrolling.
Choose **Pyramid only · hide image view** to omit the image canvas and inset.
This also omits image sync, the position figure, and the full/split toggle.

The embed route uses the same source parameters as the explorer. Options:

| Parameter                                 | Values                                                                    | Default   |
| ----------------------------------------- | ------------------------------------------------------------------------- | --------- |
| `layout`                                  | `split`, `image` (pyramid inset), `pyramid` (image inset), `pyramid-only` | `split`   |
| `pyramidLayout`                           | `stacked`, `adjacent`                                                     | `stacked` |
| `tilt`                                    | `left`, `right`                                                           | `right`   |
| `header`, `table`, `figure`, `scrollZoom` | `0`, `1`                                                                  | `0`       |
| `controls`, `minimaps`, `grid`, `sync`    | `0`, `1`                                                                  | `1`       |

For example: `/embed?url=https%3A%2F%2Fiiif.micr.io%2FhsdOg&layout=pyramid&minimaps=0`.
Use a public deployment or tunnel URL when embedding on another site. The static
host must allow iframe embedding, and the browser must permit service workers
in the frame. Prerendered route directories support direct links; see
[Deployment](deployment.md).

[Back to README](../README.md)
