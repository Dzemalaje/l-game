import { ScheduleAt } from 'spacetimedb';
import { SenderError, schema, table, t, type ReducerCtx, type InferSchema } from 'spacetimedb/server';

import * as glicko from './rating';
import {
  applyMove,
  initialBoard,
  isLegalPlacement,
  maskOf,
  opponentOf,
  type Board,
  type NeutralChoice,
  type Seat,
} from './rules';
import { active_game, connection, friend_edge, game, match, player, preview, queue_entry } from './tables';

/**
 * The L Game server.
 *
 * Clients never write a table directly. They call the reducers below, which are the only code that
 * can move a piece, start a game or change a rating, and they read everything else by subscribing
 * to the public tables. That is the whole security model: a modified client can call any reducer
 * with any arguments, but each one re-derives what the caller is allowed to do from `ctx.sender`
 * and the stored board, never from what was sent.
 */

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/** Starting time on each player's clock. */
const CLOCK_MS = 300_000;
/** How long a dropped player has to come back before the opponent wins. */
const RECONNECT_MS = 20_000;
/** How often the clock and matchmaking timers fire. */
const TICK_MICROS = 1_000_000n;

/** Ranked pairing starts at +/-100 rating and widens by 25 per second of waiting, capped at 600. */
const WINDOW_BASE = 100;
const WINDOW_PER_SECOND = 25;
const WINDOW_MAX = 600;
/** Re-queueing within this window resumes the old search rather than resetting its rating band. */
const SEARCH_RESUME_GRACE_MS = 10_000;

/** Ignore preview updates that arrive faster than this; the relay is per-drag, not per-pixel. */
const PREVIEW_INTERVAL_MS = 40;

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

// ---------------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------------

