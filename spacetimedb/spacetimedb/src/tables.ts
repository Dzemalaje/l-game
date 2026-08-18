import { table, t } from 'spacetimedb/server';

/**
 * Table definitions for the L Game.
 *
 * These are bound into a schema by `index.ts`, which also owns the scheduled tables - keeping the
 * scheduled tables next to the reducers they point at avoids an import cycle between the two files.
 *
 * Everything a client is allowed to see is a public table it subscribes to; everything a client is
 * allowed to change goes through a reducer in `index.ts`. There is no other write path, so the
 * board in `game` is authoritative by construction.
 *
 * Two design choices worth knowing before changing anything here:
 *
 * 1. `active_game` exists only so "which game am I in?" is a primary-key lookup instead of a scan
 *    over every game ever played. It is inserted when a game starts and deleted when it ends, and
 *    it is also what stops one account from being placed in two live games at once.
 *
 * 2. `player` carries the full Glicko-2 triple (rating, deviation, volatility), not just the
 *    display number. Ranks are derived from this one table by the `leaderboard` view, so a rating
 *    update and the leaderboard can never disagree.
 */

/** A cell is an index `y * 4 + x` in 0..15. Pieces are four of them, in the order they were drawn. */
const cells = t.array(t.u8());

export const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    /** Display name. `username_key` holds the lowercased form and carries the uniqueness. */
    username: t.string(),
    username_key: t.string().unique(),
    avatar_style: t.string(),
    avatar_seed: t.string(),

    rating: t.f64(),
    deviation: t.f64(),
    volatility: t.f64(),
    wins: t.u32(),
    losses: t.u32(),
    games: t.u32(),
    /** When the rating was last recomputed; Glicko inflates deviation over idle periods. */
    rated_at: t.timestamp(),

    /** True while at least one connection for this identity is open. */
    online: t.bool(),
    /** Guests are auto-created on connect and may not play ranked. */
    guest: t.bool(),
    created_at: t.timestamp(),
    last_seen: t.timestamp(),
  },
);

/**
 * One row per open websocket. A single identity can hold several (multiple tabs or devices), so
 * `online` is "this table has at least one row for me", not a flag any single connection owns.
 */
export const connection = table(
  { name: 'connection' },
  {
    connection_id: t.connectionId().primaryKey(),
    identity: t.identity().index('btree'),
    connected_at: t.timestamp(),
  },
);

export const queue_entry = table(
  { name: 'queue_entry', public: true },
  {
    identity: t.identity().primaryKey(),
    /** 'casual' or 'ranked'. */
    mode: t.string().index('btree'),
    /** Read from `player` when queueing; never accepted from the client. */
    rating: t.i32(),
    /**
     * When this search began. Preserved across a quick re-queue so leaving and rejoining cannot be
     * used to keep an already-widened rating window.
     */
    queued_at: t.timestamp(),
  },
);

export const game = table(
  { name: 'game', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** 'casual' or 'ranked'. */
    mode: t.string(),
    player0: t.identity().index('btree'),
    player1: t.identity().index('btree'),
    /** Denormalised so a finished game still renders after a profile changes. */
    name0: t.string(),
    name1: t.string(),

    p0_cells: cells,
    p1_cells: cells,
    neutral0: t.u8(),
    neutral1: t.u8(),
    turn: t.u8(),
    turn_number: t.u32(),
    /** -1 while the game is live, otherwise the winning seat. */
    winner: t.i8(),
    /** '' while live, then 'moves', 'time' or 'forfeit'. */
    end_reason: t.string(),

    clock0_ms: t.i64(),
    clock1_ms: t.i64(),
    /**
     * The instant the clocks were last charged. Any code that reads or writes a clock first bills
     * the interval since this timestamp to whoever is on move, then advances it - so the tick and
     * a move can never double-count the same second.
     */
    charged_at: t.timestamp(),

    /**
     * Epoch milliseconds by which that seat must be back, or 0 while it is connected. The opponent
     * wins by forfeit once the deadline passes.
     */
    reconnect_by0: t.i64(),
    reconnect_by1: t.i64(),

    rating_before0: t.i32(),
    rating_before1: t.i32(),
    /** Filled in when a ranked game ends; 0 for casual. */
    rating_after0: t.i32(),
    rating_after1: t.i32(),

    started_at: t.timestamp(),
    finished_at: t.option(t.timestamp()),
  },
);

/** Points an identity at its one live game, so the lookup is a primary-key hit. */
export const active_game = table(
  { name: 'active_game', public: true },
  {
    identity: t.identity().primaryKey(),
    game_id: t.u64().index('btree'),
  },
);

/**
 * The live "opponent is thinking" relay: the cells drawn so far, and a candidate L once four are
 * chosen. Only the player on move may write, and only a placement that is actually legal is
 * relayed, so this cannot be used to show the opponent a board that could never happen.
 */
export const preview = table(
  { name: 'preview', public: true },
  {
    game_id: t.u64().primaryKey(),
    seat: t.u8(),
    drawn: cells,
    /** Empty until four cells form a legal L. */
    candidate: cells,
    neutral: t.i8(),
    /** -1 when no disc is being moved. */
    destination: t.i8(),
    updated_at: t.timestamp(),
  },
);

/**
 * Friendship as directed edges: one row per person per relationship, so each side can be read with
 * a single `owner = :sender` subscription and neither player can see the other's whole social graph.
 *
 * `state` uses the same numbering the UI already speaks: 0 mutual, 1 request sent, 2 request
 * received, 3 blocked.
 */
export const friend_edge = table(
  {
    name: 'friend_edge',
    public: true,
    indexes: [{ accessor: 'by_owner_other', algorithm: 'btree', columns: ['owner', 'other'] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    other: t.identity(),
    state: t.u8(),
    created_at: t.timestamp(),
  },
);

/** Finished games, kept for history and the profile record. */
export const match = table(
  { name: 'match', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    game_id: t.u64().unique(),
    mode: t.string(),
    reason: t.string(),

    /**
     * Null once that account is deleted. The names below are captured at match end, so the other
     * player keeps their history in anonymised form instead of losing the record entirely.
     */
    winner: t.option(t.identity()),
    loser: t.option(t.identity()),
    winner_name: t.string(),
    loser_name: t.string(),

    moves: t.u32(),
    winner_clock_ms: t.i64(),
    loser_clock_ms: t.i64(),

    /** 0 for casual games, which are unrated. */
    winner_rating_before: t.i32(),
    winner_rating_after: t.i32(),
    loser_rating_before: t.i32(),
    loser_rating_after: t.i32(),

    started_at: t.timestamp(),
    finished_at: t.timestamp(),
  },
);

