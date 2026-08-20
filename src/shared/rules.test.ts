import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_PLACEMENTS,
  allCompleteMoves,
  applyCompleteMove,
  boardSignature,
  chooseCpuMove,
  cloneState,
  initialState,
  isLegalLPlacement,
  legalContinuations,
  legalLPlacementCount,
  legalLPlacements,
  legalNeutralDestinations,
  maskOf,
  parseMove,
  parsePreview,
  parseState,
  pathsForPlacement,
  placementForDraw,
  sameCell,
} from "./rules";
import type { Cell, GameState } from "./types";
import { TRAPPED_POSITION } from "./positions";

/** Small Jest-style facade keeps these domain tests readable while using Node's built-in runner. */
function expect<T>(actual: T, message?: string) {
  return {
    toBe(expected: unknown) { assert.strictEqual(actual, expected, message); },
    toEqual(expected: unknown) { assert.deepStrictEqual(actual, expected, message); },
    toHaveLength(expected: number) { assert.strictEqual((actual as { length: number }).length, expected, message); },
    toBeGreaterThan(expected: number) { assert.ok(Number(actual) > expected, message); },
    toBeDefined() { assert.notStrictEqual(actual, undefined, message); },
    toBeUndefined() { assert.strictEqual(actual, undefined, message); },
    not: {
      toBe(expected: unknown) { assert.notStrictEqual(actual, expected, message); },
    },
  };
}

const sortedKey = (cells: readonly Cell[]) =>
  cells.map(([x, y]) => y * 4 + x).sort((a, b) => a - b).join(",");

describe("placement enumeration", () => {
  it("enumerates the 48 distinct placements on an empty board", () => {
    expect(new Set(ALL_PLACEMENTS.map(sortedKey)).size).toBe(48);
  });

  it("gives every placement exactly two drawable paths", () => {
    for (const placement of ALL_PLACEMENTS) {
      const paths = pathsForPlacement(placement);
      expect(paths).toHaveLength(2);
      for (const path of paths) {
        expect(sortedKey(path)).toBe(sortedKey(placement));
        for (let i = 1; i < path.length; i++) {
          const step = Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
          expect(step).toBe(1);
        }
      }
    }
  });
});

describe("legality", () => {
  it("never offers the current placement or an occupied cell", () => {
    const state = initialState();
    const moves = legalLPlacements(state, 0);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) expect(isLegalLPlacement(state, 0, move)).toBe(true);
    expect(isLegalLPlacement(state, 0, state.pieces[0])).toBe(false);
    expect(legalLPlacementCount(state, 0)).toBe(moves.length);
  });

  it("lets the L overlap the squares it is vacating but not the opponent or a disc", () => {
    const state = initialState();
    const blocked = maskOf(state.pieces[1]) | maskOf(state.neutrals);
    for (const placement of legalLPlacements(state, 0)) {
      expect(maskOf(placement) & blocked).toBe(0);
    }
    // (0,0),(0,1),(0,2),(1,2) is red's own start; sliding down one row still uses two of its cells.
    expect(isLegalLPlacement(state, 0, [[0, 1], [0, 2], [0, 3], [1, 3]])).toBe(true);
  });

  it("rejects shapes that are not L tetrominoes", () => {
    const state = initialState();
    expect(isLegalLPlacement(state, 0, [[0, 0], [1, 0], [0, 1], [1, 1]])).toBe(false);
    expect(isLegalLPlacement(state, 0, [[0, 3], [1, 3], [2, 3], [3, 3]])).toBe(false);
    expect(isLegalLPlacement(state, 0, [[0, 0], [0, 0], [0, 1], [0, 2]])).toBe(false);
  });
});