/** Fires {@link queueTick}, which pairs waiting players. */
const queue_timer = table(
  { name: 'queue_timer', scheduled: (): any => queueTick },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

/** Fires {@link gameTick}, which charges clocks and resolves flag-falls and reconnect deadlines. */
const game_timer = table(
  { name: 'game_timer', scheduled: (): any => gameTick },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

const spacetimedb = schema({
  player,
  connection,
  queue_entry,
  game,
  active_game,
  preview,
  match,
  friend_edge,
  queue_timer,
  game_timer,
});

export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
type GameRow = typeof game.rowType.type;
type PlayerRow = typeof player.rowType.type;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

/** Reducer-safe wall clock. `ctx.timestamp` is fixed for the whole call, so this is deterministic. */
function nowMs(ctx: Ctx): number {
  return Number(ctx.timestamp.microsSinceUnixEpoch / 1000n);
}

function toMs(stamp: { microsSinceUnixEpoch: bigint }): number {
  return Number(stamp.microsSinceUnixEpoch / 1000n);
}

function isOnline(ctx: Ctx, identity: PlayerRow['identity']): boolean {
  for (const _ of ctx.db.connection.identity.filter(identity)) return true;
  return false;
}

function requirePlayer(ctx: Ctx): PlayerRow {
  const row = ctx.db.player.identity.find(ctx.sender);
  if (!row) throw new SenderError('Connect before using the game.');
  return row;
}

/** Which seat `identity` holds in `row`, or undefined if they are not in this game. */
function seatOf(row: GameRow, identity: PlayerRow['identity']): Seat | undefined {
  if (row.player0.equals(identity)) return 0;
  if (row.player1.equals(identity)) return 1;
  return undefined;
}

function boardOf(row: GameRow): Board {
  return {
    pieces: [[...row.p0_cells], [...row.p1_cells]],
    neutrals: [row.neutral0, row.neutral1],
    turn: (row.turn === 1 ? 1 : 0) as Seat,
    winner: row.winner === 0 || row.winner === 1 ? row.winner : -1,
    turnNumber: row.turn_number,
  };
}

function withBoard(row: GameRow, board: Board): GameRow {
  return {
    ...row,
    p0_cells: board.pieces[0],
    p1_cells: board.pieces[1],
    neutral0: board.neutrals[0],
    neutral1: board.neutrals[1],
    turn: board.turn,
    turn_number: board.turnNumber,
    winner: board.winner,
  };
}

function ratingOf(row: PlayerRow): glicko.Rating {
  return {
    rating: row.rating,
    deviation: row.deviation,
    volatility: row.volatility,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    ratedAtMs: toMs(row.rated_at),
  };
}

/**
 * Bills the time since `charged_at` to whoever is on move and advances the marker.
 *
 * Every path that reads or writes a clock goes through this, so a move and the scheduled tick can
 * never charge the same interval twice. The clock is paused unless the game is live and both
 * players are connected, which keeps a disconnect from also costing the dropped player time.
 */
function chargeClocks(ctx: Ctx, row: GameRow): GameRow {
  const charged = { ...row, charged_at: ctx.timestamp };
  if (row.winner >= 0) return charged;

  const bothOnline = isOnline(ctx, row.player0) && isOnline(ctx, row.player1);
  if (!bothOnline) return charged;

  const elapsed = BigInt(Math.max(0, nowMs(ctx) - toMs(row.charged_at)));
  if (elapsed <= 0n) return charged;

  if (row.turn === 0) {
    charged.clock0_ms = row.clock0_ms > elapsed ? row.clock0_ms - elapsed : 0n;
  } else {
    charged.clock1_ms = row.clock1_ms > elapsed ? row.clock1_ms - elapsed : 0n;
  }
  return charged;
}

// ---------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------

export const init = spacetimedb.init((ctx) => {
  ctx.db.queue_timer.insert({ scheduled_id: 0n, scheduled_at: ScheduleAt.interval(TICK_MICROS) });
  ctx.db.game_timer.insert({ scheduled_id: 0n, scheduled_at: ScheduleAt.interval(TICK_MICROS) });
  console.info('l-game module initialised');
});

export const onConnect = spacetimedb.clientConnected((ctx) => {
  if (ctx.connectionId) {
    ctx.db.connection.insert({
      connection_id: ctx.connectionId,
      identity: ctx.sender,
      connected_at: ctx.timestamp,
    });
  }

  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: true, last_seen: ctx.timestamp });
  } else {
    // First sight of this identity: give it a guest profile so it can play casual immediately.
    const username = uniqueGuestName(ctx);
    ctx.db.player.insert({
      identity: ctx.sender,
      username,
      username_key: username.toLowerCase(),
      avatar_style: 'lorelei',
      avatar_seed: randomSeed(ctx),
      rating: glicko.DEFAULT_RATING,
      deviation: glicko.DEFAULT_DEVIATION,
      volatility: glicko.DEFAULT_VOLATILITY,
      wins: 0,
      losses: 0,
      games: 0,
      rated_at: ctx.timestamp,
      online: true,
      guest: true,
      created_at: ctx.timestamp,
      last_seen: ctx.timestamp,
    });
  }

  // Back inside the reconnect window: clear the deadline so the tick stops counting down.
  const active = ctx.db.active_game.identity.find(ctx.sender);
  if (!active) return;
  const row = ctx.db.game.id.find(active.game_id);
  if (!row || row.winner >= 0) return;
  const seat = seatOf(row, ctx.sender);
  if (seat === undefined) return;
  // `charged_at` is reset too: the clock was paused while they were away, so the gap is not billed.
  ctx.db.game.id.update({
    ...row,
    charged_at: ctx.timestamp,
    ...(seat === 0 ? { reconnect_by0: 0n } : { reconnect_by1: 0n }),
  });
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (ctx.connectionId) ctx.db.connection.connection_id.delete(ctx.connectionId);
  // Another tab or device may still hold this identity; only the last one going dark counts.
  if (isOnline(ctx, ctx.sender)) return;

  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: false, last_seen: ctx.timestamp });
  }

  // A player who vanishes is no longer searching.
  ctx.db.queue_entry.identity.delete(ctx.sender);

  const active = ctx.db.active_game.identity.find(ctx.sender);
  if (!active) return;
  const row = ctx.db.game.id.find(active.game_id);
  if (!row || row.winner >= 0) return;
  const seat = seatOf(row, ctx.sender);
  if (seat === undefined) return;

  const deadline = BigInt(nowMs(ctx) + RECONNECT_MS);
  const charged = chargeClocks(ctx, row);
  ctx.db.game.id.update({
    ...charged,
    ...(seat === 0 ? { reconnect_by0: deadline } : { reconnect_by1: deadline }),
  });
});

