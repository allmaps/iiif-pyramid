# Using Allmaps IIIF Pyramid

The floating info button opens About, with an explanation of the tile pyramid,
a short guide to the controls, and links to the original notebook and credits.
Close it with the close button, Escape, or a click outside the dialog.

Pan and zoom either view. The pyramid labels, clickable minimap layers, and
zoom-level table move both views to that resolution, even with following off.
The fit button beside each view's zoom controls returns to the overview.

Press `[` to move to the next coarser level or `]` for the next finer level in
both views, even with following off. Repeated presses step through the available
levels and stop at either end. In both the explorer and Tile Hunt, arrows select
adjacent tiles, Shift + arrow moves ten tiles, and Command (or Ctrl) + arrow jumps
to the end of the row or column. `+` / `-` zoom the active view; `0` fits it.
Level changes frame about five tiles across in the pyramid. Changing levels in the game keeps the guess at
the same image position. Shortcuts are inactive while typing, choosing a
form value, using a dialog or menu, or dragging the figure or splitter.

The pyramid’s settings button offers Stacked and Adjacent layouts, plus Tilt left and Tilt right. Changing the
direction preserves the image view and pyramid zoom; grids, labels, minimap,
figure, and PNG exports follow the chosen direction. The choice stays in place
when opening another image or switching layouts.

Tile highlights and viewport footprints use outlines without filling the image.
Enable **Fill tiles on hover** in Pyramid settings to tint the tile under the
pointer and its corresponding region in the other view, without moving either
camera. It starts off; the hover fill clears in both views when the pointer
leaves or navigation starts, and is not included in exports.

Both views have equally sized, independently collapsible minimaps that appear
only when zoomed in beyond the overview. Use the chevron to collapse or reopen
one. The image minimap uses a small IIIF preview with a live viewport outline; click it to
recenter, or use its arrow keys to pan. Collapsing a minimap leaves the camera
unchanged and preserves the choice when switching layouts, zooming, or opening images.
Image-minimap navigation uses `easeTo` to pan at a constant zoom. The pyramid
minimap keeps hover and active-level styling without a separate focus highlight.

The floating Table button opens a zoom-level overlay with the level index,
resolution, image and tile dimensions, columns, rows, total tiles and active
tiles. A totals row shows the number of levels, total tiles, and active tiles,
and stays visible while scrolling. Choose a resolution to close the overlay
and navigate both views. The table scrolls on smaller screens and supports
keyboard navigation. Shortcut hints are in About → Keyboard shortcuts.

Enable **Show tile details** in Pyramid settings, then click an image or pyramid
tile to inspect its original region, output size and IIIF URL. The setting starts
off; tile selection and navigation still work while the details panel is hidden.
A pyramid tile click centers the image on that tile at its resolution
before selecting it. Changing the image's resolution clears selections from
other levels. A new navigation gesture or Escape cancels a pending selection.

The figure button beside the pyramid's zoom controls toggles the image-position
figure and can be dragged onto any layer to place it, including while the figure
is hidden. Cancelling a drag restores its previous visibility. The figure starts enabled
only for pyramids spanning at least 256× between their coarsest and finest
resolutions; the choice applies until another image is opened. The figure stays
the same screen size, glides between positions, and follows camera movement
without trailing behind the pyramid. Reduced-motion preferences are respected.

Drag the figure onto a layer to move the image to that location and resolution,
even with following off. While picked up it changes pose, highlights the drop
layer, and holds the cameras still. Dropping outside the pyramid or pressing
Escape cancels the drag; arrow keys provide a keyboard alternative. A click
centers the pyramid on the existing position. The minimap retains its position
dot when the figure is hidden. If the figure is offscreen, its Image position
button brings it back. PNG exports respect the figure toggle.

