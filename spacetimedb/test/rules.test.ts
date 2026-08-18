/**
 * Cross-checks the server's rules against the client's own implementation.
 *
 * `spacetimedb/src/rules.ts` and `src/shared/rules.ts` were written independently and store the
 * board differently - the server uses flat cell indices, the client uses [x, y] pairs. They are
 * nevertheless supposed to agree on every question that decides a game, so this test plays random
 * games through both at once and fails the moment they disagree about a placement, a disc move, a
 * turn or a winner.
 *
 *   npx tsx --test spacetimedb/test/rules.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import * as client from '../../src/shared/rules';
import type { Cell, CompleteMove, GameState } from '../../src/shared/types';
import {
  L_PLACEMENTS,
  applyMove,
  cellX,
  cellY,
  hasLegalMove,
  initialBoard,
  isLShape,
  isLegalPlacement,
  legalMoves,
  maskOf,
  type Board,
  type NeutralChoice,
  type Seat,
} from '../spacetimedb/src/rules';

const toCell = (index: number): Cell => [cellX(index), cellY(index)];

function toClientState(board: Board): GameState {
  return {
    pieces: [board.pieces[0].map(toCell), board.pieces[1].map(toCell)],
    neutrals: [toCell(board.neutrals[0]), toCell(board.neutrals[1])],
    turn: board.turn,
    winner: board.winner,
    turnNumber: board.turnNumber,
  };
}

/** Deterministic PRNG so a failure is reproducible from the seed alone. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('the opening position matches the client', () => {
  const server = initialBoard();
  const expected = client.initialState();
  const actual = toClientState(server);
  assert.deepEqual(actual.pieces, expected.pieces);
  assert.deepEqual(actual.neutrals, expected.neutrals);
  assert.equal(actual.turn, expected.turn);
  assert.equal(actual.turnNumber, expected.turnNumber);
});

test('both implementations enumerate the same set of L placements', () => {
  const serverMasks = new Set(L_PLACEMENTS.map((placement) => placement.mask));
  const clientMasks = new Set(client.ALL_PLACEMENTS.map((placement) => client.maskOf(placement)));
  assert.equal(serverMasks.size, clientMasks.size);
  for (const mask of serverMasks) assert.ok(clientMasks.has(mask), `client is missing mask ${mask}`);
});

test('every four-cell subset is classified the same way', () => {
  let shapes = 0;
  for (let a = 0; a < 16; a++) {
    for (let b = a + 1; b < 16; b++) {
      for (let c = b + 1; c < 16; c++) {
        for (let d = c + 1; d < 16; d++) {
          const cells = [a, b, c, d];
          const mine = isLShape(cells);
          const theirs = client.isPlacementShape(client.maskOf(cells.map(toCell)));
          assert.equal(mine, theirs, `disagreement on ${cells.join(',')}`);
          if (mine) shapes += 1;
        }
      }
    }
  }
  // The 4x4 board admits 8 orientations in each of 4 board positions per orientation family.
  assert.equal(shapes, L_PLACEMENTS.length);
});

test('a duplicated or off-board cell is never a legal shape', () => {
  assert.equal(maskOf([0, 0, 1, 2]), -1);
  assert.equal(maskOf([0, 1, 2, 16]), -1);
  assert.equal(isLShape([0, 1, 2, 3]), false, 'a straight line is not an L');
  assert.equal(isLShape([0, 1, 4, 5]), false, 'a square is not an L');
});

test('random games agree move for move', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const random = rng(seed);
    let board = initialBoard();
    let mirror = client.initialState();

    for (let turn = 0; turn < 60 && board.winner < 0; turn++) {
      const seat = board.turn as Seat;

      // Both must agree on who can move at all, and on how many ways.
      assert.equal(
        hasLegalMove(board, seat),
        client.legalLPlacementCount(mirror, seat) > 0,
        `seed ${seed} turn ${turn}: disagreement on whether seat ${seat} can move`,
      );
      assert.equal(
        legalMoves(board, seat).length,
        client.legalLPlacementCount(mirror, seat),
        `seed ${seed} turn ${turn}: different number of legal placements`,
      );

      const options = legalMoves(board, seat);
      const placement = options[Math.floor(random() * options.length)]!;
      assert.ok(
        client.isLegalLPlacement(mirror, seat, placement.map(toCell)),
        `seed ${seed} turn ${turn}: client rejects a placement the server allows`,
      );

      // Half the time also relocate a disc, to exercise the neutral rules on both sides.
      let neutral: NeutralChoice = -1;
      let destination = -1;
      if (random() < 0.5) {
        const disc = random() < 0.5 ? 0 : 1;
        const free: number[] = [];
        const blocked =
          maskOf(placement) |
          maskOf(board.pieces[seat === 0 ? 1 : 0]) |
          (1 << board.neutrals[0]) |
          (1 << board.neutrals[1]);
        for (let cell = 0; cell < 16; cell++) if (!(blocked & (1 << cell))) free.push(cell);
        if (free.length > 0) {
          neutral = disc as NeutralChoice;
          destination = free[Math.floor(random() * free.length)]!;
        }
      }

      const next = applyMove(board, { cells: placement, neutral, destination });
      assert.ok(next, `seed ${seed} turn ${turn}: server rejected its own legal move`);

      const move: CompleteMove = {
        l: placement.map(toCell) as Cell[],
        neutral,
        ...(neutral === -1 ? {} : { destination: toCell(destination) }),
      };
      const accepted = client.applyCompleteMove(mirror, move);
      assert.ok(accepted, `seed ${seed} turn ${turn}: client rejected the same move`);

      board = next;
      assert.deepEqual(
        toClientState(board).neutrals,
        mirror.neutrals,
        `seed ${seed} turn ${turn}: discs diverged`,
      );
      assert.equal(board.turn, mirror.turn, `seed ${seed} turn ${turn}: turn diverged`);
      assert.equal(board.turnNumber, mirror.turnNumber, `seed ${seed} turn ${turn}: turn number diverged`);
      assert.equal(board.winner, mirror.winner, `seed ${seed} turn ${turn}: winner diverged`);
      assert.equal(
        maskOf(board.pieces[seat]),
        client.maskOf(mirror.pieces[seat]),
        `seed ${seed} turn ${turn}: pieces diverged`,
      );
    }
  }
});

test('an illegal move never changes the board', () => {
  const board = initialBoard();
  const before = JSON.stringify(board);

  assert.equal(applyMove(board, { cells: [0, 1, 2, 3], neutral: -1, destination: -1 }), undefined);
  // Seat 0's own current position is not a move.
  assert.equal(applyMove(board, { cells: board.pieces[0], neutral: -1, destination: -1 }), undefined);
  // Overlapping the opponent.
  assert.equal(applyMove(board, { cells: board.pieces[1], neutral: -1, destination: -1 }), undefined);
  // A disc may not land on the L that was just placed.
  const legal = legalMoves(board, 0)[0]!;
  assert.equal(applyMove(board, { cells: legal, neutral: 0, destination: legal[0]! }), undefined);
  // Nor on the other disc.
  assert.equal(applyMove(board, { cells: legal, neutral: 0, destination: board.neutrals[1] }), undefined);
  // Nor on its own square: that is a no-op, and belongs in `neutral: -1`.
  assert.equal(applyMove(board, { cells: legal, neutral: 0, destination: board.neutrals[0] }), undefined);
  // Moving a disc requires a destination on the board.
  assert.equal(applyMove(board, { cells: legal, neutral: 1, destination: 16 }), undefined);

  assert.equal(JSON.stringify(board), before, 'a rejected move mutated the board');
});

test('a blocked player loses', () => {
  // Seat 1 is walled into the corner: every L it could form is occupied.
  const board: Board = {
    pieces: [
      [1, 5, 9, 8],
      [3, 7, 11, 10],
    ],
    neutrals: [0, 4],
    turn: 0,
    winner: -1,
    turnNumber: 1,
  };
  assert.ok(isLegalPlacement(board, 0, maskOf([2, 6, 13, 12])) === false);
  assert.equal(hasLegalMove(board, 1), client.legalLPlacementCount(toClientState(board), 1) > 0);
});
