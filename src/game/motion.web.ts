/**
 * Motion One animations for the web build.
 *
 * The board is React Native SVG, which on web renders real `<rect>`/`<circle>` DOM nodes and passes
 * unrecognised props straight through. That is what makes this possible: the shapes carry `data-lg`
 * attributes, and Motion's scoped `animate` finds them with an ordinary selector instead of the
 * component tree threading sixteen refs around.
 *
 * Everything here runs from an effect, so the static web export renders without touching Motion.
 */
import { useEffect, useRef } from "react";
import { useAnimate, useReducedMotion as useMotionReducedMotion, stagger } from "motion/react";
import type { MotionHandle, MotionKind } from "./motionTypes";

/** Honours the operating system's "reduce motion" setting. */
export function useReducedMotion() {
  return useMotionReducedMotion() ?? false;
}

/** Matches the shapes tagged in GameBoard. */
const selector = (kind: MotionKind) => `[data-lg="${kind}"]`;

const SPRING = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 } as const;

export function useBoardMotion(signature: {
  targets: string;
  drawn: string;
  pieces: string;
  discs: string;
  held: boolean;
  reduced: boolean;
}): MotionHandle {
  const [scope, animate] = useAnimate();
  // First paint should not animate: the board would otherwise pop on every mount, including the
  // one that happens the moment a match opens.
  const seen = useRef({ targets: "", drawn: "", pieces: "", discs: "" });

  const { targets, drawn, pieces, discs, held, reduced } = signature;

  useEffect(() => {
    if (reduced || !scope.current) return;
    const first = seen.current.targets === "";
    seen.current.targets = targets;
    if (first) return;
    const nodes = scope.current.querySelectorAll(selector("target"));
    if (!nodes.length) return;
    animate(nodes, { opacity: [0, 0.62], scale: [0.3, 1] }, { duration: 0.24, delay: stagger(0.018) });
  }, [animate, reduced, scope, targets]);

  useEffect(() => {
    if (reduced || !scope.current) return;
    const grew = drawn.length > seen.current.drawn.length;
    seen.current.drawn = drawn;
    if (!grew) return;
    const nodes = scope.current.querySelectorAll(selector("drawn"));
    const last = nodes[nodes.length - 1];
    if (!last) return;
    // Only the square just added pops; re-animating the whole path on every step reads as a flicker.
    animate(last, { scale: [0.55, 1], opacity: [0.35, 1] }, { ...SPRING });
  }, [animate, drawn, reduced, scope]);

  useEffect(() => {
    if (reduced || !scope.current) return;
    const first = seen.current.pieces === "";
    const changed = seen.current.pieces !== pieces;
    seen.current.pieces = pieces;
    if (first || !changed) return;
    const nodes = scope.current.querySelectorAll(selector("piece"));
    if (!nodes.length) return;
    animate(nodes, { scale: [0.82, 1] }, { ...SPRING, delay: stagger(0.02) });
  }, [animate, pieces, reduced, scope]);

  useEffect(() => {
    if (reduced || !scope.current) return;
    const first = seen.current.discs === "";
    const changed = seen.current.discs !== discs;
    seen.current.discs = discs;
    if (first || !changed) return;
    const nodes = scope.current.querySelectorAll(selector("disc"));
    if (!nodes.length) return;
    // cx/cy are SVG presentation attributes; Motion animates them directly, so a disc glides to its
    // new square instead of teleporting.
    animate(nodes, { scale: [0.88, 1] }, { ...SPRING });
  }, [animate, discs, reduced, scope]);

  useEffect(() => {
    if (reduced || !scope.current) return;
    const nodes = scope.current.querySelectorAll(`${selector("disc")}[data-held="true"]`);
    if (!nodes.length) return;
    animate(nodes, { scale: held ? 1.12 : 1 }, { duration: 0.16 });
  }, [animate, held, reduced, scope]);

  return {
    ref: scope,
    reject: () => {
      if (reduced || !scope.current) return;
      // A refusal has to be felt, not read. Two small counter-shakes are enough to say "not there"
      // without the board looking broken.
      void animate(scope.current, { x: [0, -7, 6, -3, 0] }, { duration: 0.28 });
    },
  };
}

/** Fades and lifts an element whenever `key` changes. Used for the status line and the seat bar. */
export function useChangeMotion(key: string, reduced: boolean) {
  const [scope, animate] = useAnimate();
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (reduced || !scope.current) return;
    void animate(scope.current, { opacity: [0, 1], y: [6, 0] }, { duration: 0.22 });
  }, [animate, key, reduced, scope]);
  return scope;
}

/** Plays an entrance once, when the element first appears. */
export function useEnterMotion(reduced: boolean, delay = 0) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    if (reduced || !scope.current) return;
    void animate(scope.current, { opacity: [0, 1], y: [10, 0], scale: [0.98, 1] }, { duration: 0.3, delay });
  }, [animate, delay, reduced, scope]);
  return scope;
}