function randomSeed(ctx: Ctx): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let seed = '';
  for (let i = 0; i < 16; i++) seed += alphabet[ctx.random.integerInRange(0, alphabet.length - 1)];
  return seed;
}

/** A guest name that is free right now. The suffix is wide enough that the retry loop is rare. */
function uniqueGuestName(ctx: Ctx): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `Guest-${ctx.random.integerInRange(100000, 999999)}`;
    if (!ctx.db.player.username_key.find(candidate.toLowerCase())) return candidate;
  }
  throw new SenderError('Could not allocate a guest name. Try connecting again.');
}

// ---------------------------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------------------------

/**
 * Claims a display name. Choosing a name is also what turns a guest into a full player, which is
 * the gate on ranked play - see `enqueue`.
 */
export const setProfile = spacetimedb.reducer(
  { username: t.string(), avatarStyle: t.string(), avatarSeed: t.string() },
  (ctx, { username, avatarStyle, avatarSeed }) => {
    const me = requirePlayer(ctx);

    const trimmed = username.trim();
    if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
      throw new SenderError(`Pick a name between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`);
    }
    if (!USERNAME_PATTERN.test(trimmed)) {
      throw new SenderError('Names may use letters, numbers, spaces, hyphens and underscores.');
    }

    const key = trimmed.toLowerCase();
    const taken = ctx.db.player.username_key.find(key);
    if (taken && !taken.identity.equals(ctx.sender)) {
      throw new SenderError('That name is already taken.');
    }

    const style = avatarStyle.trim() === '' ? me.avatar_style : avatarStyle.trim().slice(0, 32);
    const seed = avatarSeed.trim() === '' ? me.avatar_seed : avatarSeed.trim().slice(0, 64);

    ctx.db.player.identity.update({
      ...me,
      username: trimmed,
      username_key: key,
      avatar_style: style,
      avatar_seed: seed,
      guest: false,
      last_seen: ctx.timestamp,
    });
  },
);

/** Avatar only, so changing a look does not go through the username uniqueness check. */
export const setAvatar = spacetimedb.reducer(
  { style: t.string(), seed: t.string() },
  (ctx, { style, seed }) => {
    const me = requirePlayer(ctx);
    ctx.db.player.identity.update({
      ...me,
      avatar_style: style.trim().slice(0, 32) || me.avatar_style,
      avatar_seed: seed.trim().slice(0, 64) || me.avatar_seed,
      last_seen: ctx.timestamp,
    });
  },
);

/**
 * Erases the caller. Their live game is forfeited first so the opponent gets a result rather than
 * being stranded, and their identity is stripped from past matches while the denormalised names
 * keep the opponent's history readable.
 */
export const deleteAccount = spacetimedb.reducer((ctx) => {
  const me = requirePlayer(ctx);

  const active = ctx.db.active_game.identity.find(ctx.sender);
  if (active) {
    const row = ctx.db.game.id.find(active.game_id);
    if (row && row.winner < 0) {
      const seat = seatOf(row, ctx.sender);
      if (seat !== undefined) finish(ctx, chargeClocks(ctx, row), opponentOf(seat), 'forfeit');
    }
  }

  for (const record of [...ctx.db.match.iter()]) {
    if (record.winner?.equals(ctx.sender)) ctx.db.match.id.update({ ...record, winner: undefined });
    else if (record.loser?.equals(ctx.sender)) ctx.db.match.id.update({ ...record, loser: undefined });
  }

  for (const edge of [...ctx.db.friend_edge.owner.filter(ctx.sender)]) {
    ctx.db.friend_edge.id.delete(edge.id);
  }
  for (const edge of [...ctx.db.friend_edge.iter()]) {
    if (edge.other.equals(ctx.sender)) ctx.db.friend_edge.id.delete(edge.id);
  }

  ctx.db.queue_entry.identity.delete(ctx.sender);
  ctx.db.player.identity.delete(ctx.sender);
  console.info(`account deleted: ${me.username}`);
});

