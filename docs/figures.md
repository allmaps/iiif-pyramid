# Position figure alternatives

Visit `/figures` to compare the IIIF wave, wider open pose, app colors, and the
original figure at rest and while dragging. Each option links into the pyramid.
The IIIF figure reuses the supplied logo contours: the red i is the body, the
blue i's are inverted legs with dotted feet, and the f is split into two arms.
Dragging smoothly spreads the legs and raises both arms. Reduced-motion
preferences disable the transition.

`PositionFigure` accepts `variant="iiif" | "iiif-open" | "original"` and
`palette="iiif" | "app"`, defaulting to the IIIF wave and original red/blue.
Use `<PositionFigure variant="original" palette="app" />` for the previous figure.
`Pyramid` and `MapSurface` expose these as `figureVariant` and `figurePalette`;
the same choices are included in PNG exports and sharing previews. Optional
`figureStyle` and `figurePalette` URL parameters allow reviewing a choice in the
app and carry through to its shared links. Colors and shared SVG/canvas geometry
live in `iiif-figure.ts`. The source logo is retained in `src/lib/images/iiif-logo.svg`.

[Back to README](../README.md)
