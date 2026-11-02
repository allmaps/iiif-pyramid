import { tileAt } from './iiif.ts'
import type { ImageSource, Tile } from './iiif.ts'

export const roundCount = 5

export const difficulties = [
  {
    id: 'relaxed',
    label: 'Relaxed',
    description: 'Larger, recognizable regions, with fewer edge tiles.'
  },
  {
    id: 'challenging',
    label: 'Challenging',
    description: 'Smaller details, deeper in the pyramid.'
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'The finest third of the pyramid, with no tile-count limit.'
  }
] as const
export type Difficulty = (typeof difficulties)[number]['id']

/** Sample levels evenly within the chosen difficulty, then a tile within it. */
export function chooseTile(
  source: ImageSource,
  used: Set<string>,
  difficulty: Difficulty = 'challenging',
  random = Math.random
): Tile {
  const [minimum, maximum] = difficulty === 'relaxed' ? [4, 64] : [64, 65_536]
  let levels =
    difficulty === 'expert'
      ? source.levels.slice(-Math.ceil(source.levels.length / 3))
      : source.levels.filter(
          (level) => level.tileCount >= minimum && level.tileCount <= maximum
        )
  // Small or sparsely advertised pyramids still offer a playable challenge.
  if (!levels.length)
    levels = [
      source.levels.reduce((nearest, level) =>
        Math.abs(Math.log2(level.tileCount / minimum)) <
        Math.abs(Math.log2(nearest.tileCount / minimum))
          ? level
          : nearest
      )
    ]
  const pick = (length: number) =>
    Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
  let innerLevels =
    difficulty === 'relaxed'
      ? levels.filter((level) => level.columns > 2 && level.rows > 2)
      : []
  // A panorama can have only one or two tile rows. Avoid the ends of its
  // longer axis when a fully interior tile does not exist at these levels.
  if (difficulty === 'relaxed' && !innerLevels.length)
    innerLevels = levels.filter((level) => level.columns > 2 || level.rows > 2)
  const inset = (length: number) => (length > 2 ? 1 : 0)
  for (let attempt = 0; attempt < 100; attempt++) {
    const interior = innerLevels.length > 0 && random() < 0.85
    const choices = interior ? innerLevels : levels
    const level = choices[pick(choices.length)]
    const x = interior ? inset(level.columns) : 0
    const y = interior ? inset(level.rows) : 0
    const tile = tileAt(
      source,
      level,
      x + pick(level.columns - 2 * x),
      y + pick(level.rows - 2 * y)
    )
    if (!used.has(tile.key)) return tile
  }
  for (const level of innerLevels)
    for (
      let row = inset(level.rows);
      row < level.rows - inset(level.rows);
      row++
    )
      for (
        let column = inset(level.columns);
        column < level.columns - inset(level.columns);
        column++
      ) {
        const tile = tileAt(source, level, column, row)
        if (!used.has(tile.key)) return tile
      }
  for (const level of levels)
    for (let row = 0; row < level.rows; row++)
      for (let column = 0; column < level.columns; column++) {
        const tile = tileAt(source, level, column, row)
        if (!used.has(tile.key)) return tile
      }
  // Tiny images can contain fewer than five distinct tiles.
  return tileAt(source, levels[0], 0, 0)
}

export function scoreGuess(target: Tile, guess: Tile, seconds: number) {
  const center = (tile: Tile) => [
    tile.region[0] + tile.region[2] / 2,
    tile.region[1] + tile.region[3] / 2
  ]
  const a = center(target),
    b = center(guess)
  const distance = Math.hypot(
    (a[0] - b[0]) / (target.level.tileWidth * target.level.scaleFactor),
    (a[1] - b[1]) / (target.level.tileHeight * target.level.scaleFactor)
  )
  const levelDistance = Math.abs(
    Math.log2(guess.level.scaleFactor / target.level.scaleFactor)
  )
  const accuracy = Math.exp(-distance / 3) * 2 ** -levelDistance
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 120
  const accuracyPoints = Math.round(800 * accuracy)
  const speedPoints = Math.round(
    200 * accuracy * Math.max(0, 1 - elapsed / 120)
  )
  return {
    total: accuracyPoints + speedPoints,
    accuracyPoints,
    speedPoints,
    distance,
    levelDistance,
    seconds: elapsed,
    exact: target.key === guess.key
  }
}
export type RoundResult = ReturnType<typeof scoreGuess>
