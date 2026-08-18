import type { Cell, CompleteMove, GameState, NeutralChoice, Player, TurnPreview } from "./types";

// The 4x4 board fits in a 16-bit mask: cell (x, y) owns bit y * 4 + x. Every legal L placement on
// an empty board is enumerated once at module load, so move generation and mobility counts are
// integer tests instead of the array scans and string keys this used to build on every query.
// This mirrors scripts/l_game_rules.gd, which moved to the same representation for the same reason.

export const BOARD_SIZE = 4;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const FULL_BOARD = 0xffff;

const BASE_L: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2]];

export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export const inBounds = ([x, y]: Cell) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

export const bitOf = ([x, y]: Cell) => 1 << (y * BOARD_SIZE + x);

export const cellOf = (index: number): Cell => [index % BOARD_SIZE, Math.floor(index / BOARD_SIZE)];

/** Mask of the given cells, or -1 when any cell is off-board or duplicated. */
export function maskOf(cells: readonly Cell[]): number {
  let mask = 0;
  for (const cell of cells) {
    if (!inBounds(cell)) return -1;
    const bit = bitOf(cell);
    if (mask & bit) return -1;
    mask |= bit;
  }
  return mask;
}

export function cellsOf(mask: number): Cell[] {
  const cells: Cell[] = [];
  for (let index = 0; index < CELL_COUNT; index++) if (mask & (1 << index)) cells.push(cellOf(index));
  return cells;
}

function buildOrientations(): Cell[][] {
  const seen = new Set<number>();
  const result: Cell[][] = [];
  for (const reflected of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const transformed = BASE_L.map(([ox, oy]) => {
        let x = reflected ? -ox : ox;
        let y = oy;
        for (let r = 0; r < rotation; r++) [x, y] = [-y, x];
        return [x, y] as Cell;
      });
      const minX = Math.min(...transformed.map(([x]) => x));
      const minY = Math.min(...transformed.map(([, y]) => y));
      const normalized = transformed.map(([x, y]) => [x - minX, y - minY] as Cell);
      const shapeMask = maskOf(normalized);
      if (!seen.has(shapeMask)) {
        seen.add(shapeMask);
        result.push(normalized);
      }
    }
  }
  return result;
}

/**
 * A drawable path visits the four cells in order, each orthogonally adjacent to the previous one.
 * An L tetromino has exactly two ends, so every placement has exactly two paths — one per end.
 * Precomputing them turns "which square may I draw through next?" into an array lookup.
 */
function pathsOf(placement: readonly Cell[]): Cell[][] {
  const neighbours = (cell: Cell) =>
    placement.filter((other) => Math.abs(cell[0] - other[0]) + Math.abs(cell[1] - other[1]) === 1);
  const ends = placement.filter((cell) => neighbours(cell).length === 1);
  const paths: Cell[][] = [];
  for (const end of ends) {
    const path: Cell[] = [end];
    while (path.length < placement.length) {
      const next = neighbours(path[path.length - 1]).find((cell) => !path.some((seen) => sameCell(seen, cell)));
      if (!next) break;
      path.push(next);
    }
    if (path.length === placement.length) paths.push(path);
  }
  return paths;
}

const orientations = buildOrientations();

export const ALL_PLACEMENTS: Cell[][] = orientations.flatMap((shape) => {
  const maxX = Math.max(...shape.map(([x]) => x));
  const maxY = Math.max(...shape.map(([, y]) => y));
  const placements: Cell[][] = [];
  for (let y = 0; y < BOARD_SIZE - maxY; y++) {
    for (let x = 0; x < BOARD_SIZE - maxX; x++) {
      placements.push(shape.map(([cx, cy]) => [cx + x, cy + y] as Cell));
    }
  }
  return placements;
});

/** Placement masks, index-aligned with ALL_PLACEMENTS. Typed array so the hot loops stay monomorphic. */
export const PLACEMENT_MASKS = Int32Array.from(ALL_PLACEMENTS.map((placement) => maskOf(placement)));

const PLACEMENT_PATHS: Cell[][][] = ALL_PLACEMENTS.map(pathsOf);
const PLACEMENT_BY_MASK = new Map<number, number>();
PLACEMENT_MASKS.forEach((mask, index) => PLACEMENT_BY_MASK.set(mask, index));

export const isPlacementShape = (mask: number) => PLACEMENT_BY_MASK.has(mask);

export function initialState(): GameState {
  return {
    pieces: [
      [[0, 0], [0, 1], [0, 2], [1, 2]],
      [[3, 3], [3, 2], [3, 1], [2, 1]],
    ],
    neutrals: [[1, 0], [2, 3]],
    turn: 0,
    winner: -1,
    turnNumber: 1,
  };
}

