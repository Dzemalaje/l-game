import { Platform } from "react-native";

/**
 * The one place the interface's colours, type and spacing live.
 *
 * The app is a dark room with a lit board in it: everything that is not the play surface sits in
 * near-black greens, and the board keeps the warm cream-and-sage palette from `skins.ts` untouched
 * so it reads as the only illuminated object on screen. Screens import from here rather than
 * writing hex literals, which is what keeps that relationship intact when one screen changes.
 */
export const COLOR = {
  /** App background, and the deeper tone used behind the board. */
  stage: "#0d1411",
  stageDeep: "#080d0b",
  /** Cards and rows. */
  panel: "#16211c",
  panelRaised: "#1f2d27",
  /** Text fields and the tab bar, which sit slightly below the page. */
  panelSunken: "#101a15",

  /** Hairlines, in rising strength. */
  edge: "#22302a",
  edgeMid: "#2c3b34",
  edgeStrong: "#33443e",

  /** Warm paper white, kept from the old palette so the type never looks blue-grey. */
  text: "#f2efe4",
  textDim: "#9fb0a6",
  textMuted: "#8b9d93",
  textFaint: "#71847a",
  textGhost: "#5d6f66",

  /** The single action colour. Dark ink sits on it, never white. */
  mint: "#7fd6a6",
  mintPress: "#6ac492",
  mintInk: "#08150e",

  /** Waiting, queueing, reconnecting. */
  amber: "#e8b562",
  /** Clock pressure, disconnection, destructive controls. */
  danger: "#e5695c",
  dangerPress: "#c9564a",

  /** The board's frame and the neutral discs, carried over from the printed-board palette. */
  boardFrame: "#3f5a48",
  boardFrameEdge: "#55755c",
  disc: "#f8f5ec",
  discRing: "rgba(56, 86, 60, 0.75)",
} as const;

/**
 * A hex colour at an opacity.
 *
 * Written as `rgba(...)` for the same reason `skins.ts` does: eight-digit hex and slash-separated
 * `rgb()` are the two forms React Native and the browser disagree about.
 */
export function alpha(hex: string, value: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${value})`;
}

/**
 * Archivo carries the interface and Azeret Mono carries the clocks and ratings, both loaded from
 * Google Fonts in `app/+html.tsx`. Native keeps the system face instead: loading webfonts there
 * would mean a new dependency and giving up the platform's own text scaling, which the board-first
 * layout depends on.
 */
export const FONT = {
  ui: Platform.select({ web: "Archivo, 'Helvetica Neue', Arial, sans-serif", default: undefined }),
  mono: Platform.select({
    web: "'Azeret Mono', ui-monospace, 'SF Mono', Menlo, monospace",
    ios: "Menlo",
    default: "monospace",
  }),
} as const;

/** Uppercase micro-labels: match type, turn badge, step counter, column headings. */
export const EYEBROW = {
  fontFamily: FONT.ui,
  fontSize: 10,
  fontWeight: "700",
  letterSpacing: 1.6,
  textTransform: "uppercase",
} as const;

/** Clocks, ratings and ranks, which have to stay scannable as the digits change. */
export const MONO = {
  fontFamily: FONT.mono,
  fontWeight: "700",
  letterSpacing: -0.3,
} as const;

export const RADIUS = {
  chip: 999,
  control: 14,
  card: 16,
  panel: 18,
  hero: 20,
  board: 20,
} as const;

/** The lift under the board, tinted with whichever side is on the move. */
export function boardGlow(color: string) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  } as const;
}
