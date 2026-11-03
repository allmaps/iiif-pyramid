# Allmaps IIIF Tile Hunt

Open `/game`, or use the floating gamepad button. An opening How to play dialog
explains the game and lists its shortcuts; the question-mark menu button reopens
it and pauses the clock. “Don’t show instructions on startup” remembers your
preference in this browser; the help button remains available. Enter starts play, submits a guess, advances to the next
tile, opens the final score, and starts a new game from that score. Escape exits the game (or closes
the current dialog first).
The pyramid fills a dark canvas with light isometric dots, a target tile and timer. Drag the figure onto
the matching tile, or click a tile to place it, then use Submit guess in the
single bottom control row. Skip (or `S`) advances immediately and records zero
points for that round, including in the final score. Each round starts with a tile selected on the uppermost
level. Five rounds ask for the tile's position and resolution. Buttons, overlays,
dialogs and shortcut badges use the same dark palette. The overview starts collapsed
on each game entry; expanding it does not change the explorer's minimap preference.
Choose difficulty in the explainer: Relaxed samples levels containing 4–64 tiles;
Challenging (the default) samples 64–65,536; Expert uses the finest third of the
available levels without a tile-count cap. Levels have equal odds within each
choice, then a tile is chosen uniformly within that level. Relaxed instead favors
interior tiles 85% of the time when available, avoiding the ends along the longer
axis for narrow panoramas. Smaller pyramids use
the nearest available level. Repeated tiles are avoided where possible. Changing
difficulty during a game offers **Start new game**. With a controller, left/right
in the explainer changes the difficulty and A confirms it.
Move the target card by dragging its image or title. The card stays
inside the canvas, and its handle also supports arrow keys.
Click or tap any visible tile to choose both its position and its resolution.
You can also drag the figure between levels, or change levels using a label,
the minimap, or `[` / `]`. Every game layer stays fully opaque.
Press `B` on the keyboard or controller, or use the grid button to show or hide tile
boundaries. Guess and answer outlines remain visible. This game preference
starts on and is separate from the explorer's grid setting.
The figure spreads its arms and legs while dragged, then relaxes when placed.
After placing it or finishing a series of keyboard/controller moves, the camera
flies to center the figure while retaining the current zoom. Changing levels
centers the figure at the new resolution, including near image edges. Free
panning remains available without automatically returning to the figure.
Its ground shadow is clipped to the image plane, including at image edges.
An exact guess launches red and blue IIIF confetti from the figure once the
camera settles. The shapes come from
[Open Maps Meeting](https://github.com/tu-delft-heritage/openmapsmeeting/blob/main/src/confetti.md)
and are animated with canvas-confetti. The effect respects reduced motion and
stops when advancing to another round or leaving the game.
The explorer and game share a persistent route layout and MapLibre canvas.
Switching modes updates the existing image transforms and retains cached tiles;
returning to the explorer restores its selected layout and previous camera without
animation, including when the explorer also uses adjacent layers. The game figure
is always active, so its controls omit the separate figure button.
Switching modes sets the pyramid's final panel size immediately while retaining
its tiles and tilt. Each game entry waits for MapLibre to finish resizing and
redrawing, fits the full pyramid immediately without animation, then flies to the
uppermost level with a fixed canvas size. Each new
round also starts at that level. The overview button still shows the entire
pyramid. Leaving
clears the game; returning restores the explorer's
split or inset layout.
The guess is outlined in pink and the answer in green. A solid pink arrow shows
the position correction on the guessed plane; a dashed green arrow connects to
the correct resolution. The camera frames both tiles and the connection, and the
vectors follow panning and zooming. Tilt is chosen in the explorer; the game
does not expose a settings menu. Each round
awards up to 800 accuracy points and 200 speed points; the latter decrease to
zero over 120 seconds and are weighted by accuracy. Distance is measured in
source tile widths/heights and wrong resolutions incur an additional penalty.
Timers wait for the hint, initial pyramid tiles, and framing animation; games
run entirely locally.
Changing image or canvas starts a
new game through the source picker. A final score dialog shows each round and
offers Play again; View score reopens it after dismissal.

Tile Hunt supports controllers exposed with the browser's
[standard Gamepad mapping](https://w3c.github.io/gamepad/#remapping). Press a
controller button once to make it available to the page. While connected, How
to play shows controller instructions and Xbox, PlayStation, or Nintendo button
labels; unplugging it restores the keyboard instructions. Mouse and keyboard
remain available throughout.

- Left stick / D-pad: move the figure one tile; hold to repeat. Stick clicks have no action.
- Left / right shoulder: coarser / finer level.
- Right stick: pan; left / right trigger: zoom out / in, proportional to pressure.
- Bottom face button: submit, next tile, or play again.
- Right face button (B / circle / Nintendo A): show or hide the grid during
  gameplay, or close the current popup. Use the back button or Escape to exit.
- Top / left face button: show the whole pyramid / locate your figure or result.
- Menu / Options / +: open or close the explainer.

Analog input has dead zones and moves the camera directly on animation frames.
Controls must be released after connecting, changing rounds/dialogs, or returning
to the tab, to prevent accidental submissions. Polling stops when leaving the
game; hidden or unfocused pages do not act on controller input. Browsers without
the API, restricted contexts, and controllers without a standard mapping keep
mouse and keyboard controls.

[Back to README](../README.md)
