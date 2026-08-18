import { Platform } from "react-native";
import { Identity } from "spacetimedb";
import { DbConnection } from "../module_bindings";
import type { Cell, CompleteMove, GameState, LeaderboardEntry, MatchSnapshot, Player, TurnPreview } from "../shared/types";
import { avatarUrl } from "./avatars";
import { normalizeServerUrl as normalize, platformDefault } from "./serverUrl";

/**
 * The SpacetimeDB half of the app.
 *
 * Everything the game needs from the network is behind this one class, so `controller.ts` stays a
 * pure state machine and never imports a database type. There are two things worth knowing about
 * how it works:
 *
 * 1. There are no requests. The connection subscribes to a handful of SQL queries once, and from
 *    then on the local cache *is* the server state. `snapshot()`, `friends()` and the rest read that
 *    cache synchronously; `onChange` fires whenever any of it moves.
 *
 * 2. Reads are scoped with `:sender`, so a client only ever replicates its own games, its own queue
 *    ticket and its own half of each friendship. `player` is the exception: it is public, because
 *    the leaderboard and the online count are built from it.
 */

export type FriendState = 0 | 1 | 2 | 3;

export interface NetFriend {
  /** Hex identity. Stable, and safe to use as a React key. */
  id: string;
  /** Kept so reducer calls never have to rebuild an Identity from a string. */
  identity: Identity;
  username: string;
  avatarUrl: string;
  state: FriendState;
  online: boolean;
}

export interface NetProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  games: number;
  avatarUrl: string;
  avatarStyle: string;
  avatarSeed: string;
  /** True until a username is chosen. Guests may play casual but not ranked. */
  guest: boolean;
}

export interface NetMatch {
  gameId: bigint;
  seat: Player;
  snapshot: MatchSnapshot;
  /** What the opponent is drawing right now, or undefined when it is not their turn. */
  remote?: TurnPreview;
}

type GameRow = NonNullable<ReturnType<DbConnection["db"]["game"]["id"]["find"]>>;
type PlayerRow = NonNullable<ReturnType<DbConnection["db"]["player"]["identity"]["find"]>>;

const toCell = (index: number): Cell => [index % 4, Math.floor(index / 4)];
const toIndex = (cell: Cell): number => cell[1] * 4 + cell[0];

/** Where to connect when nothing has been configured or stored. */
export function defaultServerUrl(): string {
  return platformDefault(Platform.OS, typeof location !== "undefined" ? location : undefined);
}

/** See {@link normalize}. Wrapped here so callers do not have to supply the fallback themselves. */
export function normalizeServerUrl(value: string): string {
  return normalize(value, defaultServerUrl());
}

export const DATABASE_NAME = String(process.env.EXPO_PUBLIC_SPACETIMEDB_NAME ?? "l-game").trim() || "l-game";

export class SpacetimeNet {
  private connection?: DbConnection;
  private self?: Identity;
  private ready = false;
  private failure = "";

  constructor(private readonly onChange: () => void) {}

  get connected() {
    return this.ready && !!this.connection;
  }

  get error() {
    return this.failure;
  }

  get identity() {
    return this.self?.toHexString();
  }

  /**
   * Opens the connection and waits until the first snapshot of every subscribed query has arrived,
   * so callers can read state immediately afterwards rather than polling for it.
   *
   * Resolves with the auth token to persist: reusing it is what makes an account survive a restart.
   */
  connect(uri: string, token: string): Promise<string> {
    this.disconnect();
    this.failure = "";

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.failure = message;
        this.onChange();
        reject(new Error(message));
      };

      const builder = DbConnection.builder()
        .withUri(uri)
        .withDatabaseName(DATABASE_NAME)
        .onConnect((connection, identity, issued) => {
          this.connection = connection;
          this.self = identity;

          connection
            .subscriptionBuilder()
            .onApplied(() => {
              this.ready = true;
              this.onChange();
              if (!settled) {
                settled = true;
                resolve(issued);
              }
            })
            .onError((ctx) => fail(ctx.event?.message ?? "Could not subscribe to the game database."))
            .subscribe([
              // Public: the leaderboard, the online count, and opponent profiles.
              "SELECT * FROM player",
              // Scoped to this account.
              "SELECT * FROM game WHERE player0 = :sender",
              "SELECT * FROM game WHERE player1 = :sender",
              "SELECT * FROM active_game WHERE identity = :sender",
              "SELECT * FROM queue_entry WHERE identity = :sender",
              "SELECT * FROM friend_edge WHERE owner = :sender",
              // One row per live game; the reducer only writes it for the player on move.
              "SELECT * FROM preview",
            ]);

          for (const table of [
            connection.db.player,
            connection.db.game,
            connection.db.activeGame,
            connection.db.queueEntry,
            connection.db.friendEdge,
            connection.db.preview,
          ] as { onInsert: Function; onUpdate: Function; onDelete: Function }[]) {
            table.onInsert(() => this.onChange());
            table.onUpdate(() => this.onChange());
            table.onDelete(() => this.onChange());
          }
        })
        .onConnectError((_ctx, error) => fail(error.message || "Could not reach the game server."))
        .onDisconnect(() => {
          this.ready = false;
          this.onChange();
        });

