import type { Cell, GameState, Player, PlayerSummary, TurnPreview } from "../shared/types";
import type {
  ConnectionState,
  IntroStage,
  LeaderboardScope,
  LockerCategory,
  Mode,
  Phase,
  Tab,
} from "./constants";
import type { NetFriend, NetProfile } from "./net";

export interface BoardFrame {
  pieces: [Cell[], Cell[]];
  neutrals: [Cell, Cell];
  /**
   * Where the moving player's L was, drawn as translucent dots. `lifted` means the piece has not
   * been placed yet, so these cells are the piece rather than a trail behind it and no solid
   * squares should be drawn on them.
   */
  ghost?: { cells: Cell[]; player: Player; lifted: boolean };
  drawn: Cell[];
  targets: Cell[];
  /** A suggested legal L, ringed in the mover's colour after the player asks to be shown one. */
  hint: Cell[];
  /**
   * Squares to ring in a contrasting paper white, for pointing at a piece rather than at a move.
   *
   * Separate from `hint` because these land on top of a piece: a ring in the piece's own colour is
   * invisible, which is exactly what happened to the trapped L on the result screen.
   */
  outlined: Cell[];
  selectedNeutral: -1 | 0 | 1;
  pendingDestination?: Cell;
  /** The L is placed and it is this player's move, so the discs can be picked up. */
  discsMovable: boolean;
  /** Whoever is on the move. The board's lift is tinted with this side's colour. */
  mover: Player;
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
  /** This seat is on the move with 30 seconds or less, which the match screen shows in red. */
  urgent: boolean;
}

/** Whose colour the directive panel wears, and therefore what kind of state it is reporting. */
export type DirectiveTone = "you" | "them" | "waiting" | "alert";

/**
 * The one instruction panel, taken apart into the pieces the layout sizes separately.
 *
 * Every match state produces one of these, so no screen has to work out for itself what to say
 * when a turn, a connection and a clock are all doing something at once.
 */
export interface DirectiveView {
  /** Who is on the move: "Your turn", "Mira's turn", "Reconnecting". */
  badge: string;
  /** Which half of the turn this is: "Step 1 of 2", "Step 2 of 2 · optional". */
  step: string;
  /** The instruction itself, in the largest type on the panel. */
  title: string;
  /** One supporting sentence: what to do, or why there is nothing to do. */
  body: string;
  /** Label beside the progress pips, e.g. "2 of 4 squares". */
  progress: string;
  /** How many of the L's four squares are down, for the pips. */
  filled: number;
  /** Whether progress means anything here; queueing and reconnecting have none. */
  showProgress: boolean;
  /** Waiting on somebody or something else, rather than on the player. */
  busy: boolean;
  tone: DirectiveTone;
}

/** The three action slots under the board. All three always render; unavailable ones grey out. */
export interface ActionsView {
  canUndo: boolean;
  /** Accessible name for the undo control, which has an icon rather than a label. */
  undoLabel: string;
  secondaryLabel: string;
  canSecondary: boolean;
  primaryLabel: string;
  canPrimary: boolean;
  /** Whether asking to be shown a legal L would do anything. */
  canHint: boolean;
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
  /** The instruction panel under the board. */
  directive: DirectiveView;
  /** The three action slots under that. */
  actions: ActionsView;
  /** The win condition, shown above the board for the whole match. */
  objective: string;
  /** 1-based, and shown in the match header so a long game has a sense of progress. */
  turnNumber: number;
  /** A flat reading of `directive` for screen readers and tests. */
  status: string;
  message: string;
  ranked: boolean;
  onlineReady: boolean;
  connection?: ConnectionView;
  cpuThinking: boolean;
  canAct: boolean;
  resultOpen: boolean;
  leaveConfirmOpen: boolean;
  result?: {
    title: string;
    detail: string;
    action: string;
    /** Whether the local player won. In pass-and-play both sides are local, so this is always true. */
    won: boolean;
    /** Who ran out of moves, time, or patience. */
    loser: string;
    /** One sentence naming how the match ended. */
    reason: string;
    turns: number;
    ranked: boolean;
    ratingBefore?: number;
    /** Present only once the server's new rating has replicated, so the delta is never guessed. */
    ratingAfter?: number;
  };
  /** The signed-in player. Always present once connected — a new identity gets a guest profile. */
  account?: NetProfile;
  authBusy: boolean;
  authMessage: string;
  namePanel: boolean;
  deleteAccountArmed: boolean;
  ownRank?: number;
  rankCount?: number;
  onlineCount: number;
  /** Whether the SpacetimeDB connection is live; false means the computer and pass and play only. */
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
  /** Which first-run screen is showing, or undefined once the intro is done with. */
  intro?: IntroStage;
  serverUrl: string;
  competitors: [PlayerSummary | undefined, PlayerSummary | undefined];
  remote?: TurnPreview;
}
