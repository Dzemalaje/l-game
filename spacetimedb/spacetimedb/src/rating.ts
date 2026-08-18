/**
 * Glicko-2 ratings, implemented directly from Mark Glickman's paper
 * "Example of the Glicko-2 system" (http://www.glicko.net/glicko/glicko2.pdf).
 *
 * Pure and deterministic: the current time is always passed in rather than read from a clock, so
 * this is safe to call from inside a reducer.
 */

export interface Rating {
  rating: number;
  deviation: number;
  volatility: number;
  wins: number;
  losses: number;
  games: number;
  /** Epoch milliseconds of the last rated game, used to inflate deviation over idle periods. */
  ratedAtMs: number;
}

export interface Opponent {
  rating: number;
  deviation: number;
  /** 1 for a win against this opponent, 0 for a loss. */
  score: 0 | 1;
}

export const GLICKO_SCALE = 173.7178;
export const GLICKO_TAU = 0.5;
export const GLICKO_EPSILON = 1e-6;

export const DEFAULT_RATING = 1500;
export const DEFAULT_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;

/** One rating period is a week; deviation stops growing after this many idle periods. */
export const RATING_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_INACTIVE_PERIODS = 52;

export function defaultRating(atMs: number): Rating {
  return {
    rating: DEFAULT_RATING,
    deviation: DEFAULT_DEVIATION,
    volatility: DEFAULT_VOLATILITY,
    wins: 0,
    losses: 0,
    games: 0,
    ratedAtMs: atMs,
  };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

/**
 * Solves for the new volatility with the Illinois variant of regula falsi, exactly as specified in
 * step 5 of the paper.
 */
function solveVolatility(phi: number, variance: number, delta: number, volatility: number): number {
  const a = Math.log(volatility * volatility);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const numerator = ex * (delta * delta - phi * phi - variance - ex);
    const denominator = 2 * Math.pow(phi * phi + variance + ex, 2);
    return numerator / denominator - (x - a) / (GLICKO_TAU * GLICKO_TAU);
  };

  let lower = a;
  let upper: number;
  if (delta * delta > phi * phi + variance) {
    upper = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * GLICKO_TAU) < 0) k += 1;
    upper = a - k * GLICKO_TAU;
  }

  let fLower = f(lower);
  let fUpper = f(upper);
  let guard = 0;
  while (Math.abs(upper - lower) > GLICKO_EPSILON && guard < 1000) {
    const candidate = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fCandidate = f(candidate);
    if (fCandidate * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = candidate;
    fUpper = fCandidate;
    guard += 1;
  }
  return Math.exp(lower / 2);
}

/**
 * Deviation grows while a player is idle. The paper applies phi* = sqrt(phi^2 + sigma^2) once per
 * rating period; this collapses N idle periods into a single step and caps the result at the
 * default deviation so a long absence cannot make a rating meaningless.
 */
function inflateForInactivity(phi: number, volatility: number, periods: number): number {
  if (periods <= 0) return phi;
  const capped = Math.min(MAX_INACTIVE_PERIODS, periods);
  return Math.min(DEFAULT_DEVIATION / GLICKO_SCALE, Math.sqrt(phi * phi + volatility * volatility * capped));
}

export function idlePeriods(rating: Rating, atMs: number): number {
  if (rating.ratedAtMs <= 0) return 0;
  return Math.max(0, Math.floor((atMs - rating.ratedAtMs) / RATING_PERIOD_MS));
}

/**
 * Runs one Glicko-2 rating period for `player` against one or more opponents.
 * Pass a single opponent for the per-match update this game uses.
 */
export function updateRating(player: Rating, opponents: readonly Opponent[], atMs: number): Rating {
  if (opponents.length === 0) {
    // No games: only the deviation grows.
    const phi = inflateForInactivity(
      player.deviation / GLICKO_SCALE,
      player.volatility,
      idlePeriods(player, atMs),
    );
    return { ...player, deviation: phi * GLICKO_SCALE, ratedAtMs: atMs };
  }

  const mu = (player.rating - DEFAULT_RATING) / GLICKO_SCALE;
  const phi = inflateForInactivity(
    player.deviation / GLICKO_SCALE,
    player.volatility,
    idlePeriods(player, atMs),
  );

  let varianceInverse = 0;
  let deltaSum = 0;
  let wins = 0;
  let losses = 0;

  for (const opponent of opponents) {
    const opponentMu = (opponent.rating - DEFAULT_RATING) / GLICKO_SCALE;
    const opponentPhi = opponent.deviation / GLICKO_SCALE;
    const e = expectedScore(mu, opponentMu, opponentPhi);
    varianceInverse += Math.pow(g(opponentPhi), 2) * e * (1 - e);
    deltaSum += g(opponentPhi) * (opponent.score - e);
    if (opponent.score === 1) wins += 1;
    else losses += 1;
  }

  const variance = 1 / varianceInverse;
  const delta = variance * deltaSum;
  const volatility = solveVolatility(phi, variance, delta, player.volatility);

  const prePeriodPhi = Math.sqrt(phi * phi + volatility * volatility);
  const newPhi = 1 / Math.sqrt(1 / (prePeriodPhi * prePeriodPhi) + 1 / variance);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * GLICKO_SCALE + DEFAULT_RATING,
    deviation: newPhi * GLICKO_SCALE,
    volatility,
    wins: player.wins + wins,
    losses: player.losses + losses,
    games: player.games + opponents.length,
    ratedAtMs: atMs,
  };
}

/** Convenience wrapper for a single head-to-head result. */
export function rateMatch(player: Rating, opponent: Rating, score: 0 | 1, atMs: number): Rating {
  return updateRating(player, [{ rating: opponent.rating, deviation: opponent.deviation, score }], atMs);
}

/** The number shown to players and on the leaderboard. */
export function displayRating(rating: Rating): number {
  return Math.round(rating.rating);
}