// ---------------------------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------------------------

const FRIEND_MUTUAL = 0;
const FRIEND_SENT = 1;
const FRIEND_RECEIVED = 2;
const FRIEND_BLOCKED = 3;

function edgeBetween(ctx: Ctx, owner: PlayerRow['identity'], other: PlayerRow['identity']) {
  return [...ctx.db.friend_edge.by_owner_other.filter([owner, other])][0];
}

function putEdge(ctx: Ctx, owner: PlayerRow['identity'], other: PlayerRow['identity'], state: number): void {
  const existing = edgeBetween(ctx, owner, other);
  if (existing) ctx.db.friend_edge.id.update({ ...existing, state });
  else ctx.db.friend_edge.insert({ id: 0n, owner, other, state, created_at: ctx.timestamp });
}

function dropEdge(ctx: Ctx, owner: PlayerRow['identity'], other: PlayerRow['identity']): void {
  const existing = edgeBetween(ctx, owner, other);
  if (existing) ctx.db.friend_edge.id.delete(existing.id);
}

/** Sends a request by exact username. Accepts immediately if they already asked you. */
export const sendFriendRequest = spacetimedb.reducer({ username: t.string() }, (ctx, { username }) => {
  requirePlayer(ctx);

  const target = ctx.db.player.username_key.find(username.trim().toLowerCase());
  if (!target) throw new SenderError('No player by that name.');
  if (target.identity.equals(ctx.sender)) throw new SenderError('You cannot add yourself.');

  const mine = edgeBetween(ctx, ctx.sender, target.identity);
  if (mine?.state === FRIEND_MUTUAL) throw new SenderError('You are already friends.');
  if (mine?.state === FRIEND_SENT) throw new SenderError('You already sent that request.');
  if (mine?.state === FRIEND_BLOCKED) throw new SenderError('Unblock them first.');

  // They blocked you: report the same thing as a request that simply went nowhere, so blocking is
  // not observable from the other side.
  const theirs = edgeBetween(ctx, target.identity, ctx.sender);
  if (theirs?.state === FRIEND_BLOCKED) return;

  if (mine?.state === FRIEND_RECEIVED) {
    putEdge(ctx, ctx.sender, target.identity, FRIEND_MUTUAL);
    putEdge(ctx, target.identity, ctx.sender, FRIEND_MUTUAL);
    return;
  }

  putEdge(ctx, ctx.sender, target.identity, FRIEND_SENT);
  putEdge(ctx, target.identity, ctx.sender, FRIEND_RECEIVED);
});

export const acceptFriend = spacetimedb.reducer({ other: t.identity() }, (ctx, { other }) => {
  requirePlayer(ctx);
  const mine = edgeBetween(ctx, ctx.sender, other);
  if (mine?.state !== FRIEND_RECEIVED) throw new SenderError('There is no request from that player.');
  putEdge(ctx, ctx.sender, other, FRIEND_MUTUAL);
  putEdge(ctx, other, ctx.sender, FRIEND_MUTUAL);
});

/** Removes, declines, cancels or unblocks - all of which are "drop this relationship". */
export const removeFriend = spacetimedb.reducer({ other: t.identity() }, (ctx, { other }) => {
  requirePlayer(ctx);
  dropEdge(ctx, ctx.sender, other);
  dropEdge(ctx, other, ctx.sender);
});

/** Blocking keeps only the blocker's edge, so the blocked player sees the friendship simply end. */
export const blockFriend = spacetimedb.reducer({ other: t.identity() }, (ctx, { other }) => {
  requirePlayer(ctx);
  if (other.equals(ctx.sender)) throw new SenderError('You cannot block yourself.');
  putEdge(ctx, ctx.sender, other, FRIEND_BLOCKED);
  dropEdge(ctx, other, ctx.sender);
});