/**
 * Identifies a board position. Two states with the same signature are the same position, so a
 * snapshot that only advanced the clock can be told apart from one that actually moved a piece.
 */
export function boardSignature(state: GameState): string {
  return [
    state.turn,
    state.turnNumber,
    state.winner,
    maskOf(state.pieces[0]),
    maskOf(state.pieces[1]),
    bitOf(state.neutrals[0]),
    bitOf(state.neutrals[1]),
  ].join(":");
}

export function cloneState(state: GameState): GameState {
  return {
    pieces: [state.pieces[0].map(copyCell), state.pieces[1].map(copyCell)],
    neutrals: [copyCell(state.neutrals[0]), copyCell(state.neutrals[1])],
    turn: state.turn,
    winner: state.winner,
    turnNumber: state.turnNumber,
  };
}

const copyCell = (cell: Cell): Cell => [cell[0], cell[1]];

// --- mask views over a state -------------------------------------------------------------------

const neutralMask = (state: GameState) => bitOf(state.neutrals[0]) | bitOf(state.neutrals[1]);

/** Cells the player's L may not overlap: the opponent's L and both neutral discs. */
const blockedMask = (state: GameState, player: Player) =>
  maskOf(state.pieces[1 - player]) | neutralMask(state);

const occupiedMask = (state: GameState) =>
  maskOf(state.pieces[0]) | maskOf(state.pieces[1]) | neutralMask(state);

// --- move generation ---------------------------------------------------------------------------

export function legalLMasks(blocked: number, current: number): number[] {
  const masks: number[] = [];
  for (let i = 0; i < PLACEMENT_MASKS.length; i++) {
    const mask = PLACEMENT_MASKS[i];
    if ((mask & blocked) === 0 && mask !== current) masks.push(mask);
  }
  return masks;
}

/** Allocation-free mobility count — the inner loop of both win detection and the CPU search. */
export function mobility(blocked: number, current: number): number {
  let total = 0;
  for (let i = 0; i < PLACEMENT_MASKS.length; i++) {
    const mask = PLACEMENT_MASKS[i];
    if ((mask & blocked) === 0 && mask !== current) total++;
  }
  return total;
}

export function legalLPlacements(state: GameState, player: Player): Cell[][] {
  const blocked = blockedMask(state, player);
  const current = maskOf(state.pieces[player]);
  const placements: Cell[][] = [];
  for (let i = 0; i < PLACEMENT_MASKS.length; i++) {
    const mask = PLACEMENT_MASKS[i];
    if ((mask & blocked) === 0 && mask !== current) placements.push(ALL_PLACEMENTS[i]);
  }
  return placements;
}

export function legalLPlacementCount(state: GameState, player: Player): number {
  return mobility(blockedMask(state, player), maskOf(state.pieces[player]));
}

export function isLegalLPlacement(state: GameState, player: Player, placement: readonly Cell[]): boolean {
  if (placement.length !== 4) return false;
  const mask = maskOf(placement);
  if (mask < 0 || !isPlacementShape(mask)) return false;
  if (mask & blockedMask(state, player)) return false;
  return mask !== maskOf(state.pieces[player]);
}

export function legalNeutralDestinations(state: GameState): Cell[] {
  const free = ~occupiedMask(state) & FULL_BOARD;
  return cellsOf(free);
}

export function isLegalNeutralDestination(state: GameState, destination: Cell): boolean {
  if (!inBounds(destination)) return false;
  return (occupiedMask(state) & bitOf(destination)) === 0;
}

/**
 * Squares the active player may draw through next, given the prefix already drawn.
 * Returns every legal placement's first square when nothing is drawn yet.
 */
export function legalContinuations(state: GameState, player: Player, drawn: readonly Cell[]): Cell[] {
  if (drawn.length >= 4) return [];
  const blocked = blockedMask(state, player);
  const current = maskOf(state.pieces[player]);
  let found = 0;
  const result: Cell[] = [];
  for (let i = 0; i < PLACEMENT_MASKS.length; i++) {
    const mask = PLACEMENT_MASKS[i];
    if ((mask & blocked) !== 0 || mask === current) continue;
    for (const path of PLACEMENT_PATHS[i]) {
      let matches = true;
      for (let step = 0; step < drawn.length; step++) {
        if (!sameCell(path[step], drawn[step])) { matches = false; break; }
      }
      if (!matches) continue;
      const next = path[drawn.length];
      const bit = bitOf(next);
      if (found & bit) continue;
      found |= bit;
      result.push(next);
    }
  }
  return result;
}

