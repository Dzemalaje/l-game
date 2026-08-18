import { BOARD_SKINS, PIECE_SKINS, boardSkin, pieceSkin } from "../skins";
import {
  applyCompleteMove,
  boardSignature,
  chooseCpuMove,
  cloneState,
  initialState,
  isLegalNeutralDestination,
  legalContinuations,
  parseState,
  pathsForPlacement,
  placementForDraw,
  sameCell,
} from "../shared/rules";
import type {
  Cell,
  CompleteMove,
  EndReason,
  MatchSnapshot,
  Player,
  PlayerSummary,
  TurnPreview,
} from "../shared/types";
import {
  CLOCK_SECONDS,
  PREVIEW_INTERVAL_MS,
  STORAGE,
  type ConnectionState,
  type LeaderboardScope,
  type LockerCategory,
  type Mode,
  type Phase,
  type Tab,
} from "./constants";
import { SpacetimeNet, defaultServerUrl, normalizeServerUrl, type NetFriend, type NetProfile } from "./net";
import { storage } from "./storage";
import type { BoardFrame, ConnectionView, GameView, RankedPlayer, SeatView } from "./types";

type Listener = () => void;
type Timer = ReturnType<typeof setTimeout>;

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nowMs = () => Date.now();

const reason = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * Platform-neutral game application state. React is deliberately kept out of this class: replicated
 * SpacetimeDB rows, CPU turns, and clocks update one state machine which web, iOS, and Android all
 * observe.
 *
 * Online play is not a request/response conversation with a server. The connection in `net`
 * replicates this account's rows continuously, and `syncFromNet` folds whatever arrived into the
 * same `applySnapshot` path the previous backend fed — so everything below the network layer, the
 * board, the clocks, the CPU and the whole view model, is unchanged and backend-agnostic.
 */
export class GameController {
  private readonly listeners = new Set<Listener>();
  private initialized = false;
  private disposed = false;
  private tickTimer?: Timer;

  private tab: Tab = "play";
  private inMatch = false;
  private mode: Mode = "cpu";
  private phase: Phase = "l";
  /**
   * Lobby and account text - offline notices, queue state, "signed out".
   *
   * Split from `message`, which is the in-match prompt. They shared one field, and because the
   * status line prefers `message` whenever you can act, a failed background connection would
   * replace "Drag through four highlighted squares" with a note about the server for the rest of
   * the match. Two audiences, two fields.
   */
  private notice = "";
  private state = initialState();
  private pendingL?: Cell[];
  private ghost?: Cell[];
  private drawn: Cell[] = [];
  private selectedNeutral: -1 | 0 | 1 = -1;
  private destination?: Cell;

  private clocks: [number, number] = [CLOCK_SECONDS, CLOCK_SECONDS];
  private clockBase = nowMs();
  private paused = false;
  private endReason: EndReason = "moves";

  private localPlayer: Player = 0;
  private onlineReady = false;
  private connectionState: ConnectionState = "idle";
  private connectionDetail = "";
  private connectionSince = nowMs();
  private reconnectDeadline = 0;
  private seatConnected: [boolean, boolean] = [false, false];
  /** The one live connection. Opened at startup and kept open; online play is a subscription. */
  private readonly net = new SpacetimeNet(() => this.syncFromNet());
  private connecting = false;
  private gameId?: bigint;
  /**
   * The turn number an optimistically-played move advanced us to, or 0 when nothing is in flight.
   *
   * A move is applied locally before the server confirms it, so the turn feels immediate. Any table
   * change re-reads the whole cache, though, which means a snapshot can be rebuilt from the *old*
   * game row in the window before our move replicates. Without this guard that stale snapshot rolls
   * the board back, and for a moment both players believe it is their turn.
   */
  private optimisticTurn = 0;
  private queueStartedAt = 0;
  private onlineGeneration = 0;
  private ranked = false;
  private competitors: [PlayerSummary | undefined, PlayerSummary | undefined] = [undefined, undefined];

  private account?: NetProfile;
  private ownRank?: number;
  private rankCount?: number;
  private authToken = "";
  private authBusy = false;
  private authMessage = "";
  private namePanel = false;
  private deleteAccountArmed = false;
  private leaderboardScope: LeaderboardScope = "global";
  private leaderboard: RankedPlayer[] = [];
  private leaderboardStatus = "";

  private friends: NetFriend[] = [];
  private friendsStatus = "";

  private cpuThinking = false;
  private cpuPreview: Cell[] = [];
  private generation = 0;
  private remote?: TurnPreview;
  private lastPreviewSent = "";
  private lastPreviewAt = 0;
  private previewTimer?: Timer;