// ---------------------------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------------------------

function ratingWindow(waitedMs: number): number {
  return Math.min(WINDOW_MAX, WINDOW_BASE + Math.floor(waitedMs / 1000) * WINDOW_PER_SECOND);
}

/**
 * Joins the queue for `mode`.
 *
 * The rating used for pairing is read from the caller's own row, never taken from the request, so
 * a client cannot lower its rating to farm weaker opponents.
 */
export const enqueue = spacetimedb.reducer({ mode: t.string() }, (ctx, { mode }) => {
  if (mode !== 'casual' && mode !== 'ranked') throw new SenderError('Unknown mode.');

  const me = requirePlayer(ctx);
  if (mode === 'ranked' && me.guest) {
    throw new SenderError('Choose a username before playing ranked matches.');
  }
  if (ctx.db.active_game.identity.find(ctx.sender)) {
    throw new SenderError('Finish your current match first.');
  }

  const existing = ctx.db.queue_entry.identity.find(ctx.sender);
  // Re-queueing quickly resumes the old search, so cancelling cannot reset an already-wide band.
  const queuedAt =
    existing && nowMs(ctx) - toMs(existing.queued_at) < SEARCH_RESUME_GRACE_MS
      ? existing.queued_at
      : ctx.timestamp;

  const entry = {
    identity: ctx.sender,
    mode,
    rating: Math.round(me.rating),
    queued_at: queuedAt,
  };
  if (existing) ctx.db.queue_entry.identity.update(entry);
  else ctx.db.queue_entry.insert(entry);

  pairWaiting(ctx);
});

export const dequeue = spacetimedb.reducer((ctx) => {
  ctx.db.queue_entry.identity.delete(ctx.sender);
});

export const queueTick = spacetimedb.reducer({ timer: queue_timer.rowType }, (ctx) => {
  pairWaiting(ctx);
});

/**
 * Pairs everyone who can be paired, longest wait first so nobody starves behind new arrivals.
 * Ranked runs before casual because it is the mode with a compatibility constraint to satisfy.
 */
function pairWaiting(ctx: Ctx): void {
  const now = nowMs(ctx);

  for (const mode of ['ranked', 'casual'] as const) {
    const waiting = [...ctx.db.queue_entry.mode.filter(mode)].sort(
      (a, b) => toMs(a.queued_at) - toMs(b.queued_at),
    );

    const paired = new Set<number>();
    for (let i = 0; i < waiting.length; i++) {
      if (paired.has(i)) continue;
      const first = waiting[i]!;
      // Skip anyone who went offline between the tick that queued them and this one.
      if (!isOnline(ctx, first.identity)) {
        ctx.db.queue_entry.identity.delete(first.identity);
        paired.add(i);
        continue;
      }

      for (let j = i + 1; j < waiting.length; j++) {
        if (paired.has(j)) continue;
        const second = waiting[j]!;
        if (first.identity.equals(second.identity)) continue;
        if (!isOnline(ctx, second.identity)) continue;

        if (mode === 'ranked') {
          // The pairing must satisfy both players' windows, so the stricter one decides.
          const window = Math.min(
            ratingWindow(now - toMs(first.queued_at)),
            ratingWindow(now - toMs(second.queued_at)),
          );
          if (Math.abs(first.rating - second.rating) > window) continue;
        }

        paired.add(i);
        paired.add(j);
        startGame(ctx, mode, first.identity, second.identity);
        break;
      }
    }
  }
}

