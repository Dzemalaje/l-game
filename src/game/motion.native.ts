/**
 * Native stub for the animation layer.
 *
 * Motion One is a DOM library, so it cannot run here. The board's own state changes still redraw
 * the SVG on native; what is missing is the tweening between those states, not the states. Keeping
 * the same hook signatures means no component needs a platform branch.
 */
import { useRef } from "react";
import type { BoardMotionSignature, MotionHandle } from "./motionTypes";

/** Native has no tweening layer here, so nothing ever needs reducing. */
export function useReducedMotion() {
  return true;
}

export function useBoardMotion(_signature: BoardMotionSignature): MotionHandle {
  const ref = useRef(null);
  return { ref, reject: () => undefined };
}

export function useChangeMotion(_key: string, _reduced: boolean) {
  return useRef(null);
}

export function useEnterMotion(_reduced: boolean, _delay = 0) {
  return useRef(null);
}
