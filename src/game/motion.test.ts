import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addedCells } from "./motionTypes";

/**
 * The board animates squares, not boards.
 *
 * Placing an L rewrites the whole signature, so an "animate on any change" rule re-played the
 * opponent's piece in place on every move of yours. That is motion with nothing behind it, and it
 * is what these cases exist to keep out.
 */
describe("piece animation targets", () => {
  test("nothing animates on the first paint", () => {
    assert.deepEqual(addedCells("", "0-0-0,0-0-1,1-3-3"), []);
  });

  test("nothing animates when no square changed", () => {
    const board = "0-0-0,0-0-1,1-3-3";
    assert.deepEqual(addedCells(board, board), []);
  });

  test("only the squares an L moved onto animate", () => {
    // Red slides down one row and keeps two of its squares; blue does not move at all.
    const before = "0-0-0,0-0-1,0-0-2,0-1-2,1-3-0,1-3-1,1-3-2,1-2-2";
    const after = "0-0-1,0-0-2,0-0-3,0-1-3,1-3-0,1-3-1,1-3-2,1-2-2";
    assert.deepEqual(addedCells(before, after), ["0-0-3", "0-1-3"]);
  });

  test("the opponent's untouched piece is never in the result", () => {
    const before = "0-0-0,0-0-1,1-3-3";
    const after = "0-1-0,0-1-1,1-3-3";
    assert.ok(!addedCells(before, after).some((cell) => cell.startsWith("1-")));
  });

  test("a piece leaving a square does not animate anything", () => {
    assert.deepEqual(addedCells("0-0-0,0-0-1,0-0-2", "0-0-0,0-0-1"), []);
  });
});