function startGame(
  ctx: Ctx,
  mode: 'casual' | 'ranked',
  a: PlayerRow['identity'],
  b: PlayerRow['identity'],
): void {
  const first = ctx.db.player.identity.find(a);
  const second = ctx.db.player.identity.find(b);
  if (!first || !second) return;

  // Coin-flip the seats: seat 0 moves first, and that should not go to whoever queued earlier.
  const [seat0, seat1] = ctx.random() < 0.5 ? [first, second] : [second, first];
  const board = initialBoard();

  const row = ctx.db.game.insert({
    id: 0n,
    mode,
    player0: seat0.identity,
    player1: seat1.identity,
    name0: seat0.username,
    name1: seat1.username,
    p0_cells: board.pieces[0],
    p1_cells: board.pieces[1],
    neutral0: board.neutrals[0],
    neutral1: board.neutrals[1],
    turn: board.turn,
    turn_number: board.turnNumber,
    winner: -1,
    end_reason: '',
    clock0_ms: BigInt(CLOCK_MS),
    clock1_ms: BigInt(CLOCK_MS),
    charged_at: ctx.timestamp,
    reconnect_by0: 0n,
    reconnect_by1: 0n,
    rating_before0: Math.round(seat0.rating),
    rating_before1: Math.round(seat1.rating),
    rating_after0: 0,
    rating_after1: 0,
    started_at: ctx.timestamp,
    finished_at: undefined,
  });

  ctx.db.queue_entry.identity.delete(seat0.identity);
  ctx.db.queue_entry.identity.delete(seat1.identity);
  ctx.db.active_game.insert({ identity: seat0.identity, game_id: row.id });
  ctx.db.active_game.insert({ identity: seat1.identity, game_id: row.id });

  console.info(`game ${row.id} started: ${seat0.username} vs ${seat1.username} (${mode})`);
}

// ---------------------------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------------------------

/** Resolves the caller's live game and seat, or explains why they cannot act. */
function liveGameFor(ctx: Ctx, gameId: bigint): { row: GameRow; seat: Seat } {
  const row = ctx.db.game.id.find(gameId);
  if (!row) throw new SenderError('That game does not exist.');
  const seat = seatOf(row, ctx.sender);
  if (seat === undefined) throw new SenderError('You are not a player in that game.');
  if (row.winner >= 0) throw new SenderError('That match is already over.');
  return { row, seat };
}

/**
 * Plays one complete turn: place the L, optionally relocate a neutral disc.
 *
 * The move is validated against the stored board rather than anything the client claims about it,
 * and the turn is only committed once every part of it is known to be legal.
 */
export const playMove = spacetimedb.reducer(
  {
    gameId: t.u64(),
    cells: t.array(t.u8()),
    /** -1 leaves the discs alone; 0 or 1 moves that disc to `destination`. */
    neutral: t.i8(),
    /** Ignored when `neutral` is -1. */
    destination: t.i8(),
  },
  (ctx, { gameId, cells, neutral, destination }) => {
    const { row, seat } = liveGameFor(ctx, gameId);
    if (seat !== row.turn) throw new SenderError('It is not your turn.');

    // Bill the thinking time before judging the move, so a move sent after the flag falls loses.
    const charged = chargeClocks(ctx, row);
    const clock = seat === 0 ? charged.clock0_ms : charged.clock1_ms;
    if (clock <= 0n) {
      finish(ctx, charged, opponentOf(seat), 'time');
      return;
    }

    const next = applyMove(boardOf(charged), {
      cells: [...cells],
      neutral: neutral as NeutralChoice,
      destination,
    });
    if (!next) throw new SenderError('That move is not legal.');

    const played = withBoard(charged, next);
    ctx.db.preview.game_id.delete(gameId);

    if (next.winner >= 0) {
      finish(ctx, played, next.winner as Seat, 'moves');
      return;
    }
    ctx.db.game.id.update(played);
  },
);

/** Resigns. The opponent wins immediately. */
export const forfeit = spacetimedb.reducer({ gameId: t.u64() }, (ctx, { gameId }) => {
  const { row, seat } = liveGameFor(ctx, gameId);
  finish(ctx, chargeClocks(ctx, row), opponentOf(seat), 'forfeit');
});

/**
 * Shows the opponent what is being dragged out, live.
 *
 * A claimed complete L is only relayed once it is actually playable, so this channel cannot be
 * used to render a board position that could never occur.
 */
