import type { Cell } from "./types";

/**
 * A finished game, used by the tutorial to show what winning actually looks like.
 *
 * Player 1 has no legal L placement here at all, which is the win condition. That claim is not
 * eyeballed: `rules.test.ts` asserts it against the same move generator the match uses, so the
 * tutorial can never end up teaching a position that is not really a win.
 *
 *     . B B B
 *     R R R B
 *     . . R o
 *     . o . .
 */
export const TRAPPED_POSITION: { pieces: [Cell[], Cell[]]; neutrals: [Cell, Cell] } = {
  pieces: [
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [2, 0], [3, 0], [3, 1]],
  ],
  neutrals: [[3, 2], [1, 3]],
};