describe("applying a complete turn", () => {
  it("applies a turn and changes the active player", () => {
    const state = initialState();
    const l = legalLPlacements(state, 0)[0];
    const preview = cloneState(state);
    preview.pieces[0] = l;
    const destination = legalNeutralDestinations(preview)[0];
    expect(applyCompleteMove(state, { l, neutral: 0, destination })).toBe(true);
    expect(state.turn).toBe(1);
    expect(state.turnNumber).toBe(2);
    expect(state.neutrals[0]).toEqual(destination);
  });

  // Regression: the previous implementation wrote the L before validating the disc destination, so a
  // rejected move left the authoritative board half-updated for both players.
  it("leaves the state untouched when the disc destination is illegal", () => {
    const state = initialState();
    const before = JSON.stringify(state);
    const l = legalLPlacements(state, 0)[0];
    expect(applyCompleteMove(state, { l, neutral: 0, destination: state.pieces[1][0] })).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(applyCompleteMove(state, { l, neutral: 1, destination: [9, 9] as Cell })).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(applyCompleteMove(state, { l, neutral: 0, destination: undefined })).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("lets a disc move onto a square the L just vacated", () => {
    const state = initialState();
    const vacated: Cell = [0, 0];
    const l = legalLPlacements(state, 0).find((placement) =>
      !placement.some((cell) => sameCell(cell, vacated)))!;
    expect(applyCompleteMove(state, { l, neutral: 0, destination: vacated })).toBe(true);
    expect(state.neutrals[0]).toEqual(vacated);
  });

  it("awards the win when the next player has no legal L", () => {
    // Blue's L is boxed into the bottom-right corner by red plus both discs.
    const state: GameState = {
      pieces: [[[1, 0], [1, 1], [1, 2], [2, 2]], [[3, 3], [3, 2], [3, 1], [2, 1]]],
      neutrals: [[2, 3], [2, 0]],
      turn: 0,
      winner: -1,
      turnNumber: 5,
    };
    const trapped = legalLPlacements(state, 0).find((l) => {
      const next = cloneState(state);
      return applyCompleteMove(next, { l, neutral: -1 }) && next.winner === 0;
    });
    if (trapped) {
      const next = cloneState(state);
      applyCompleteMove(next, { l: trapped, neutral: -1 });
      expect(next.winner).toBe(0);
      expect(legalLPlacementCount(next, 1)).toBe(0);
    } else {
      expect(legalLPlacementCount(state, 1)).toBeGreaterThan(0);
    }
  });
});

describe("drawing", () => {
  it("only offers continuations that can still complete a legal L", () => {
    const state = initialState();
    const drawn: Cell[] = [];
    for (let step = 0; step < 4; step++) {
      const options = legalContinuations(state, 0, drawn);
      expect(options.length).toBeGreaterThan(0);
      expect(new Set(options.map((cell) => sortedKey([cell]))).size).toBe(options.length);
      drawn.push(options[0]);
    }
    expect(legalContinuations(state, 0, drawn)).toEqual([]);
    const placement = placementForDraw(state, 0, drawn);
    expect(placement).toBeDefined();
    expect(isLegalLPlacement(state, 0, placement!)).toBe(true);
  });

  it("rejects a four-cell draw that is not a traced path", () => {
    const state = initialState();
    // Correct L cells, but visited in an order that is not a connected stroke.
    expect(placementForDraw(state, 0, [[0, 1], [1, 3], [0, 3], [0, 2]])).toBeUndefined();
  });
});

describe("cpu", () => {
  it("returns a legal complete turn", () => {
    const state = initialState();
    state.turn = 1;
    const move = chooseCpuMove(state);
    expect(move).toBeDefined();
    expect(applyCompleteMove(state, move!)).toBe(true);
  });

  it("produces a reproducible sequence of legal turns", () => {
    const state = initialState();
    let seed = 0x1a2b3c4d;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    let turns = 0;
    while (state.winner < 0 && turns++ < 24) {
      const move = chooseCpuMove(state, random);
      expect(move, `no move at turn ${state.turnNumber}`).toBeDefined();
      expect(applyCompleteMove(state, move!)).toBe(true);
    }
    expect(state.turnNumber).toBeGreaterThan(1);
  });

  it("agrees with the exhaustive move list about what is available", () => {
    const state = initialState();
    const exhaustive = allCompleteMoves(state, 0);
    expect(exhaustive.length).toBeGreaterThan(0);
    for (const move of exhaustive.slice(0, 50)) {
      const next = cloneState(state);
      expect(applyCompleteMove(next, move)).toBe(true);
    }
  });
});

describe("board signature", () => {
  // Regression: the client used to discard a half-drawn L on every snapshot. The server sends one
  // per second just to sync the clocks, so a player could never finish drawing in an online match.
  it("is stable across snapshots that only carry the clock", () => {
    const state = initialState();
    const resent = parseState(JSON.parse(JSON.stringify(state)))!;
    expect(boardSignature(resent)).toBe(boardSignature(state));
  });

  it("changes when any piece, disc, turn or result moves", () => {
    const base = initialState();
    const signature = boardSignature(base);

    const moved = cloneState(base);
    applyCompleteMove(moved, { l: legalLPlacements(moved, 0)[0], neutral: -1 });
    expect(boardSignature(moved)).not.toBe(signature);

    const discMoved = cloneState(base);
    const l = legalLPlacements(discMoved, 0)[0];
    const preview = cloneState(discMoved);
    preview.pieces[0] = l;
    applyCompleteMove(discMoved, { l, neutral: 1, destination: legalNeutralDestinations(preview)[0] });
    expect(boardSignature(discMoved)).not.toBe(boardSignature(moved));

    const won = cloneState(base);
    won.winner = 0;
    expect(boardSignature(won)).not.toBe(signature);
  });
});

describe("wire hardening", () => {
  it("round-trips a valid state", () => {
    const state = initialState();
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects malformed or impossible states", () => {
    expect(parseState(null)).toBeUndefined();
    expect(parseState({ pieces: [[], []], neutrals: [[0, 0], [1, 1]] })).toBeUndefined();
    const overlapping = initialState();
    overlapping.neutrals[0] = [...overlapping.pieces[0][0]] as Cell;
    expect(parseState(JSON.parse(JSON.stringify(overlapping)))).toBeUndefined();
    const offBoard = initialState();
    offBoard.pieces[1][0] = [4, 0];
    expect(parseState(JSON.parse(JSON.stringify(offBoard)))).toBeUndefined();
    const notAnL = initialState();
    notAnL.pieces[0] = [[0, 0], [1, 0], [0, 1], [1, 1]];
    expect(parseState(JSON.parse(JSON.stringify(notAnL)))).toBeUndefined();
  });

  it("round-trips a turn in progress", () => {
    const l: Cell[] = [[1, 3], [1, 2], [1, 1], [0, 1]];
    expect(parsePreview({ drawn: [[1, 3], [1, 2]], neutral: -1 })).toEqual({
      drawn: [[1, 3], [1, 2]], l: undefined, neutral: -1, destination: undefined,
    });
    expect(parsePreview({ drawn: [], l, neutral: 0, destination: [0, 0] })).toEqual({
      drawn: [], l, neutral: 0, destination: [0, 0],
    });
  });

  it("rejects malformed previews without dropping the match", () => {
    expect(parsePreview(null)).toBeUndefined();
    expect(parsePreview({ drawn: [[9, 9]], neutral: -1 })).toBeUndefined();
    expect(parsePreview({ drawn: [[0, 0], [0, 0]], neutral: -1 })).toBeUndefined();
    // Five drawn cells, or an "L" that is not an L tetromino.
    expect(parsePreview({ drawn: [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1]], neutral: -1 })).toBeUndefined();
    expect(parsePreview({ l: [[0, 0], [1, 0], [0, 1], [1, 1]], neutral: -1 })).toBeUndefined();
    // A disc index with no destination is simply a selection, not an error.
    expect(parsePreview({ neutral: 1 })?.destination).toBeUndefined();
  });

  it("rejects malformed moves", () => {
    expect(parseMove({ l: [[0, 0]], neutral: -1 })).toBeUndefined();
    expect(parseMove({ l: [[0, 0], [0, 1], [0, 2], [9, 9]], neutral: -1 })).toBeUndefined();
    expect(parseMove({ l: [[0, 0], [0, 1], [0, 2], [1, 2]], neutral: 0 })).toBeUndefined();
    expect(parseMove({ l: [[0, 0], [0, 1], [0, 2], [1, 2]], neutral: -1 })).toEqual({
      l: [[0, 0], [0, 1], [0, 2], [1, 2]],
      neutral: -1,
      destination: undefined,
    });
  });
});

describe("the tutorial's finished position", () => {
  it("really is a win: the outlined L has no legal placement left", () => {
    const state: GameState = {
      pieces: [
        TRAPPED_POSITION.pieces[0].map((cell) => [...cell] as Cell),
        TRAPPED_POSITION.pieces[1].map((cell) => [...cell] as Cell),
      ],
      neutrals: [[...TRAPPED_POSITION.neutrals[0]] as Cell, [...TRAPPED_POSITION.neutrals[1]] as Cell],
      turn: 1,
      winner: -1,
      turnNumber: 12,
    };
    // The tutorial's last slide tells the player this is a win. If the move generator ever
    // disagrees, the lesson is teaching something false and this test is the only thing that says
    // so - the screen itself would look perfectly convincing.
    expect(legalLPlacementCount(state, 1)).toBe(0);
    // And it is a real position, not a stalemate for both: the winner still has moves.
    expect(legalLPlacementCount(state, 0)).toBeGreaterThan(0);
    // No piece or disc overlaps another.
    expect(maskOf([...state.pieces[0], ...state.pieces[1], ...state.neutrals])).not.toBe(-1);
  });
});
