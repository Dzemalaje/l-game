/**
 * Authoritative rules for Edward de Bono's L Game on a 4x4 board.
 *
 * This module is pure: no I/O, no clock, no database, no randomness. Everything a client sends is
 * validated here, so a modified client can never advance the board into an illegal position.
 *
 * Cells are single integers `index = y * 4 + x` in `0..15`, and a position is a 16-bit mask where
 * bit `index` is set. Overlap checks are then a single AND, and the full table of legal L
 * placements is precomputed once when the module loads.
 */

export const BOARD_SIZE = 4;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** -1 means "no winner yet". */
export type Winner = -1 | 0 | 1;
export type Seat = 0 | 1;
/** -1 leaves both neutral discs where they are; 0 or 1 moves that disc to `destination`. */
export type NeutralChoice = -1 | 0 | 1;

export interface Board {
  /** Four cell indices per player, kept in the order the player drew them. */
  pieces: [number[], number[]];
  neutrals: [number, number];
  turn: Seat;
  winner: Winner;
  turnNumber: number;
}

export interface Move {
  cells: number[];
  neutral: NeutralChoice;
  /** Required when `neutral` is 0 or 1, ignored otherwise. */
  destination: number;
}

export function cellX(index: number): number {
  return index % BOARD_SIZE;
}

