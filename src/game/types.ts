import type { Cell, GameState, Player, PlayerSummary, TurnPreview } from "../shared/types";
import type { ConnectionState, LeaderboardScope, LockerCategory, Mode, Phase, Tab } from "./constants";
import type { NetFriend, NetProfile } from "./net";

export interface BoardFrame {
  pieces: [Cell[], Cell[]];
  neutrals: [Cell, Cell];
  ghost?: { cells: Cell[]; player: Player };
  drawn: Cell[];
  targets: Cell[];
  selectedNeutral: -1 | 0 | 1;
  pendingDestination?: Cell;
  watching: boolean;
  pieceSkin: number;
  boardSkin: number;
}

export interface SeatView {
  player: Player;
  name: string;
  role: string;
  avatarUrl?: string;
  seconds: number;
  active: boolean;
  connected: boolean;
}

export interface ConnectionView {
  state: ConnectionState;
  title: string;
  label: string;
  detail: string;
  time: string;
}

export interface RankedPlayer {
  id: string;
  username: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  losses: number;
  games: number;
  rank: number;
}

export interface GameView {
  initialized: boolean;
  tab: Tab;
  inMatch: boolean;
  mode: Mode;
  phase: Phase;
  state: GameState;
  board: BoardFrame;
  seats: [SeatView, SeatView];
  status: string;
  message: string;
  ranked: boolean;
  onlineReady: boolean;
  connection?: ConnectionView;
  cpuThinking: boolean;
  canAct: boolean;
  canSubmitL: boolean;
  canClear: boolean;
  canConfirmDisc: boolean;
  /** Whether the turn can be committed now - the L is placed, with or without a disc move. */
  canEndTurn: boolean;
  /** Whether the placed L can still be taken back and redrawn. */
  canUndoL: boolean;
  /** Whether a neutral disc is currently picked up. */
  discHeld: boolean;
  resultOpen: boolean;
  leaveConfirmOpen: boolean;
  result?: { title: string; detail: string; action: string };
  /** The signed-in player. Always present once connected — a new identity gets a guest profile. */
  account?: NetProfile;
  authBusy: boolean;
  authMessage: string;
  namePanel: boolean;
  deleteAccountArmed: boolean;
  ownRank?: number;
  rankCount?: number;
  onlineCount: number;
  /** Whether the SpacetimeDB connection is live; false means CPU and Pass & Play only. */
  connected: boolean;
  connecting: boolean;
  leaderboardScope: LeaderboardScope;
  leaderboard: RankedPlayer[];
  leaderboardStatus: string;
  friends: NetFriend[];
  friendsStatus: string;
  lockerCategory: LockerCategory;
  pieceSkin: number;
  boardSkin: number;
  lockerMessage: string;
  rulesOpen: boolean;
  rulesSlide: number;
  serverUrl: string;
  competitors: [PlayerSummary | undefined, PlayerSummary | undefined];
  remote?: TurnPreview;
}