The initial loading state uses the animated Allmaps loading icon.
Both surfaces fill the screen, with a floating Allmaps logo, source chooser, and
top menu. Typography (Geograph and DM Mono), round translucent buttons, dotted
background, and the fan-out export menu follow Allmaps Collage. The pyramid's
dots form an isometric lattice with 30° axes; the image keeps a square grid. Fonts load from
fonts.allmaps.org. The source picker sits beside the title. All modal dialogs
close on an outside click or Escape.
Drag the center divider button to resize the split. Arrow keys resize, Home/End
move to either limit, and Enter or double-click restores the center. On narrow
screens the divider moves vertically between stacked views.

The top menu has one Full view toggle. It remembers the most recent main view;
the inset's full button swaps views. Toggle Full view off to return to the split.
The inset has a soft shadow and no minimap; the main view keeps its minimap.
Drag its title to reposition it within the canvas. Arrow keys move a
focused handle (Shift moves farther); Escape cancels a drag. The position is
retained across layout changes and kept inside the canvas when resizing. Both
the inset and game tile card keep a 12 px gap from top and bottom controls,
including when moved by keyboard.
The title retains its compact rounded rectangle and drag handle. Loading uses
the transparent Allmaps animation at 30 px (16 px inline); the sharing preview
keeps the loader at that size rather than stretching it to the preview width.
The location button beside the pyramid zoom controls toggles image → pyramid
following on or off. Its filled icon and pressed state indicate that it is on.
Explicit tile, level, and position-figure choices still navigate the image.
Tile highlights and the viewport outline update throughout image navigation.
The figure and automatic pyramid flight wait for the image's movement to end,
then use its final position and resolution. During that flight the figure uses
its jumping-jack pose and follows the camera’s actual ground path and zoom.
MapLibre retains its own easing and automatically calculated duration. When
already centered it stays pinned while the pyramid moves beneath it. It relaxes
and regains its clipped ground shadow on arrival, with no trailing movement.
Other figure movements use the airborne pose too, including tile selection,
level changes and camera navigation. Starting another image gesture
stops the previous following flight so the camera cannot chase a stale target.
The image view uses MapLibre's `easeTo` for all camera animations, including
level and tile selection, figure drops, zoom buttons, and fitting the
view. The pyramid uses `flyTo` with its calculated duration. Reduced-motion
preferences are respected.

On loading a very large pyramid (at least a 256× resolution range), the pyramid
first shows the overview, then flies to frame the image's current layer once
the image viewport is available. This initial sync leaves the image camera in
place. It is skipped for shared camera positions and cancelled by navigation
or disabling image-to-pyramid sync. The overview button remains available to
return to the entire pyramid without restarting the initial animation.

Use Export and share → Download pyramid image to export a PNG.
Choose the current view or an overview of the entire pyramid, and a longest-side
resolution of 1,024, 2,048 or 4,096 pixels. The menu shows the resulting dimensions.
Overlays and a transparent background are optional. Current-view exports retain
the framing and layer opacity captured when the menu opens; overview exports fit
all planes at full opacity. A separate Allmaps renderer loads the required detail
tiles while preserving every plane's resolution ceiling. Exports leave both live
cameras untouched and can be cancelled while loading.

Export and share → Share current view captures both cameras and creates a preview locally.
Copy link restores the image, both centers and zooms, active resolution, split or
inset layout, splitter position, pyramid layout, tilt, grid, position figure, and image-to-pyramid sync.
Older two-way links become image-to-pyramid; pyramid-to-image links become no sync. The saved cameras remain in place until
navigation resumes, including with sync enabled. Different screen sizes retain
the same center and zoom.
The preview is a 1,200 × 630 px close-up of the position figure in the pyramid,
framed around nearby tiles, without header or footer bands. It always includes the figure and tile grid, even
when hidden in the live view. Higher layers fade to keep the current layer clear.
Both live cameras and the shared link retain their original positions and settings.
Download it as a PNG, or use Share image & link on browsers with file
sharing support. Copy link remains available if preview generation fails.
Closing the dialog cancels generation and releases its temporary image.
Nothing is uploaded: social sites cannot automatically fetch this client-generated
preview from the link; attach the PNG when posting. Links use the current origin,
so sharing outside your computer requires a public deployment or tunnel URL.

[Back to README](../README.md)
