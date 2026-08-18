export type Rgb = readonly [number, number, number];

export interface PieceSkin {
  name: string;
  /** One name per side. Side identity must survive a recolour, so the palette names the sides too. */
  sides: [string, string];
  colors: [Rgb, Rgb];
}

export interface BoardSkin {
  name: string;
  light: Rgb;
  dark: Rgb;
  outline: Rgb;
}

export const css = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;

/**
 * The same colour at a given opacity, for tinting a surface with a side's identity.
 *
 * Written as `rgba(...)` rather than an eight-digit hex or a slash-separated `rgb()`, because those
 * two forms are where React Native and the browser disagree; this one both accept.
 */
export const cssAlpha = ([r, g, b]: Rgb, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/**
 * Piece skins are plain colour pairs rather than animated effects. Every pair keeps one warm and
 * one cool side so the two players stay distinguishable at a glance, and both stay legible on the
 * cream-and-sage board.
 */
export const PIECE_SKINS: PieceSkin[] = [
  { name: "Classic", sides: ["Red", "Blue"], colors: [[207, 92, 79], [71, 120, 173]] },
  { name: "Orchard", sides: ["Plum", "Teal"], colors: [[154, 76, 122], [45, 133, 128]] },
  { name: "Ember", sides: ["Amber", "Indigo"], colors: [[206, 137, 52], [92, 92, 166]] },
  { name: "Foundry", sides: ["Rust", "Steel"], colors: [[176, 88, 62], [88, 112, 136]] },
  { name: "Orchid", sides: ["Rose", "Violet"], colors: [[201, 96, 122], [117, 96, 176]] },
  { name: "Signal", sides: ["Coral", "Slate"], colors: [[218, 106, 84], [70, 84, 104]] },
];

export const BOARD_SKINS: BoardSkin[] = [
  { name: "Sage", light: [232, 223, 201], dark: [145, 168, 120], outline: [56, 86, 60] },
  { name: "Linen", light: [240, 236, 226], dark: [198, 190, 172], outline: [122, 114, 96] },
  { name: "Walnut", light: [226, 205, 176], dark: [154, 118, 84], outline: [92, 66, 44] },
  { name: "Harbour", light: [226, 232, 231], dark: [136, 165, 168], outline: [52, 82, 88] },
  { name: "Graphite", light: [222, 221, 216], dark: [136, 138, 140], outline: [62, 64, 66] },
  { name: "Clay", light: [238, 226, 213], dark: [190, 148, 128], outline: [110, 74, 60] },
];

export const pieceSkin = (index: number) => PIECE_SKINS[clamp(index, PIECE_SKINS.length)];
export const boardSkin = (index: number) => BOARD_SKINS[clamp(index, BOARD_SKINS.length)];

const clamp = (index: number, length: number) =>
  Number.isFinite(index) ? Math.min(Math.max(Math.trunc(index), 0), length - 1) : 0;