export function cellY(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

export function inBounds(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

/** Occupancy mask for `cells`, or -1 if any cell is off-board or repeated. */
export function maskOf(cells: readonly number[]): number {
  let mask = 0;
  for (const cell of cells) {
    if (!inBounds(cell)) return -1;
    const bit = 1 << cell;
    if (mask & bit) return -1;
    mask |= bit;
  }
  return mask;
}

/**
 * An L is a three-cell straight arm plus one cell beside either endpoint of that arm.
 * Used only to build {@link L_PLACEMENTS}; runtime checks use the precomputed table.
 */
function isLShapeByGeometry(cells: readonly number[]): boolean {
  if (cells.length !== 4 || maskOf(cells) < 0) return false;

  const points = cells.map((cell) => [cellX(cell), cellY(cell)] as const);

  for (const axis of [0, 1] as const) {
    const other = axis === 0 ? 1 : 0;
    for (let line = 0; line < BOARD_SIZE; line++) {
      const onLine = points.filter((point) => point[axis] === line);
      const offLine = points.filter((point) => point[axis] !== line);
      if (onLine.length !== 3 || offLine.length !== 1) continue;

      const values = onLine.map((point) => point[other]).sort((a, b) => a - b);
      const [first, middle, last] = values as [number, number, number];
      if (middle !== first + 1 || last !== middle + 1) continue;

      const off = offLine[0] as readonly [number, number];
      const besideLine = Math.abs(off[axis] - line) === 1;
      const besideEnd = off[other] === first || off[other] === last;
      if (besideLine && besideEnd) return true;
    }
  }
  return false;
}

/** Every legal L placement on an empty 4x4 board. Computed once, at module load. */
export const L_PLACEMENTS: ReadonlyArray<{ mask: number; cells: number[] }> = (() => {
  const placements: { mask: number; cells: number[] }[] = [];
  for (let a = 0; a < CELL_COUNT - 3; a++) {
    for (let b = a + 1; b < CELL_COUNT - 2; b++) {
      for (let c = b + 1; c < CELL_COUNT - 1; c++) {
        for (let d = c + 1; d < CELL_COUNT; d++) {
          const cells = [a, b, c, d];
          if (!isLShapeByGeometry(cells)) continue;
          placements.push({ mask: maskOf(cells), cells });
        }
      }
    }
  }
  return placements;
})();

const L_PLACEMENT_MASKS: ReadonlySet<number> = new Set(L_PLACEMENTS.map((placement) => placement.mask));

export function isLShape(cells: readonly number[]): boolean {
  if (cells.length !== 4) return false;
  const mask = maskOf(cells);
  return mask >= 0 && L_PLACEMENT_MASKS.has(mask);
}

/** The standard opening position: both Ls in opposite corners, discs on the remaining two. */
export function initialBoard(): Board {
  return {
    pieces: [
      [0, 4, 8, 9],
      [15, 11, 7, 6],
    ],
    neutrals: [1, 14],
    turn: 0,
    winner: -1,
    turnNumber: 1,
  };
}

export function opponentOf(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}

function neutralMask(board: Board): number {
  return (1 << board.neutrals[0]) | (1 << board.neutrals[1]);
}

/**
 * A placement is legal when it forms an L, does not sit exactly where the player's own L already
 * is, and does not overlap the opponent's L or either neutral disc.
 */
export function isLegalPlacement(board: Board, seat: Seat, mask: number): boolean {
  if (mask < 0 || !L_PLACEMENT_MASKS.has(mask)) return false;
  if (mask === maskOf(board.pieces[seat])) return false;
  const blocked = maskOf(board.pieces[opponentOf(seat)]) | neutralMask(board);
  return (mask & blocked) === 0;
}

/** True when `seat` has at least one legal L placement available. */
export function hasLegalMove(board: Board, seat: Seat): boolean {
  const ownMask = maskOf(board.pieces[seat]);
  const blocked = maskOf(board.pieces[opponentOf(seat)]) | neutralMask(board);
  for (const placement of L_PLACEMENTS) {
    if (placement.mask === ownMask) continue;
    if ((placement.mask & blocked) === 0) return true;
  }
  return false;
}

/** Every legal placement for `seat`. Used by tests and by any future bot. */
export function legalMoves(board: Board, seat: Seat): number[][] {
  const ownMask = maskOf(board.pieces[seat]);
  const blocked = maskOf(board.pieces[opponentOf(seat)]) | neutralMask(board);
  const moves: number[][] = [];
  for (const placement of L_PLACEMENTS) {
    if (placement.mask === ownMask) continue;
    if ((placement.mask & blocked) === 0) moves.push([...placement.cells]);
  }
  return moves;
}

export function cloneBoard(board: Board): Board {
  return {
    pieces: [[...board.pieces[0]], [...board.pieces[1]]],
    neutrals: [board.neutrals[0], board.neutrals[1]],
    turn: board.turn,
    winner: board.winner,
    turnNumber: board.turnNumber,
  };
}

/**
 * Applies a complete turn and returns the resulting board, or `undefined` if the move is illegal.
 *
 * The input board is never mutated: the L placement, the optional neutral relocation and the
 * resulting position are all validated before a new board is built.
 */
export function applyMove(board: Board, move: Move): Board | undefined {
  if (board.winner >= 0) return undefined;

  const seat = board.turn;
  const placementMask = maskOf(move.cells);
  if (move.cells.length !== 4) return undefined;
  if (!isLegalPlacement(board, seat, placementMask)) return undefined;

  const neutrals: [number, number] = [board.neutrals[0], board.neutrals[1]];

  if (move.neutral === 0 || move.neutral === 1) {
    const destination = move.destination;
    if (!inBounds(destination)) return undefined;

    // The disc may not land on the L that was just placed, on the opponent, or on either disc -
    // including its own square, since "moving" a disc onto itself is a no-op that belongs in
    // `neutral: -1`. Squares the mover's L just vacated are free, because `placementMask` is the
    // new position. This matches the client's rule exactly, so the server never accepts a turn the
    // client would reject.
    const occupied =
      placementMask |
      maskOf(board.pieces[opponentOf(seat)]) |
      (1 << neutrals[0]) |
      (1 << neutrals[1]);
    if ((1 << destination) & occupied) return undefined;

    neutrals[move.neutral] = destination;
  } else if (move.neutral !== -1) {
    return undefined;
  }

  const next = cloneBoard(board);
  next.pieces[seat] = [...move.cells];
  next.neutrals = neutrals;
  next.turn = opponentOf(seat);
  next.turnNumber += 1;
  // The loser is whoever has no legal placement left when their turn arrives.
  if (!hasLegalMove(next, next.turn)) next.winner = seat;
  return next;
}