      if (token) builder.withToken(token);
      builder.build();
    });
  }

  disconnect() {
    const connection = this.connection;
    this.connection = undefined;
    this.self = undefined;
    this.ready = false;
    try {
      connection?.disconnect();
    } catch {
      /* already gone */
    }
  }

  // -------------------------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------------------------

  private me(): PlayerRow | undefined {
    if (!this.connection || !this.self) return undefined;
    return this.connection.db.player.identity.find(this.self) ?? undefined;
  }

  private toProfile(row: PlayerRow): NetProfile {
    return {
      id: row.identity.toHexString(),
      username: row.username,
      rating: Math.round(row.rating),
      wins: row.wins,
      losses: row.losses,
      games: row.games,
      avatarUrl: avatarUrl(row.avatarStyle, row.avatarSeed),
      avatarStyle: row.avatarStyle,
      avatarSeed: row.avatarSeed,
      guest: row.guest,
    };
  }

  profile(): NetProfile | undefined {
    const row = this.me();
    return row ? this.toProfile(row) : undefined;
  }

  onlineCount(): number {
    if (!this.connection) return 0;
    let total = 0;
    for (const row of this.connection.db.player.iter()) if (row.online) total += 1;
    return total;
  }

  /** Ranked players, best first. The server's `leaderboard` view has the same ordering. */
  private ranked(): PlayerRow[] {
    if (!this.connection) return [];
    return [...this.connection.db.player.iter()]
      .filter((row) => row.games > 0)
      .sort((a, b) => b.rating - a.rating);
  }

  leaderboard(limit = 50): LeaderboardEntry[] {
    return this.ranked()
      .slice(0, limit)
      .map((row, index) => ({
        id: row.identity.toHexString(),
        username: row.username,
        rating: Math.round(row.rating),
        wins: row.wins,
        losses: row.losses,
        games: row.games,
        avatarUrl: avatarUrl(row.avatarStyle, row.avatarSeed),
        rank: index + 1,
      }));
  }

  /** The caller's position in the full ranking, not just the page the leaderboard shows. */
  ownRank(): { rank: number; of: number } | undefined {
    const all = this.ranked();
    if (!this.self) return undefined;
    const index = all.findIndex((row) => row.identity.equals(this.self!));
    return index < 0 ? undefined : { rank: index + 1, of: all.length };
  }

  friends(): NetFriend[] {
    if (!this.connection || !this.self) return [];
    const out: NetFriend[] = [];
    for (const edge of this.connection.db.friendEdge.iter()) {
      if (!edge.owner.equals(this.self)) continue;
      const row = this.connection.db.player.identity.find(edge.other);
      out.push({
        id: edge.other.toHexString(),
        identity: edge.other,
        username: row?.username ?? "Player",
        avatarUrl: row ? avatarUrl(row.avatarStyle, row.avatarSeed) : "",
        state: (edge.state <= 3 ? edge.state : 0) as FriendState,
        online: !!row?.online,
      });
    }
    return out.sort((a, b) => a.username.localeCompare(b.username));
  }

  queuedFor(): "casual" | "ranked" | undefined {
    if (!this.connection || !this.self) return undefined;
    const row = this.connection.db.queueEntry.identity.find(this.self);
    if (!row) return undefined;
    return row.mode === "ranked" ? "ranked" : "casual";
  }

  private stateOf(row: GameRow): GameState {
    return {
      pieces: [Array.from(row.p0Cells).map(toCell), Array.from(row.p1Cells).map(toCell)],
      neutrals: [toCell(row.neutral0), toCell(row.neutral1)],
      turn: (row.turn === 1 ? 1 : 0) as Player,
      winner: (row.winner === 0 || row.winner === 1 ? row.winner : -1) as GameState["winner"],
      turnNumber: row.turnNumber,
    };
  }

  /** The game this account is in, live or just finished, as the snapshot the controller consumes. */
  current(lastGameId?: bigint): NetMatch | undefined {
    if (!this.connection || !this.self) return undefined;

    const active = this.connection.db.activeGame.identity.find(this.self);
    const row = active
      ? this.connection.db.game.id.find(active.gameId)
      : lastGameId
        ? this.connection.db.game.id.find(lastGameId)
        : undefined;
    if (!row) return undefined;

    const seat: Player = row.player0.equals(this.self) ? 0 : 1;
    const names = [row.name0, row.name1];
    const ratings = [row.ratingBefore0, row.ratingBefore1];
    const rows = [
      this.connection.db.player.identity.find(row.player0),
      this.connection.db.player.identity.find(row.player1),
    ];
    const connected: [boolean, boolean] = [row.reconnectBy0 === 0n, row.reconnectBy1 === 0n];

    const snapshot: MatchSnapshot = {
      state: this.stateOf(row),
      clocks: [Number(row.clock0Ms) / 1000, Number(row.clock1Ms) / 1000],
      // The server starts a game only once both players are queued, so a seated game is playable.
      ready: connected[0] && connected[1],
      players: 2,
      endReason: row.endReason === "time" || row.endReason === "forfeit" ? row.endReason : "moves",
      ranked: row.mode === "ranked",
      competitors: [0, 1].map((index) => ({
        id: index === 0 ? row.player0.toHexString() : row.player1.toHexString(),
        username: names[index]!,
        rating: ratings[index]!,
        avatarUrl: rows[index] ? avatarUrl(rows[index]!.avatarStyle, rows[index]!.avatarSeed) : undefined,
      })) as MatchSnapshot["competitors"],
      connected,
      reconnectUntil: [Number(row.reconnectBy0), Number(row.reconnectBy1)] as [number, number],
    };

    const relay = this.connection.db.preview.gameId.find(row.id);
    const remote =
      relay && relay.seat !== seat && row.winner < 0
        ? {
            drawn: Array.from(relay.drawn).map(toCell),
            ...(relay.candidate.length === 4 ? { l: Array.from(relay.candidate).map(toCell) } : {}),
            neutral: (relay.neutral === 0 || relay.neutral === 1 ? relay.neutral : -1) as TurnPreview["neutral"],
            ...(relay.destination >= 0 ? { destination: toCell(relay.destination) } : {}),
          }
        : undefined;

    return { gameId: row.id, seat, snapshot, remote };
  }

  // -------------------------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------------------------

  private reducers() {
    if (!this.connection || !this.ready) throw new Error("Not connected to the game server.");
    return this.connection.reducers;
  }

  setUsername(username: string) {
    return this.reducers().setProfile({ username, avatarStyle: "", avatarSeed: "" });
  }

  setAvatar(style: string, seed: string) {
    return this.reducers().setAvatar({ style, seed });
  }

  deleteAccount() {
    return this.reducers().deleteAccount({});
  }

  enqueue(mode: "casual" | "ranked") {
    return this.reducers().enqueue({ mode });
  }

  dequeue() {
    return this.reducers().dequeue({});
  }

  playMove(gameId: bigint, move: CompleteMove) {
    return this.reducers().playMove({
      gameId,
      cells: Uint8Array.from(move.l.map(toIndex)),
      neutral: move.neutral,
      destination: move.destination ? toIndex(move.destination) : -1,
    });
  }

  forfeit(gameId: bigint) {
    return this.reducers().forfeit({ gameId });
  }

  setPreview(gameId: bigint, preview: TurnPreview) {
    return this.reducers().setPreview({
      gameId,
      drawn: Uint8Array.from(preview.drawn.map(toIndex)),
      candidate: preview.l ? Uint8Array.from(preview.l.map(toIndex)) : new Uint8Array(),
      neutral: preview.neutral,
      destination: preview.destination ? toIndex(preview.destination) : -1,
    });
  }

  sendFriendRequest(username: string) {
    return this.reducers().sendFriendRequest({ username });
  }

  acceptFriend(other: Identity) {
    return this.reducers().acceptFriend({ other });
  }

  removeFriend(other: Identity) {
    return this.reducers().removeFriend({ other });
  }

  blockFriend(other: Identity) {
    return this.reducers().blockFriend({ other });
  }
}
