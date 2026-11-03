export type FigureVariant = 'iiif' | 'iiif-open' | 'original'
export type FigurePalette = 'iiif' | 'app'
export const hunterOutfits = [
  { id: 'bicorne', title: 'Bicorne', detail: 'Gold trim and a cockade.' },
  {
    id: 'deerstalker',
    title: 'Deerstalker',
    detail: 'Checked tweed and a pocket magnifier.'
  },
  {
    id: 'alpine',
    title: 'Alpine hat',
    detail: 'A pheasant feather and a knotted scarf.'
  },
  {
    id: 'ranger',
    title: 'Ranger hat',
    detail: 'A broad felt brim and field binoculars.'
  }
] as const
export type HunterOutfit = (typeof hunterOutfits)[number]['id']
export const defaultHunterOutfit: HunterOutfit = 'alpine'
export type FigureOptions = {
  variant?: FigureVariant
  palette?: FigurePalette
}

export const figurePalettes = {
  iiif: { primary: '#ed1d33', secondary: '#2873ab' },
  app: { primary: '#ed3c9d', secondary: '#34543f' }
} satisfies Record<FigurePalette, { primary: string; secondary: string }>

// Original IIIF logo contours, supplied by the project. The red i stays upright;
// the two blue i's turn upside down, with their dots becoming the feet.
const blueI =
  'M8.7 150.83l94.67 35.17-.17 253.33-94.5-34.83z' +
  'M107.22 89.32c10.86 32.12-3.53 58.16-32.14 58.16S14.48 121.44 3.62 89.32C-7.24 57.2 7.15 31.16 35.76 31.16s60.6 26.04 71.46 58.16z'
const redI =
  'M223.81 150.83l-94.67 35.17.17 253.33 94.5-34.83z' +
  'M124.68 89.32c-10.86 32.12 3.53 58.16 32.14 58.16s60.6-26.04 71.46-58.16c10.86-32.12-3.53-58.16-32.14-58.16s-60.6 26.04-71.46 58.16z'
// Split f across its stem, just beneath the crossbar: a straight lower arm
// and an upper arm with the original curved, upturned end.
const upperF =
  'M493.37 0v87s-30.67-12-34.33 19c-.33 33 0 44.83 0 44.83l34.33-11.17v76.33l-34.48 12.33H364.7V126.67S362.7 13.33 493.37 0z'
const lowerF = 'M364.7 228.32h94.19v178l-94.19 35z'

type Matrix = [number, number, number, number, number, number]
export type FigurePart = {
  id: string
  path: string
  matrix: Matrix
  color: string
  outline: number
}

function part(
  id: string,
  path: string,
  color: string,
  origin: [number, number],
  anchor: [number, number],
  sx: number,
  sy: number,
  angle = 0
): FigurePart {
  const cos = Math.cos((angle * Math.PI) / 180)
  const sin = Math.sin((angle * Math.PI) / 180)
  const a = cos * sx,
    b = sin * sx,
    c = -sin * sy,
    d = cos * sy
  return {
    id,
    path,
    color,
    matrix: [
      a,
      b,
      c,
      d,
      anchor[0] - a * origin[0] - c * origin[1],
      anchor[1] - b * origin[0] - d * origin[1]
    ],
    outline: 1.25 / Math.abs(sx)
  }
}

/** Shared vector parts keep the live marker and canvas exports identical. */
export function iiifFigureParts(
  variant: Exclude<FigureVariant, 'original'>,
  palette: FigurePalette,
  extension = 0,
  invalid = false
): FigurePart[] {
  const t = Math.max(0, Math.min(1, extension))
  const mix = (rest: number, held: number) => rest + (held - rest) * t
  const { primary, secondary } = invalid
    ? { primary: '#8b9390', secondary: '#8b9390' }
    : figurePalettes[palette]
  const open = variant === 'iiif-open'
  const spread = mix(open ? 27 : 18, 48)
  const hip = mix(2.8, 3.2)
  return [
    part(
      'left-leg',
      blueI,
      secondary,
      [56, 439.33],
      [-hip, -20],
      0.045,
      -0.045,
      spread
    ),
    part(
      'right-leg',
      blueI,
      secondary,
      [56, 439.33],
      [hip, -20],
      -0.045,
      -0.045,
      -spread
    ),
    part(
      'left-arm',
      lowerF,
      primary,
      [411.795, 228.32],
      [-3, -34],
      0.05,
      0.05,
      mix(open ? 75 : 35, 135)
    ),
    part(
      'right-arm',
      upperF,
      primary,
      [411.795, 228.32],
      [3, -34],
      0.055,
      0.055,
      mix(open ? 70 : 40, 15)
    ),
    part('body', redI, primary, [176.475, 439.33], [0, -20], 0.065, 0.065)
  ]
}