/** The placement completed by this exact draw order, or undefined if the draw is not a legal L. */
export function placementForDraw(state: GameState, player: Player, drawn: readonly Cell[]): Cell[] | undefined {
  if (drawn.length !== 4) return undefined;
  const mask = maskOf(drawn);
  if (mask < 0) return undefined;
  const index = PLACEMENT_BY_MASK.get(mask);
  if (index === undefined) return undefined;
  if ((mask & blockedMask(state, player)) !== 0 || mask === maskOf(state.pieces[player])) return undefined;
  // The mask ignores order; require the draw to actually trace one of the placement's two paths.
  const traced = PLACEMENT_PATHS[index].some((path) => path.every((cell, step) => sameCell(cell, drawn[step])));
  return traced ? ALL_PLACEMENTS[index] : undefined;
}

export const pathsForPlacement = (placement: readonly Cell[]): Cell[][] => {
  const index = PLACEMENT_BY_MASK.get(maskOf(placement));
  return index === undefined ? pathsOf(placement) : PLACEMENT_PATHS[index];
};

// --- applying a turn ---------------------------------------------------------------------------

/**
 * Validates the whole turn before touching `state`, so a rejected move cannot leave the board in a
 * half-applied position. The previous version wrote the L first and then bailed out on a bad disc
 * destination, which corrupted the authoritative server state for both players.
 */
export function applyCompleteMove(state: GameState, move: CompleteMove): boolean {
  const player = state.turn;
  if (!isLegalLPlacement(state, player, move.l)) return false;

  const lMask = maskOf(move.l);
  let neutrals: [Cell, Cell] = [copyCell(state.neutrals[0]), copyCell(state.neutrals[1])];
  if (move.neutral === 0 || move.neutral === 1) {
    const destination = move.destination;
    if (!destination || !inBounds(destination)) return false;
    // Occupancy after the L has moved: the vacated squares are legal disc destinations.
    const occupiedAfterL = lMask | maskOf(state.pieces[1 - player]) | neutralMask(state);
    if (occupiedAfterL & bitOf(destination)) return false;
    neutrals[move.neutral] = copyCell(destination);
  } else if (move.neutral !== -1) {
    return false;
  }

  state.pieces[player] = move.l.map(copyCell);
  state.neutrals = neutrals;
  state.turn = (1 - player) as Player;
  state.turnNumber++;
  if (legalLPlacementCount(state, state.turn) === 0) state.winner = player;
  return true;
}

// --- CPU ---------------------------------------------------------------------------------------

/**
 * One-ply mobility search, matching main.gd's `_choose_cpu_move`: play the turn that leaves the CPU
 * with the most freedom relative to the opponent, preferring an immediate win, breaking ties at
 * random. It now runs entirely on masks — no state cloning, no allocation inside the search.
 */
export function chooseCpuMove(state: GameState, random: () => number = Math.random): CompleteMove | undefined {
  const player = state.turn;
  const opponent = (1 - player) as Player;
  const opponentMask = maskOf(state.pieces[opponent]);
  const currentMask = maskOf(state.pieces[player]);
  const discs = [bitOf(state.neutrals[0]), bitOf(state.neutrals[1])];
  const discMask = discs[0] | discs[1];

  let bestScore = -Infinity;
  let bestCount = 0;
  let best: CompleteMove | undefined;

  const consider = (lMask: number, neutral: NeutralChoice, destinationBit: number) => {
    const nextDiscMask = neutral < 0 ? discMask : (discMask & ~discs[neutral]) | destinationBit;
    // After the turn the opponent is to move; they may not overlap our L or either disc.
    const opponentMobility = mobility(lMask | nextDiscMask, opponentMask);
    const score = opponentMobility === 0
      ? Number.POSITIVE_INFINITY
      : mobility(opponentMask | nextDiscMask, lMask) - opponentMobility;
    if (score < bestScore) return;
    if (score > bestScore) {
      bestScore = score;
      bestCount = 0;
    }
    // Reservoir sampling: uniform random pick among equally-scored moves without collecting them.
    bestCount++;
    if (random() * bestCount < 1) {
      best = {
        l: cellsOfPlacement(lMask),
        neutral,
        destination: neutral < 0 ? undefined : cellOf(31 - Math.clz32(destinationBit)),
      };
    }
  };

  const blocked = opponentMask | discMask;
  for (let i = 0; i < PLACEMENT_MASKS.length; i++) {
    const lMask = PLACEMENT_MASKS[i];
    if ((lMask & blocked) !== 0 || lMask === currentMask) continue;
    consider(lMask, -1, 0);
    const free = ~(lMask | opponentMask | discMask) & FULL_BOARD;
    for (let bits = free; bits; bits &= bits - 1) {
      const destinationBit = bits & -bits;
      consider(lMask, 0, destinationBit);
      consider(lMask, 1, destinationBit);
    }
  }
  return best;
}