  private pieceSkinIndex = 0;
  private boardSkinIndex = 0;
  private lockerCategory: LockerCategory = "pieces";
  private lockerMessage = "Colours are cosmetic. Side names change with the palette so turns stay readable.";
  private message = "";
  private pendingServerError = "";
  private resultOpen = false;
  private leaveConfirmOpen = false;
  private rulesOpen = false;
  private rulesSlide = 0;
  private serverUrl = defaultServerUrl();
  private onlineCount = 0;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    if (!this.disposed) for (const listener of this.listeners) listener();
  }

  async initialize() {
    if (this.initialized || this.disposed) return;
    const [piece, board, server, token] = await Promise.all([
      storage.get(STORAGE.pieceSkin, "0"),
      storage.get(STORAGE.boardSkin, "0"),
      storage.get(STORAGE.server, defaultServerUrl()),
      storage.get(STORAGE.token),
    ]);
    this.pieceSkinIndex = PIECE_SKINS.indexOf(pieceSkin(Number(piece)));
    this.boardSkinIndex = BOARD_SKINS.indexOf(boardSkin(Number(board)));
    // A stored address that no longer parses must not brick online play forever, so an unusable
    // one is replaced with the default and rewritten.
    try {
      this.serverUrl = normalizeServerUrl(server || defaultServerUrl());
    } catch {
      this.serverUrl = defaultServerUrl();
      await storage.set(STORAGE.server, this.serverUrl);
    }
    this.authToken = token;
    this.initialized = true;
    this.tickTimer = setInterval(() => this.tick(), 250) as unknown as Timer;
    this.emit();
    await this.connectNet();
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
    clearInterval(this.tickTimer);
    clearTimeout(this.previewTimer);
    this.net.disconnect();
  }

  /**
   * Opens the connection, reusing the stored token so the account survives a restart.
   *
   * Failure is not fatal: CPU and pass-and-play work offline, so a missing server downgrades the app
   * rather than blocking it.
   */
  private async connectNet(): Promise<boolean> {
    if (this.disposed || this.connecting) return this.net.connected;
    this.connecting = true;
    this.emit();

    const attempt = async (token: string) => {
      const issued = await this.net.connect(this.serverUrl, token);
      if (issued && issued !== this.authToken) {
        this.authToken = issued;
        await storage.set(STORAGE.token, issued);
      }
      this.syncFromNet();
    };

    try {
      try {
        await attempt(this.authToken);
      } catch (error) {
        // A stored token can outlive the account it names - most often because the database was
        // reset while this browser kept its old one. Only a token the server actually rejected is
        // discarded: dropping it on any failure would lose the account to a flaky connection.
        const rejected = /verify token|unauthorized|401/i.test(reason(error, ""));
        if (!this.authToken || !rejected) throw error;
        this.authToken = "";
        await storage.set(STORAGE.token, "");
        await attempt("");
      }
      return true;
    } catch (error) {
      this.notice = `Offline: ${reason(error, "could not reach the game server")}. CPU and Pass & Play still work.`;
      return false;
    } finally {
      this.connecting = false;
      this.emit();
    }
  }

  /** Ensures a connection before an action that needs one. */
  private async requireNet(): Promise<boolean> {
    if (this.net.connected) return true;
    return this.connectNet();
  }

  /**
   * Folds every replicated change into the view.
   *
   * This is the whole of the online read path: whatever the server changed - a move, a clock, a
   * rating, a friend request - arrives here as new rows and is turned into the same snapshot the
   * board already knew how to render.
   */
  private syncFromNet() {
    if (this.disposed) return;

    this.account = this.net.profile();
    this.onlineCount = this.net.onlineCount();
    this.friends = this.net.friends();
    const rank = this.net.ownRank();
    this.ownRank = rank?.rank;
    this.rankCount = rank?.of;
    if (this.tab === "leaders") this.refreshLeaderboard();

    const match = this.net.current(this.gameId);

    if (this.mode !== "online") {
      this.emit();
      return;
    }

    if (!match) {
      // No game yet: either still searching, or the queue ticket was dropped.
      if (this.gameId === undefined) {
        const queued = this.net.queuedFor();
        if (!queued && this.connectionState === "queueing") {
          this.setConnectionState("idle");
          this.inMatch = false;
          this.mode = "cpu";
          this.notice = "Search cancelled.";
        }
      }
      this.emit();
      return;
    }

    if (this.gameId !== match.gameId) {
      // A new game: adopt its seat before any of its state is rendered.
      this.gameId = match.gameId;
      this.localPlayer = match.seat;
      this.ranked = !!match.snapshot.ranked;
      this.resetMatch();
      this.inMatch = true;
      this.message = "";
      this.notice = "";
    }

    this.localPlayer = match.seat;
    this.remote = match.remote;

    const arrived = match.snapshot.state;
    if (this.optimisticTurn && arrived.winner < 0 && arrived.turnNumber < this.optimisticTurn) {
      this.emit();
      return;
    }
    if (arrived.turnNumber >= this.optimisticTurn) this.optimisticTurn = 0;
    this.applySnapshot(match.snapshot);
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.bakeClocks();
    this.paused = paused;
    this.emit();
  }

  setTab(tab: Tab) {
    if (this.inMatch) return;
    this.tab = tab;
    this.namePanel = false;
    this.deleteAccountArmed = false;
    if (tab === "leaders") void this.loadLeaderboard();
    if (tab === "friends") void this.loadFriends();
    this.emit();
  }

  /**
   * There is no sign-in form any more: the connection's identity *is* the account. Choosing a
   * username is what promotes a guest to a full account, so that panel stands in for signing in.
   */
  showAuth(show: boolean) {
    this.showNameEditor(show);
  }

  showNameEditor(show: boolean) {
    this.namePanel = show;
    this.deleteAccountArmed = false;
    this.authMessage = "";
    this.emit();
  }

  setServerUrl(value: string) {
    let next: string;
    try {
      next = normalizeServerUrl(value);
    } catch (error) {
      this.notice = reason(error, "That server address is not valid.");
      this.emit();
      return;
    }
    if (next === this.serverUrl && this.net.connected) return;
    this.serverUrl = next;
    void storage.set(STORAGE.server, next);
    this.net.disconnect();
    this.notice = "Reconnecting…";
    this.emit();
    void this.connectNet();
  }

  /** Claims a username, which is also what unlocks ranked play for a guest. */
  async changeName(username: string) {
    const wanted = username.trim();
    if (!wanted) {
      this.authMessage = "Enter a name.";
      this.emit();
      return;
    }
    this.authBusy = true;
    this.authMessage = "";
    this.emit();
    try {
      if (!(await this.requireNet())) throw new Error("The game server is unreachable.");
      await this.net.setUsername(wanted);
      this.namePanel = false;
      this.notice = `You are playing as ${wanted}.`;
    } catch (error) {
      this.authMessage = reason(error, "Could not change that name.");
    } finally {
      this.authBusy = false;
      this.syncFromNet();
    }
  }

  /**
   * Signs out by forgetting this device's identity. The next connection is issued a new one, so the
   * previous account still exists - it simply is not this device's any more.
   */
  async logout() {
    if (this.inMatch && this.mode === "online") this.leaveMatch();
    this.authToken = "";
    await storage.set(STORAGE.token, "");
    this.net.disconnect();
    this.account = undefined;
    this.friends = [];
    this.leaderboard = [];
    this.ownRank = undefined;
    this.rankCount = undefined;
    this.namePanel = false;
    this.deleteAccountArmed = false;
    this.notice = "Signed out. You are now a new guest on this device.";
    this.emit();
    await this.connectNet();
  }

  setDeleteAccountArmed(armed: boolean) {
    this.deleteAccountArmed = armed;
    this.authMessage = "";
    this.emit();
  }

  async deleteAccount() {
    if (!this.account) return;
    this.authBusy = true;
    this.authMessage = "";
    this.emit();
    try {
      if (!(await this.requireNet())) throw new Error("The game server is unreachable.");
      await this.net.deleteAccount();
      this.deleteAccountArmed = false;
      // The identity itself is still valid, so reconnecting hands back a fresh guest profile.
      await this.logout();
      this.notice = "Your account was deleted.";
    } catch (error) {
      this.authMessage = reason(error, "Could not delete that account.");
    } finally {
      this.authBusy = false;
      this.emit();
    }
  }

  /** Kept for the screens' benefit; the rank is derived from replicated rows, not fetched. */
  async loadOwnRank() {
    this.syncFromNet();
  }

  setLeaderboardScope(scope: LeaderboardScope) {
    this.leaderboardScope = scope;
    this.refreshLeaderboard();
    this.emit();
  }

  async loadLeaderboard() {
    if (!(await this.requireNet())) {
      this.leaderboardStatus = "The game server is unreachable.";
      this.emit();
      return;
    }
    this.refreshLeaderboard();
    this.emit();
  }

  /**
   * Rebuilds the visible leaderboard from replicated rows. Ranks come from the full ranking rather
   * than from the filtered list, so a friends-only view still shows real global positions.
   */
  private refreshLeaderboard() {
    const all = this.net.leaderboard(100);
    if (this.leaderboardScope === "friends") {
      const mine = new Set(this.friends.filter((friend) => friend.state === 0).map((friend) => friend.id));
      if (this.account) mine.add(this.account.id);
      this.leaderboard = all.filter((entry) => mine.has(entry.id));
      this.leaderboardStatus = this.leaderboard.length ? "" : "No ranked friends yet.";
      return;
    }
    this.leaderboard = all;
    this.leaderboardStatus = all.length ? "" : "No ranked games have been played yet.";
  }

  /** Friends replicate continuously; this only reports whether the connection is up. */
  async loadFriends(showLoading = true) {
    if (showLoading) this.friendsStatus = "";
    if (!(await this.requireNet())) {
      this.friendsStatus = "The game server is unreachable.";
      this.emit();
      return;
    }
    this.syncFromNet();
  }

  async sendFriendRequest(username: string) {
    const wanted = username.trim();
    if (!wanted) return;
    try {
      if (!(await this.requireNet())) throw new Error("The game server is unreachable.");
      await this.net.sendFriendRequest(wanted);
      this.friendsStatus = `Request sent to ${wanted}.`;
    } catch (error) {
      this.friendsStatus = reason(error, "Could not send that request.");
    }
    this.syncFromNet();
  }

  async changeFriend(kind: "accept" | "delete" | "block", friend?: NetFriend) {
    if (!friend) return;
    try {
      if (!(await this.requireNet())) throw new Error("The game server is unreachable.");
      if (kind === "accept") await this.net.acceptFriend(friend.identity);
      else if (kind === "block") await this.net.blockFriend(friend.identity);
      else await this.net.removeFriend(friend.identity);
      this.friendsStatus = "";
    } catch (error) {
      this.friendsStatus = reason(error, "Could not update friends.");
    }
    this.syncFromNet();
  }

  startMatch(mode: "cpu" | "local") {
    this.mode = mode;
    this.localPlayer = 0;
    this.ranked = false;
    this.resetMatch();
    this.setConnectionState("idle");
    this.inMatch = true;
    this.emit();
  }

  private resetMatch() {
    this.generation++;
    this.state = initialState();
    this.clocks = [CLOCK_SECONDS, CLOCK_SECONDS];
    this.clockBase = nowMs();
    this.phase = "l";
    this.pendingL = undefined;
    this.ghost = undefined;
    this.drawn = [];
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.cpuThinking = false;
    this.cpuPreview = [];
    this.endReason = "moves";
    this.optimisticTurn = 0;
    this.message = "";
    this.notice = "";
    this.pendingServerError = "";
    this.competitors = [undefined, undefined];
    this.seatConnected = [false, false];
    this.remote = undefined;
    this.lastPreviewSent = "";
    this.lastPreviewAt = 0;
    this.resultOpen = false;
    this.leaveConfirmOpen = false;
    clearTimeout(this.previewTimer);
    this.previewTimer = undefined;
  }

  restart() {
    if (this.mode === "online") {
      if (this.state.winner < 0) return;
      const ranked = this.ranked;
      void this.closeOnline(false).then(() => this.joinOnline(ranked));
      return;
    }
    this.resetMatch();
    this.inMatch = true;
    this.emit();
  }

  leaveMatch() {
    this.generation++;
    this.cpuThinking = false;
    this.cpuPreview = [];
    this.inMatch = false;
    this.resultOpen = false;
    this.leaveConfirmOpen = false;
    this.setConnectionState("idle");
    this.onlineGeneration++;
    void this.closeOnline(this.mode === "online" && this.state.winner < 0);
    this.emit();
  }

  requestLeaveMatch() {
    if (!this.inMatch) return;
    if (this.mode === "online" && this.state.winner < 0) {
      this.leaveConfirmOpen = true;
      this.emit();
      return;
    }
    this.leaveMatch();
  }

  cancelLeaveMatch() {
    this.leaveConfirmOpen = false;
    this.emit();
  }

  confirmLeaveMatch() {
    this.leaveConfirmOpen = false;
    this.leaveMatch();
  }

  private setConnectionState(state: ConnectionState, detail = "", deadline = 0) {
    if (state !== this.connectionState) this.connectionSince = nowMs();
    this.connectionState = state;
    this.connectionDetail = detail;
    this.reconnectDeadline = deadline;
    this.emit();
  }

  /**
   * Joins matchmaking.
   *
   * There is nothing to await beyond the queue call: the server pairs players on its own tick, and
   * the game arrives as a replicated row that `syncFromNet` picks up and seats us in.
   */
  async joinOnline(ranked = false) {
    if (!(await this.requireNet())) {
      this.notice = "The game server is unreachable. CPU and Pass & Play still work.";
      this.emit();
      return;
    }

    if (ranked && this.account?.guest) {
      this.notice = "Choose a username before playing ranked matches.";
      this.showNameEditor(true);
      return;
    }

    this.onlineGeneration++;
    this.mode = "online";
    this.ranked = ranked;
    this.onlineReady = false;
    this.gameId = undefined;
    this.resetMatch();
    this.queueStartedAt = nowMs();
    this.inMatch = true;
    this.setConnectionState(
      "queueing",
      ranked
        ? `Searching within 100 points of ${this.account?.rating ?? 1500}.`
        : "Searching for a casual opponent.",
    );
    this.notice = ranked ? "Entering ranked queue…" : "Entering casual queue…";
    this.emit();

    try {
      await this.net.enqueue(ranked ? "ranked" : "casual");
      this.syncFromNet();
    } catch (error) {
      this.mode = "cpu";
      this.inMatch = false;
      this.setConnectionState("idle");
      this.notice = reason(error, "Could not join the queue.");
      this.emit();
    }
  }

  /** Leaves the queue or resigns the live game, depending on which one we are in. */
  private async closeOnline(forfeit: boolean) {
    const gameId = this.gameId;
    this.gameId = undefined;
    try {
      if (gameId !== undefined && forfeit && this.state.winner < 0) {
        await this.net.forfeit(gameId);
      } else if (gameId === undefined) {
        await this.net.dequeue();
      }
    } catch {
      // Leaving is best effort: the server forfeits an abandoned seat on its own timer anyway.
    }
  }

  private applySnapshot(snapshot: MatchSnapshot) {
    const state = parseState(snapshot.state);
    if (!state) return;
    this.clocks = [Number(snapshot.clocks?.[0]) || 0, Number(snapshot.clocks?.[1]) || 0];
    this.clockBase = nowMs();
    this.onlineReady = Boolean(snapshot.ready);
    this.endReason = snapshot.endReason ?? "moves";
    this.ranked = Boolean(snapshot.ranked);
    this.competitors = snapshot.competitors ?? [undefined, undefined];
    this.seatConnected = snapshot.connected ?? [this.onlineReady, this.onlineReady];
    const reconnectingSeat = snapshot.reconnectUntil?.findIndex((deadline) => Number(deadline) > nowMs()) ?? -1;
    if (this.onlineReady) this.setConnectionState("connected", "Moves and clocks are synchronized by the server.");
    else if (reconnectingSeat >= 0) {
      const deadline = Number(snapshot.reconnectUntil?.[reconnectingSeat]) || nowMs() + 20_000;
      const who = reconnectingSeat === this.localPlayer ? "your connection" : "your opponent";
      this.setConnectionState("reconnecting", `Holding the match while ${who} reconnects.`, deadline);
    } else this.setConnectionState("waiting", "Your seat is ready. Waiting for an opponent.");

    const moved = boardSignature(state) !== boardSignature(this.state);
    this.state = state;
    if (moved || state.winner >= 0) {
      this.remote = undefined;
      this.lastPreviewSent = "";
      this.pendingL = undefined;
      this.ghost = undefined;
      this.drawn = [];
      this.selectedNeutral = -1;
      this.destination = undefined;
      this.phase = state.winner >= 0 ? "gameover" : "l";
      this.message = this.pendingServerError;
      this.pendingServerError = "";
    }
    if (!this.onlineReady && reconnectingSeat >= 0) {
      this.message = reconnectingSeat === this.localPlayer ? "Restoring your match…" : "Opponent is reconnecting…";
    } else if (!this.onlineReady) this.message = "Waiting for a second player…";
    else if (this.message.startsWith("Waiting")) this.message = "";
    if (state.winner >= 0) {
      this.resultOpen = true;
      this.leaveConfirmOpen = false;
      // A ranked result rewrites both player rows, so the new rating replicates on its own.
    }
    this.emit();
  }

  private previewState(pendingL = this.pendingL) {
    if (!pendingL) return this.state;
    const preview = cloneState(this.state);
    preview.pieces[this.state.turn] = pendingL.map((cell) => [...cell] as Cell);
    return preview;
  }

  private matchLive() {
    return this.inMatch && this.state.winner < 0 && (this.mode !== "online" || this.onlineReady);
  }

  private canAct() {
    if (!this.matchLive() || this.cpuThinking) return false;
    if (this.mode === "cpu") return this.state.turn === 0;
    if (this.mode === "online") return this.state.turn === this.localPlayer && this.connectionState === "connected";
    return true;
  }

  private targets() {
    if (!this.canAct()) return [];
    if (this.phase === "neutral") return this.selectedNeutral < 0 ? [] : this.freeCells();
    return legalContinuations(this.state, this.state.turn, this.drawn);
  }

  private freeCells() {
    const preview = this.previewState();
    const cells: Cell[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cell: Cell = [x, y];
      if (isLegalNeutralDestination(preview, cell)) cells.push(cell);
    }
    return cells;
  }

  selectCell(cell: Cell) {
    if (!this.canAct()) return;
    if (this.phase === "l") {
      let legal = legalContinuations(this.state, this.state.turn, this.drawn);
      if (!legal.some((target) => sameCell(target, cell))) {
        this.drawn = [];
        legal = legalContinuations(this.state, this.state.turn, this.drawn);
      }
      if (this.drawn.some((drawn) => sameCell(drawn, cell)) || !legal.some((target) => sameCell(target, cell))) return;
      this.extendDraw(cell);
    } else if (this.phase === "neutral") {
      const disc = this.state.neutrals.findIndex((neutral) => sameCell(neutral, cell));
      if (disc >= 0) {
        this.selectedNeutral = disc === this.selectedNeutral ? -1 : disc as 0 | 1;
        this.destination = undefined;
        this.message = this.selectedNeutral < 0 ? "Move a disc, or end your turn." : "Drop it on a highlighted square.";
      } else if (this.selectedNeutral >= 0 && isLegalNeutralDestination(this.previewState(), cell)) {
        this.destination = cell;
        this.message = "Disc placed. End your turn when ready.";
      }
    }
    this.relayTurnInProgress();
    this.emit();
  }

  /**
   * Pointer drag across the board while drawing an L.
   *
   * Unlike `selectCell`, an illegal square is ignored rather than restarting the draw: a finger
   * sliding to the next square passes over whatever lies between it and the target, and wiping the
   * path every time it clipped a corner made dragging unusable. Sliding back onto the previous
   * square rubs the last one out, which is what people try first after overshooting.
   */
  drawTo(cell: Cell) {
    if (!this.canAct() || this.phase !== "l") return;
    const existing = this.drawn.findIndex((drawn) => sameCell(drawn, cell));
    if (existing >= 0) {
      if (existing !== this.drawn.length - 2) return;
      this.drawn = this.drawn.slice(0, -1);
      this.message = "Keep going through the highlighted squares.";
      this.relayTurnInProgress();
      this.emit();
      return;
    }
    const legal = legalContinuations(this.state, this.state.turn, this.drawn);
    if (!legal.some((target) => sameCell(target, cell))) return;
    this.extendDraw(cell);
    this.relayTurnInProgress();
    this.emit();
  }

  /**
   * Adds one square to the drawn path and, once four of them make a legal L, moves straight on to
   * the disc. The old flow needed a separate Submit press, but a finished L has exactly one legal
   * meaning, so that press carried no information. `backToDraw` is what makes dropping it safe.
   */
  private extendDraw(cell: Cell) {
    this.drawn = [...this.drawn, cell];
    if (this.drawn.length === 4 && this.beginDiscPhase()) return;
    this.message = "Continue through a highlighted square.";
  }

  clearDraw() {
    if (!this.canAct() || this.phase !== "l") return;
    this.drawn = [];
    this.message = "";
    this.relayTurnInProgress();
    this.emit();
  }

  submitL() {
    if (!this.canAct() || this.phase !== "l") return;
    if (!this.beginDiscPhase()) {
      this.message = "Draw a complete legal L first.";
      this.emit();
      return;
    }
    this.relayTurnInProgress();
    this.emit();
  }

  private beginDiscPhase() {
    const placement = placementForDraw(this.state, this.state.turn, this.drawn);
    if (!placement) return false;
    this.ghost = this.state.pieces[this.state.turn].map((cell) => [...cell] as Cell);
    this.pendingL = placement.map((cell) => [...cell] as Cell);
    this.drawn = [];
    this.phase = "neutral";
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.message = "Move a disc, or end your turn.";
    return true;
  }

  /** Undo a placed L and draw it again. Nothing is committed until `endTurn`, so this costs nothing. */
  backToDraw() {
    if (!this.canAct() || this.phase !== "neutral") return;
    this.pendingL = undefined;
    this.ghost = undefined;
    this.drawn = [];
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.phase = "l";
    this.message = "Draw your L again.";
    this.relayTurnInProgress();
    this.emit();
  }

  /** A pointer picked up a neutral disc. */
  pickDisc(index: 0 | 1) {
    if (!this.canAct() || this.phase !== "neutral") return;
    this.selectedNeutral = index;
    this.destination = undefined;
    this.message = "Drop it on a highlighted square.";
    this.relayTurnInProgress();
    this.emit();
  }

  /** A held disc was dragged over `cell`; only a legal square sticks. */
  dragDiscTo(cell: Cell) {
    if (!this.canAct() || this.phase !== "neutral" || this.selectedNeutral < 0) return;
    if (this.destination && sameCell(this.destination, cell)) return;
    if (!isLegalNeutralDestination(this.previewState(), cell)) return;
    this.destination = cell;
    this.message = "Disc placed. End your turn when ready.";
    this.relayTurnInProgress();
    this.emit();
  }

  /** Puts a held disc back where it started. */
  returnDisc() {
    if (!this.canAct() || this.phase !== "neutral") return;
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.message = "Move a disc, or end your turn.";
    this.relayTurnInProgress();
    this.emit();
  }

  /** Commits the turn: with the disc move when one was made, without it otherwise. */
  endTurn() {
    if (this.selectedNeutral >= 0 && this.destination) return this.commitTurn(this.selectedNeutral, this.destination);
    this.commitTurn(-1);
  }

  confirmDisc() {
    this.commitTurn(this.selectedNeutral, this.destination);
  }

  skipDisc() {
    this.commitTurn(-1);
  }

  private commitTurn(neutral: -1 | 0 | 1, destination?: Cell) {
    if (!this.canAct() || this.phase !== "neutral" || !this.pendingL) return;
    if (neutral >= 0 && !destination) {
      this.message = "Choose a disc and an empty destination.";
      this.emit();
      return;
    }
    const move: CompleteMove = { l: this.pendingL, neutral, destination };
    const next = cloneState(this.state);
    if (!applyCompleteMove(next, move)) {
      this.message = "That complete turn is not legal.";
      this.emit();
      return;
    }
    if (this.mode === "online") {
      if (this.gameId === undefined || this.connectionState !== "connected") {
        this.message = "The connection is not ready. Wait for it to reconnect.";
        this.emit();
        return;
      }
      // Played optimistically: the board below advances straight away so the turn feels immediate,
      // and the authoritative row replicates back a moment later. A move the server rejects simply
      // never arrives, and the next snapshot puts the board back.
      this.optimisticTurn = next.turnNumber;
      void this.net.playMove(this.gameId, move).catch((error: unknown) => {
        // Rejected: stop ignoring older snapshots so the authoritative board can roll us back.
        this.optimisticTurn = 0;
        this.pendingServerError = reason(error, "That move was rejected.");
        this.syncFromNet();
      });
    }
    this.bakeClocks();
    this.state = next;
    this.pendingL = undefined;
    this.drawn = [];
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.ghost = undefined;
    this.phase = this.state.winner >= 0 ? "gameover" : "l";
    this.endReason = "moves";
    this.message = "";
    if (this.state.winner >= 0) {
      this.resultOpen = true;
      this.leaveConfirmOpen = false;
    }
    this.emit();
    if (this.mode === "cpu" && this.state.winner < 0) void this.runCpuTurn();
  }

  private async runCpuTurn() {
    const generation = ++this.generation;
    const valid = () => generation === this.generation && this.mode === "cpu" && this.state.turn === 1 && this.state.winner < 0;
    this.cpuThinking = true;
    this.cpuPreview = [];
    this.emit();
    await delay(300);
    if (!valid()) return this.abortCpu(generation);
    const move = chooseCpuMove(this.state);
    if (!move) return this.abortCpu(generation);
    this.ghost = this.state.pieces[1].map((cell) => [...cell] as Cell);
    const path = pathsForPlacement(move.l)[0] ?? move.l;
    for (const cell of path) {
      this.cpuPreview = [...this.cpuPreview, cell];
      this.emit();
      await delay(140);
      if (!valid()) return this.abortCpu(generation);
    }
    this.pendingL = move.l.map((cell) => [...cell] as Cell);
    this.cpuPreview = [];
    if (move.neutral >= 0 && move.destination) {
      this.selectedNeutral = move.neutral;
      this.destination = move.destination;
      this.emit();
      await delay(480);
    } else await delay(200);
    if (!valid()) return this.abortCpu(generation);
    const next = cloneState(this.state);
    if (!applyCompleteMove(next, move)) return this.abortCpu(generation);
    this.bakeClocks();
    this.state = next;
    this.cpuThinking = false;
    this.pendingL = undefined;
    this.ghost = undefined;
    this.selectedNeutral = -1;
    this.destination = undefined;
    this.phase = this.state.winner >= 0 ? "gameover" : "l";
    this.endReason = "moves";
    if (this.state.winner >= 0) {
      this.resultOpen = true;
      this.leaveConfirmOpen = false;
    }
    this.emit();
  }

  private abortCpu(generation: number) {
    if (generation !== this.generation) return;
    this.cpuThinking = false;
    this.cpuPreview = [];
    this.pendingL = undefined;
    this.ghost = undefined;
    this.emit();
  }

  private remaining(player: Player) {
    const running = player === this.state.turn && this.matchLive() && !this.paused;
    return Math.max(0, this.clocks[player] - (running ? (nowMs() - this.clockBase) / 1000 : 0));
  }

  private bakeClocks() {
    this.clocks = [this.remaining(0), this.remaining(1)];
    this.clockBase = nowMs();
  }

  private tick() {
    if (!this.inMatch) return;
    if (this.mode !== "online" && this.matchLive() && this.remaining(this.state.turn) <= 0) {
      this.bakeClocks();
      this.state.winner = (1 - this.state.turn) as Player;
      this.endReason = "time";
      this.phase = "gameover";
      this.cpuThinking = false;
      this.generation++;
      this.resultOpen = true;
      this.leaveConfirmOpen = false;
    }
    this.emit();
  }

  private relayTurnInProgress() {
    if (this.mode !== "online" || this.gameId === undefined || !this.canAct()) return;
    const signature = JSON.stringify([this.drawn, this.pendingL ?? null, this.selectedNeutral, this.destination ?? null]);
    if (signature === this.lastPreviewSent) return;
    this.lastPreviewSent = signature;
    const elapsed = nowMs() - this.lastPreviewAt;
    if (elapsed >= PREVIEW_INTERVAL_MS) return this.sendPreview();
    if (this.previewTimer) return;
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      this.sendPreview();
    }, PREVIEW_INTERVAL_MS - elapsed);
  }

  private sendPreview() {
    if (this.mode !== "online" || this.gameId === undefined || !this.canAct()) return;
    this.lastPreviewAt = nowMs();
    const preview: TurnPreview = {
      drawn: this.drawn,
      ...(this.pendingL ? { l: this.pendingL } : {}),
      neutral: this.selectedNeutral,
      ...(this.destination ? { destination: this.destination } : {}),
    };
    // Advisory only, and dropped silently if it fails: a lost preview frame costs nothing.
    void this.net.setPreview(this.gameId, preview).catch(() => undefined);
  }

  equip(piece: number, board: number) {
    this.pieceSkinIndex = PIECE_SKINS.indexOf(pieceSkin(piece));
    this.boardSkinIndex = BOARD_SKINS.indexOf(boardSkin(board));
    void storage.set(STORAGE.pieceSkin, String(this.pieceSkinIndex));
    void storage.set(STORAGE.boardSkin, String(this.boardSkinIndex));
    this.lockerMessage = "Colours are cosmetic. Side names change with the palette so turns stay readable.";
    this.emit();
  }

  setLockerCategory(category: LockerCategory) {
    this.lockerCategory = category;
    this.lockerMessage = category === "avatars"
      ? this.account ? "Your DiceBear selection is saved on the server and shown to opponents and friends." : "Connect to save a DiceBear avatar."
      : "Colours are cosmetic. Side names change with the palette so turns stay readable.";
    this.emit();
  }

  async selectAvatar(style: string) {
    const account = this.account;
    if (!account) return;
    this.lockerMessage = "Saving avatar…";
    this.emit();
    try {
      if (!(await this.requireNet())) throw new Error("The game server is unreachable.");
      // The seed is kept, so changing style keeps the same character rather than rerolling it.
      await this.net.setAvatar(style, account.avatarSeed);
      this.lockerMessage = "Saved. Friends and opponents can now see this avatar.";
    } catch (error) {
      this.lockerMessage = reason(error, "Could not save the avatar.");
    }
    this.syncFromNet();
  }

  openRules() { this.rulesOpen = true; this.rulesSlide = 0; this.emit(); }
  closeRules() { this.rulesOpen = false; this.emit(); }
  setRulesSlide(slide: number) { this.rulesSlide = Math.max(0, Math.min(4, slide)); this.emit(); }

  private sideName(player: Player) { return PIECE_SKINS[this.pieceSkinIndex].sides[player]; }

  private playerLabel(player: Player) {
    if (this.mode === "cpu") return player === 0 ? "You" : "CPU";
    if (this.mode === "online") {
      return this.competitors[player]?.username ?? (player === this.localPlayer ? this.account?.username ?? "You" : "Opponent");
    }
    return this.sideName(player);
  }

  private seatOrder(): [Player, Player] {
    const left: Player = this.mode === "local" ? 0 : this.localPlayer;
    return [left, (1 - left) as Player];
  }

  private seatView(player: Player): SeatView {
    const name = this.playerLabel(player);
    const role = this.sideName(player).toUpperCase();
    return {
      player,
      name,
      role: role === name.toUpperCase() ? "" : role,
      avatarUrl: this.mode === "online" ? this.competitors[player]?.avatarUrl : player === 0 ? this.account?.avatarUrl : undefined,
      seconds: Math.ceil(this.remaining(player)),
      active: this.state.winner < 0 && this.state.turn === player,
      connected: this.mode !== "online" || this.seatConnected[player],
    };
  }

  private statusText() {
    if (this.message && this.canAct()) return this.message;
    if (this.state.winner >= 0) return `${this.playerLabel(this.state.winner as Player)} wins.`;
    if (this.cpuThinking) return this.cpuPreview.length ? "CPU is drawing its move…" : "CPU is considering the board…";
    if (this.mode === "online" && !this.onlineReady) return this.message || "Waiting for a second player…";
    if (!this.canAct()) {
      const opponent = this.playerLabel(this.state.turn);
      if (this.remote?.destination) return `${opponent} has a disc ready…`;
      if (this.remote?.l) return `${opponent} is placing a disc…`;
      if (this.remote?.drawn.length) return `${opponent} is drawing an L…`;
      return `Waiting for ${opponent}.`;
    }
    const action = this.phase === "neutral" ? "drag a disc, or end your turn" : "drag through four highlighted squares";
    return this.mode === "local" ? `${this.sideName(this.state.turn)}: ${action}.` : `${action[0].toUpperCase()}${action.slice(1)}.`;
  }

  private boardFrame(): BoardFrame {
    const watching = this.mode === "online" && !this.canAct() && this.state.winner < 0 && Boolean(this.remote);
    const remote = watching ? this.remote : undefined;
    const pendingL = remote ? remote.l : this.pendingL;
    const drawn = remote ? remote.drawn : this.phase === "l" ? this.drawn : [];
    const selected = remote ? remote.neutral : this.selectedNeutral;
    const destination = remote ? remote.destination : this.destination;
    const preview = this.previewState(pendingL);
    const pieces: [Cell[], Cell[]] = [preview.pieces[0], preview.pieces[1]];
    if (this.cpuThinking && this.cpuPreview.length) pieces[1] = this.cpuPreview;
    else if (this.cpuThinking) pieces[1] = [];
    const mover = this.state.turn;
    const showGhost = Boolean(this.ghost) || Boolean(pendingL) || (this.phase === "l" && (this.canAct() || this.cpuThinking));
    // Until the new L is placed the piece is effectively in the player's hand, so the board marks
    // where it came from instead of drawing it as though it were still sitting there. Once it is
    // placed, only the squares it has actually vacated stay marked - a square the new L reuses is
    // part of the piece again, not a leftover.
    const lifted = !pendingL;
    const previous = this.ghost ?? this.state.pieces[mover];
    const ghostCells = lifted
      ? previous
      : previous.filter((cell) => !pieces[mover].some((held) => sameCell(held, cell)));
    return {
      pieces,
      neutrals: preview.neutrals,
      ghost: showGhost && ghostCells.length ? { cells: ghostCells, player: mover, lifted } : undefined,
      drawn,
      targets: this.targets(),
      selectedNeutral: selected,
      pendingDestination: destination,
      discsMovable: this.phase === "neutral" && this.canAct(),
      watching,
      pieceSkin: this.pieceSkinIndex,
      boardSkin: this.boardSkinIndex,
    };
  }

  private connectionView(): ConnectionView | undefined {
    if (this.mode !== "online" || this.connectionState === "idle") return undefined;
    const state = this.connectionState as Exclude<ConnectionState, "idle">;
    const titles = {
      queueing: this.ranked ? "Finding a ranked opponent" : "Finding a casual opponent",
      waiting: "Waiting for player",
      reconnecting: "Reconnecting",
      connected: "Match connected",
      disconnected: "Connection lost",
    };
    const labels = { queueing: "Queueing", waiting: "Waiting", reconnecting: "Reconnecting", connected: "Live", disconnected: "Offline" };
    const elapsed = Math.max(0, Math.floor((nowMs() - this.connectionSince) / 1000));
    return {
      state,
      title: titles[state],
      label: labels[state],
      detail: this.connectionDetail,
      time: state === "reconnecting" ? `${Math.max(0, Math.ceil((this.reconnectDeadline - nowMs()) / 1000))}s`
        : state === "connected" ? "Live" : state === "disconnected" ? "—"
          : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`,
    };
  }

  getView(): GameView {
    const [left, right] = this.seatOrder();
    const winner = this.state.winner >= 0 ? this.state.winner as Player : undefined;
    const loser = winner === undefined ? undefined : (1 - winner) as Player;
    const turns = Math.max(0, this.state.turnNumber - 1);
    const result = winner === undefined ? undefined : {
      title: `${this.playerLabel(winner)} wins`,
      detail: `${this.endReason === "time" ? `${this.playerLabel(loser!)} ran out of time.`
        : this.endReason === "forfeit" ? `${this.playerLabel(loser!)} left the match.`
          : `${this.playerLabel(loser!)} has no legal L move.`} Match finished in ${turns} turn${turns === 1 ? "" : "s"}.`,
      action: this.ranked ? "Find next match" : "Play again",
    };
    return {
      initialized: this.initialized,
      tab: this.tab,
      inMatch: this.inMatch,
      mode: this.mode,
      phase: this.phase,
      state: this.state,
      board: this.boardFrame(),
      seats: [this.seatView(left), this.seatView(right)],
      status: this.statusText(),
      message: this.notice,
      ranked: this.ranked,
      onlineReady: this.onlineReady,
      connection: this.connectionView(),
      cpuThinking: this.cpuThinking,
      canAct: this.canAct(),
      canSubmitL: this.canAct() && this.phase === "l" && this.drawn.length === 4,
      canClear: this.canAct() && this.phase === "l" && this.drawn.length > 0,
      canConfirmDisc: this.canAct() && this.phase === "neutral" && Boolean(this.destination),
      canEndTurn: this.canAct() && this.phase === "neutral",
      canUndoL: this.canAct() && this.phase === "neutral",
      discHeld: this.phase === "neutral" && this.selectedNeutral >= 0,
      resultOpen: this.resultOpen,
      leaveConfirmOpen: this.leaveConfirmOpen,
      result,
      account: this.account,
      authBusy: this.authBusy,
      authMessage: this.authMessage,
      namePanel: this.namePanel,
      deleteAccountArmed: this.deleteAccountArmed,
      ownRank: this.ownRank,
      rankCount: this.rankCount,
      onlineCount: this.onlineCount,
      connected: this.net.connected,
      connecting: this.connecting,
      leaderboardScope: this.leaderboardScope,
      leaderboard: this.leaderboard,
      leaderboardStatus: this.leaderboardStatus,
      friends: this.friends,
      friendsStatus: this.friendsStatus,
      lockerCategory: this.lockerCategory,
      pieceSkin: this.pieceSkinIndex,
      boardSkin: this.boardSkinIndex,
      lockerMessage: this.lockerMessage,
      rulesOpen: this.rulesOpen,
      rulesSlide: this.rulesSlide,
      serverUrl: this.serverUrl,
      competitors: this.competitors,
      remote: this.remote,
    };
  }
}