export const setPreview = spacetimedb.reducer(
  {
    gameId: t.u64(),
    drawn: t.array(t.u8()),
    candidate: t.array(t.u8()),
    neutral: t.i8(),
    destination: t.i8(),
  },
  (ctx, { gameId, drawn, candidate, neutral, destination }) => {
    const row = ctx.db.game.id.find(gameId);
    if (!row || row.winner >= 0) return;
    const seat = seatOf(row, ctx.sender);
    if (seat === undefined || seat !== row.turn) return;

    const existing = ctx.db.preview.game_id.find(gameId);
    if (existing && nowMs(ctx) - toMs(existing.updated_at) < PREVIEW_INTERVAL_MS) return;

    const trimmed = [...drawn].slice(0, 4).filter((cell) => cell < 16);
    let shown: number[] = [];
    if (candidate.length === 4 && isLegalPlacement(boardOf(row), seat, maskOf([...candidate]))) {
      shown = [...candidate];
    }

    // Rebuilt from validated fields only: nothing extra the sender added survives the relay.
    const entry = {
      game_id: gameId,
      seat,
      drawn: trimmed,
      candidate: shown,
      neutral: neutral === 0 || neutral === 1 ? neutral : -1,
      destination: destination >= 0 && destination < 16 ? destination : -1,
      updated_at: ctx.timestamp,
    };
    if (existing) ctx.db.preview.game_id.update(entry);
    else ctx.db.preview.insert(entry);
  },
);

export const clearPreview = spacetimedb.reducer({ gameId: t.u64() }, (ctx, { gameId }) => {
  const existing = ctx.db.preview.game_id.find(gameId);
  if (existing && existing.seat === seatOf(ctx.db.game.id.find(gameId)!, ctx.sender)) {
    ctx.db.preview.game_id.delete(gameId);
  }
});

// ---------------------------------------------------------------------------------------------
// Clocks and timeouts
// ---------------------------------------------------------------------------------------------

/**
 * Once a second: charge every live game's clock, and end the ones that ran out of time or whose
 * dropped player never came back.
 *
 * Only games with `active_game` rows are visited, so the cost tracks the number of games in
 * progress rather than the number ever played.
 */
export const gameTick = spacetimedb.reducer({ timer: game_timer.rowType }, (ctx) => {
  const now = nowMs(ctx);
  const seen = new Set<bigint>();

  for (const active of ctx.db.active_game.iter()) {
    if (seen.has(active.game_id)) continue;
    seen.add(active.game_id);

    const row = ctx.db.game.id.find(active.game_id);
    if (!row) {
      ctx.db.active_game.identity.delete(active.identity);
      continue;
    }
    if (row.winner >= 0) continue;

    // Whoever's reconnect window expires first forfeits. Decided by deadline rather than by seat
    // order, so a simultaneous double disconnect is not silently biased against seat 0.
    const expired0 = row.reconnect_by0 > 0n && BigInt(now) >= row.reconnect_by0;
    const expired1 = row.reconnect_by1 > 0n && BigInt(now) >= row.reconnect_by1;
    if (expired0 || expired1) {
      const loser: Seat = expired0 && (!expired1 || row.reconnect_by0 <= row.reconnect_by1) ? 0 : 1;
      finish(ctx, chargeClocks(ctx, row), opponentOf(loser), 'forfeit');
      continue;
    }

    const charged = chargeClocks(ctx, row);
    const flagged = charged.turn === 0 ? charged.clock0_ms <= 0n : charged.clock1_ms <= 0n;
    if (flagged) {
      finish(ctx, charged, opponentOf(charged.turn as Seat), 'time');
      continue;
    }
    ctx.db.game.id.update(charged);
  }
});

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

/**
 * Ends `row` and records the result. Ratings, the match record and the board all move in the same
 * transaction, so a finished game and its rating change can never disagree.
 *
 * `row` must already have had its clocks charged by the caller.
 */