const cellsOfPlacement = (mask: number): Cell[] => {
  const index = PLACEMENT_BY_MASK.get(mask);
  return index === undefined ? cellsOf(mask) : ALL_PLACEMENTS[index].map(copyCell);
};

/** Every complete turn available to `player`. Used by tests; the CPU search does not allocate these. */
export function allCompleteMoves(state: GameState, player: Player): CompleteMove[] {
  const moves: CompleteMove[] = [];
  for (const l of legalLPlacements(state, player)) {
    moves.push({ l, neutral: -1 });
    const occupied = maskOf(l) | maskOf(state.pieces[1 - player]) | neutralMask(state);
    for (const destination of cellsOf(~occupied & FULL_BOARD)) {
      moves.push({ l, neutral: 0, destination });
      moves.push({ l, neutral: 1, destination });
    }
  }
  return moves;
}

// --- wire hardening ----------------------------------------------------------------------------

const readCell = (value: unknown): Cell | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const cell: Cell = [Number(value[0]), Number(value[1])];
  return inBounds(cell) ? cell : undefined;
};

/** Returns undefined for anything malformed, so a bad peer cannot corrupt the receiver. */
export function parseState(value: unknown): GameState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.pieces) || data.pieces.length !== 2) return undefined;
  if (!Array.isArray(data.neutrals) || data.neutrals.length !== 2) return undefined;

  const pieces: [Cell[], Cell[]] = [[], []];
  for (const player of [0, 1] as const) {
    const raw = data.pieces[player];
    if (!Array.isArray(raw) || raw.length !== 4) return undefined;
    const cells: Cell[] = [];
    for (const entry of raw) {
      const cell = readCell(entry);
      if (!cell) return undefined;
      cells.push(cell);
    }
    if (maskOf(cells) < 0) return undefined;
    pieces[player] = cells;
  }
  const first = readCell(data.neutrals[0]);
  const second = readCell(data.neutrals[1]);
  if (!first || !second) return undefined;

  const state: GameState = {
    pieces,
    neutrals: [first, second],
    turn: (Number(data.turn) === 1 ? 1 : 0) as Player,
    winner: (Number(data.winner) === 0 ? 0 : Number(data.winner) === 1 ? 1 : -1) as -1 | Player,
    turnNumber: Math.max(1, Math.trunc(Number(data.turnNumber)) || 1),
  };
  // Reject overlapping pieces outright rather than rendering an impossible board.
  if (maskOf([...pieces[0], ...pieces[1], first, second]) < 0) return undefined;
  if (!isPlacementShape(maskOf(pieces[0])) || !isPlacementShape(maskOf(pieces[1]))) return undefined;
  return state;
}

/**
 * Preview payloads are relayed between players without ever touching the board, so this only has to
 * guarantee the receiver can render them: in-bounds cells, no duplicates, and a real L if one is
 * claimed. An opponent sending nonsense gets their preview dropped, not the match.
 */
export function parsePreview(value: unknown): TurnPreview | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;

  const drawn: Cell[] = [];
  if (data.drawn !== undefined && data.drawn !== null) {
    if (!Array.isArray(data.drawn) || data.drawn.length > 4) return undefined;
    for (const entry of data.drawn) {
      const cell = readCell(entry);
      if (!cell) return undefined;
      drawn.push(cell);
    }
    if (maskOf(drawn) < 0) return undefined;
  }

  let l: Cell[] | undefined;
  if (data.l !== undefined && data.l !== null) {
    if (!Array.isArray(data.l) || data.l.length !== 4) return undefined;
    l = [];
    for (const entry of data.l) {
      const cell = readCell(entry);
      if (!cell) return undefined;
      l.push(cell);
    }
    const mask = maskOf(l);
    if (mask < 0 || !isPlacementShape(mask)) return undefined;
  }

  const neutralValue = Number(data.neutral);
  const neutral: NeutralChoice = neutralValue === 0 ? 0 : neutralValue === 1 ? 1 : -1;
  return { drawn, l, neutral, destination: neutral < 0 ? undefined : readCell(data.destination) };
}

export function parseMove(value: unknown): CompleteMove | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.l) || data.l.length !== 4) return undefined;
  const l: Cell[] = [];
  for (const entry of data.l) {
    const cell = readCell(entry);
    if (!cell) return undefined;
    l.push(cell);
  }
  if (maskOf(l) < 0) return undefined;
  const neutralValue = Number(data.neutral);
  const neutral: NeutralChoice = neutralValue === 0 ? 0 : neutralValue === 1 ? 1 : -1;
  const destination = neutral < 0 ? undefined : readCell(data.destination);
  if (neutral >= 0 && !destination) return undefined;
  return { l, neutral, destination };
}
