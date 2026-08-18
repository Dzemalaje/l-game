/**
 * The shape both platform implementations of the animation layer agree on.
 *
 * Kept apart from the implementations so the native stub and the Motion One version cannot drift,
 * and so a component can import the types without pulling a web-only library into a native bundle.
 */
import type { Ref } from "react";

/** The `data-lg` tags carried by the board's SVG shapes, which Motion selects on. */
export type MotionKind = "target" | "drawn" | "piece" | "disc";

export interface MotionHandle {
  /** Attach to the element that contains the animated shapes. */
  ref: Ref<never>;
  /** Play the "that is not a legal square" shake. */
  reject: () => void;
}

export interface BoardMotionSignature {
  targets: string;
  drawn: string;
  pieces: string;
  discs: string;
  held: boolean;
  reduced: boolean;
}