function finish(ctx: Ctx, row: GameRow, winnerSeat: Seat, reason: 'moves' | 'time' | 'forfeit'): void {
  // Checked against what is stored, not against `row`: a winning move arrives here already carrying
  // its own result, so guarding on `row.winner` would treat every win as an already-finished game.
  const stored = ctx.db.game.id.find(row.id);
  if (!stored || stored.winner >= 0) return;

  const winnerId = winnerSeat === 0 ? row.player0 : row.player1;
  const loserId = winnerSeat === 0 ? row.player1 : row.player0;
  const winnerName = winnerSeat === 0 ? row.name0 : row.name1;
  const loserName = winnerSeat === 0 ? row.name1 : row.name0;
  const winnerClock = winnerSeat === 0 ? row.clock0_ms : row.clock1_ms;
  const loserClock = winnerSeat === 0 ? row.clock1_ms : row.clock0_ms;

  const winnerRow = ctx.db.player.identity.find(winnerId);
  const loserRow = ctx.db.player.identity.find(loserId);

  let winnerBefore = 0;
  let winnerAfter = 0;
  let loserBefore = 0;
  let loserAfter = 0;

  if (row.mode === 'ranked' && winnerRow && loserRow) {
    const at = nowMs(ctx);
    const before = { winner: ratingOf(winnerRow), loser: ratingOf(loserRow) };
    // Both updates read the pre-match ratings, so the order they are written in does not matter.
    const after = {
      winner: glicko.rateMatch(before.winner, before.loser, 1, at),
      loser: glicko.rateMatch(before.loser, before.winner, 0, at),
    };

    winnerBefore = glicko.displayRating(before.winner);
    loserBefore = glicko.displayRating(before.loser);
    winnerAfter = glicko.displayRating(after.winner);
    loserAfter = glicko.displayRating(after.loser);

    ctx.db.player.identity.update({
      ...winnerRow,
      rating: after.winner.rating,
      deviation: after.winner.deviation,
      volatility: after.winner.volatility,
      wins: after.winner.wins,
      losses: after.winner.losses,
      games: after.winner.games,
      rated_at: ctx.timestamp,
    });
    ctx.db.player.identity.update({
      ...loserRow,
      rating: after.loser.rating,
      deviation: after.loser.deviation,
      volatility: after.loser.volatility,
      wins: after.loser.wins,
      losses: after.loser.losses,
      games: after.loser.games,
      rated_at: ctx.timestamp,
    });
  }

  ctx.db.game.id.update({
    ...row,
    winner: winnerSeat,
    end_reason: reason,
    finished_at: ctx.timestamp,
    rating_after0: winnerSeat === 0 ? winnerAfter : loserAfter,
    rating_after1: winnerSeat === 0 ? loserAfter : winnerAfter,
    reconnect_by0: 0n,
    reconnect_by1: 0n,
  });

  ctx.db.match.insert({
    id: 0n,
    game_id: row.id,
    mode: row.mode,
    reason,
    winner: winnerId,
    loser: loserId,
    winner_name: winnerName,
    loser_name: loserName,
    moves: Math.max(0, row.turn_number - 1),
    winner_clock_ms: winnerClock,
    loser_clock_ms: loserClock,
    winner_rating_before: winnerBefore,
    winner_rating_after: winnerAfter,
    loser_rating_before: loserBefore,
    loser_rating_after: loserAfter,
    started_at: row.started_at,
    finished_at: ctx.timestamp,
  });

  // Both players are free to queue again the moment this lands.
  ctx.db.active_game.identity.delete(row.player0);
  ctx.db.active_game.identity.delete(row.player1);
  ctx.db.preview.game_id.delete(row.id);

  console.info(`game ${row.id} finished: seat ${winnerSeat} wins by ${reason}`);
}

// ---------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------

/** Top rated players. Derived from `player`, so it can never drift from the stored ratings. */
export const leaderboard = spacetimedb.anonymousView(
  { name: 'leaderboard', public: true },
  t.array(player.rowType),
  (ctx) =>
    [...ctx.db.player.iter()]
      .filter((row) => row.games > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 100),
);
