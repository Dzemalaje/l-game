/**
 * The shape both platform implementations of the animation layer agree on.
 *
 * Kept apart from the implementations so the native stub and the Motion One version cannot drift,
 * and so a component can import the types without pulling a web-only library into a native bundle.
 */
import type { Ref } from "react";

/** The `data-lg` tags carried by the board's SVG shapes, which Motion selects on. */
export type MotionKind = "target" | "drawn" | "piece" | "disc" | "disc-ready" | "ghost";

export interface MotionHandle {
  /** Attach to the element that contains the animated shapes. */
  ref: Ref<never>;
  /** Play the "that is not a legal square" shake. */
  reject: () => void;
}

export interface BoardMotionSignature {
  targets: string;
  drawn: string;
  /** One entry per occupied square, so only squares that changed get animated. */
  pieces: string;
  discs: string;
  held: boolean;
  /** The discs have just become movable, which the halo announces. */
  discsMovable: boolean;
  reduced: boolean;
}

/**
 * The occupied squares in `after` that were not occupied in `before`.
 *
 * Placing an L rewrites the whole piece signature, so animating on any change re-popped the
 * opponent's piece in place on every move - motion with nothing behind it, which reads as a flicker
 * rather than as feedback. Only genuinely new squares should move.
 *
 * An empty `before` means the first paint, where nothing should animate at all.
 */
export function addedCells(before: string, after: string): string[] {
  if (!before || before === after) return [];
  const previous = new Set(before.split(","));
  return after.split(",").filter((cell) => cell && !previous.has(cell));
}
