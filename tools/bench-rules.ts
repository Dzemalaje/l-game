// Web counterpart to tests/bench_rules.gd. Run with `npm run bench`.
// Measures the CPU turn search, which is the only hot path in the game and the one that decides
// whether a mid-range phone stalls between moves.
import {
  applyCompleteMove,
  chooseCpuMove,
  cloneState,
  initialState,
  legalLPlacements,
  legalNeutralDestinations,
} from "../src/shared/rules";
import type { Cell, CompleteMove, GameState, Player } from "../src/shared/types";

// The pre-bitmask implementation, kept only so the comparison is measured rather than asserted.
function legacyAllCompleteMoves(state: GameState, player: Player): CompleteMove[] {
  return legalLPlacements(state, player).flatMap((l) => {
    const afterL = structuredClone(state);
    afterL.pieces[player] = l as Cell[];
    const moves: CompleteMove[] = [{ l: l as Cell[], neutral: -1 }];
    for (const neutral of [0, 1] as const) {
      for (const destination of legalNeutralDestinations(afterL)) moves.push({ l: l as Cell[], neutral, destination });
    }
    return moves;
  });
}

function legacyChooseCpuMove(state: GameState): CompleteMove {
  const player = state.turn;
  const moves = legacyAllCompleteMoves(state, player);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = structuredClone(state);
    applyCompleteMove(next, move);
    const opponentMobility = next.winner === player ? 0 : legalLPlacements(next, next.turn).length;
    const ownMobility = legalLPlacements(next, player).length;
    const score = next.winner === player ? 10000 : ownMobility * 2 - opponentMobility;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

const time = (label: string, runs: number, body: () => void) => {
  for (let warmup = 0; warmup < 20; warmup++) body();
  const started = performance.now();
  for (let run = 0; run < runs; run++) body();
  const perRun = (performance.now() - started) / runs;
  console.log(`${label.padEnd(28)} ${perRun.toFixed(3)} ms`);
  return perRun;
};

const opening = initialState();
const legacy = time("legacy clone+scan search", 200, () => legacyChooseCpuMove(cloneState(opening)));
const current = time("bitmask search", 2000, () => chooseCpuMove(opening));
console.log(`${"speedup".padEnd(28)} ${(legacy / current).toFixed(0)}x`);

time("full CPU-vs-CPU game", 200, () => {
  const state = initialState();
  let guard = 0;
  while (state.winner < 0 && guard++ < 200) {
    const move = chooseCpuMove(state);
    if (!move) break;
    applyCompleteMove(state, move);
  }
});
