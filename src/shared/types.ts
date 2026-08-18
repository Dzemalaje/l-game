export type Cell = readonly [x: number, y: number];

export type Player = 0 | 1;

/** -1 means "leave both neutral discs where they are". */
export type NeutralChoice = -1 | 0 | 1;

export interface GameState {
  pieces: [Cell[], Cell[]];
  neutrals: [Cell, Cell];
  turn: Player;
  winner: -1 | Player;
  turnNumber: number;
}

export interface CompleteMove {
  l: Cell[];
  neutral: NeutralChoice;
  destination?: Cell;
}

/**
 * A turn in progress, relayed to the opponent so they can watch the L being drawn and the disc
 * being placed. Advisory only — nothing here is ever applied to the authoritative board.
 */
export interface TurnPreview {
  drawn: Cell[];
  l?: Cell[];
  neutral: NeutralChoice;
  destination?: Cell;
}

export type EndReason = "moves" | "time" | "forfeit";

export interface PlayerSummary {
  id?: string;
  username: string;
  rating?: number;
  avatarUrl?: string;
}

export interface MatchSnapshot {
  state: GameState;
  clocks: [number, number];
  ready: boolean;
  players: number;
  endReason?: EndReason;
  ranked?: boolean;
  competitors?: [PlayerSummary | undefined, PlayerSummary | undefined];
  /** Connection state per reserved seat; false pauses the match during its reconnection grace. */
  connected?: [boolean, boolean];
  /** Unix milliseconds until a disconnected seat is forfeited; zero means no grace is active. */
  reconnectUntil?: [number, number];
}

export interface AccountUser {
  id: string;
  email: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  games: number;
  avatarUrl: string;
  avatarStyle: string;
  avatarSeed: string;
}

export interface LeaderboardEntry extends Omit<AccountUser, "email" | "avatarStyle" | "avatarSeed"> {
  rank: number;
}
