/**
 * A standalone client for playing the L Game against the local SpacetimeDB module.
 *
 * This is a test harness, not the product: the Expo app under `src/` is the real client. What this
 * page is for is playing a genuine game against the real backend without waiting for that
 * migration - open it in two tabs and the two tabs will be matched against each other.
 *
 * The one thing worth knowing: the auth token lives in `sessionStorage`, which is per-tab. That is
 * what makes two tabs two different players, while a refresh still keeps you as the same one.
 *
 * Move legality shown here (highlights, the "confirm" button) is advisory. It is computed with the
 * client's own rules in `src/shared/rules.ts` purely so the board feels responsive; the server
 * re-validates every move and is the only thing that decides what is legal.
 */

import type { Identity } from 'spacetimedb';

import { DbConnection } from '../../src/module_bindings';
import { bitOf, legalContinuations, maskOf, placementForDraw } from '../../src/shared/rules';
import type { Cell, GameState, Player } from '../../src/shared/types';

const URI = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? `ws://${location.hostname}:3000`
  : `ws://${location.hostname}:3000`;
const DATABASE = 'l-game';
const TOKEN_KEY = 'l-game.stdb.token';

type GameRow = NonNullable<ReturnType<DbConnection['db']['game']['id']['find']>>;

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

let conn: DbConnection | undefined;
let me: Identity | undefined;

/** The game being shown. Kept after it finishes so the result stays on screen until dismissed. */
let shownGame: bigint | undefined;

/** The turn being composed locally, before it is sent. */
let drawn: Cell[] = [];
let disc: -1 | 0 | 1 = -1;
let destination: Cell | undefined;

let notice = '';
let busy = false;

const toCell = (index: number): Cell => [index % 4, Math.floor(index / 4)];
const toIndex = (cell: Cell): number => cell[1] * 4 + cell[0];
const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const has = (cells: readonly Cell[], cell: Cell) => cells.some((entry) => sameCell(entry, cell));

const $ = (id: string) => document.getElementById(id)!;

function clock(ms: bigint | number): string {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Reading the server's board
// ---------------------------------------------------------------------------------------------

function stateOf(row: GameRow): GameState {
  return {
    pieces: [Array.from(row.p0Cells).map(toCell), Array.from(row.p1Cells).map(toCell)],
    neutrals: [toCell(row.neutral0), toCell(row.neutral1)],
    turn: row.turn as Player,
    winner: row.winner as GameState['winner'],
    turnNumber: row.turnNumber,
  };
}

function currentGame(): GameRow | undefined {
  if (!conn || !me) return undefined;
  const active = conn.db.activeGame.identity.find(me);
  if (active) {
    shownGame = active.gameId;
    return conn.db.game.id.find(active.gameId) ?? undefined;
  }
  // The active_game row is deleted the moment a game ends, so fall back to the last one shown.
  return shownGame ? (conn.db.game.id.find(shownGame) ?? undefined) : undefined;
}

function mySeat(row: GameRow): Player | undefined {
  if (!me) return undefined;
  if (row.player0.equals(me)) return 0;
  if (row.player1.equals(me)) return 1;
  return undefined;
}

/** Where a disc may land once the drawn L is in place. Mirrors the server's rule exactly. */
function discTargets(state: GameState, placement: readonly Cell[], seat: Player): Cell[] {
  const blocked =
    maskOf(placement) |
    maskOf(state.pieces[1 - seat]) |
    bitOf(state.neutrals[0]) |
    bitOf(state.neutrals[1]);
  const targets: Cell[] = [];
  for (let index = 0; index < 16; index++) if (!(blocked & (1 << index))) targets.push(toCell(index));
  return targets;
}

function resetTurn(): void {
  drawn = [];
  disc = -1;
  destination = undefined;
}

// ---------------------------------------------------------------------------------------------
// Acting
// ---------------------------------------------------------------------------------------------

async function call(label: string, action: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  notice = '';
  render();
  try {
    await action();
  } catch (error) {
    notice = error instanceof Error ? error.message : `${label} failed`;
  } finally {
    busy = false;
    render();
  }
}

let previewSentAt = 0;
function sendPreview(row: GameRow, placement: readonly Cell[] | undefined): void {
  const now = Date.now();
  if (now - previewSentAt < 60) return;
  previewSentAt = now;
  void conn?.reducers
    .setPreview({
      gameId: row.id,
      drawn: Uint8Array.from(drawn.map(toIndex)),
      candidate: placement ? Uint8Array.from(placement.map(toIndex)) : new Uint8Array(),
      neutral: disc,
      destination: destination ? toIndex(destination) : -1,
    })
    .catch(() => undefined);
}

function onCellClick(row: GameRow, seat: Player, cell: Cell): void {
  const state = stateOf(row);
  if (row.winner >= 0 || state.turn !== seat) return;

  // Phase 2: the L is drawn, so clicks are about the discs.
  if (drawn.length === 4) {
    const placement = placementForDraw(state, seat, drawn);
    if (!placement) return;

    const discIndex = state.neutrals.findIndex((neutral) => sameCell(neutral, cell));
    if (discIndex >= 0) {
      // Clicking the selected disc again deselects it.
      disc = disc === discIndex ? -1 : (discIndex as 0 | 1);
      destination = undefined;
      render();
      return;
    }
    if (disc >= 0 && has(discTargets(state, placement, seat), cell)) {
      destination = cell;
      render();
    }
    return;
  }

  // Phase 1: trace the L one square at a time.
  if (drawn.length > 0 && sameCell(drawn[drawn.length - 1]!, cell)) {
    drawn.pop(); // Clicking the last square again steps back.
    render();
    sendPreview(row, undefined);
    return;
  }
  if (!has(legalContinuations(state, seat, drawn), cell)) return;

  drawn.push(cell);
  const placement = drawn.length === 4 ? placementForDraw(state, seat, drawn) : undefined;
  render();
  sendPreview(row, placement);
}

function submit(row: GameRow): void {
  void call('move', async () => {
    await conn!.reducers.playMove({
      gameId: row.id,
      cells: Uint8Array.from(drawn.map(toIndex)),
      neutral: disc,
      destination: destination ? toIndex(destination) : -1,
    });
    resetTurn();
  });
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

function renderBoard(row: GameRow | undefined, seat: Player | undefined): string {
  if (!row || seat === undefined) {
    return '<div class="board idle">' + '<div class="sq"></div>'.repeat(16) + '</div>';
  }

  const state = stateOf(row);
  const mine = state.turn === seat && row.winner < 0;
  const placement = drawn.length === 4 ? placementForDraw(state, seat, drawn) : undefined;
  const continuations = mine && drawn.length < 4 ? legalContinuations(state, seat, drawn) : [];
  const targets = mine && placement && disc >= 0 ? discTargets(state, placement, seat) : [];

  // What the opponent is drawing right now, relayed by the server.
  const preview = conn?.db.preview.gameId.find(row.id);
  const opponentDraw =
    preview && preview.seat !== seat ? Array.from(preview.drawn).map(toCell) : [];

  const squares: string[] = [];
  for (let index = 0; index < 16; index++) {
    const cell = toCell(index);
    const classes = ['sq'];

    if (has(state.pieces[0], cell)) classes.push(seat === 0 ? 'own' : 'foe');
    if (has(state.pieces[1], cell)) classes.push(seat === 1 ? 'own' : 'foe');
    if (state.neutrals.some((neutral) => sameCell(neutral, cell))) classes.push('disc');

    if (has(drawn, cell)) classes.push('drawn');
    if (has(continuations, cell)) classes.push('hint');
    if (has(targets, cell)) classes.push('target');
    if (destination && sameCell(destination, cell)) classes.push('dest');
    if (disc !== -1 && sameCell(state.neutrals[disc], cell)) classes.push('picked');
    if (has(opponentDraw, cell)) classes.push('remote');

    const order = has(drawn, cell) ? String(drawn.findIndex((entry) => sameCell(entry, cell)) + 1) : '';
    squares.push(`<div class="${classes.join(' ')}" data-cell="${index}">${order}</div>`);
  }
  return `<div class="board${mine ? ' live' : ''}">${squares.join('')}</div>`;
}

function renderControls(row: GameRow | undefined, seat: Player | undefined): string {
  if (!row || seat === undefined) return '';
  if (row.winner >= 0) {
    const won = row.winner === seat;
    const reason =
      row.endReason === 'moves' ? 'no legal moves left'
      : row.endReason === 'time' ? 'on time'
      : 'by forfeit';
    return `
      <div class="result ${won ? 'won' : 'lost'}">
        <strong>${won ? 'You win' : 'You lose'}</strong>
        <span>${reason}</span>
      </div>
      <div class="row">
        <button data-act="again" class="primary">Play again</button>
      </div>`;
  }

  const state = stateOf(row);
  if (state.turn !== seat) {
    return `<p class="hint-text">Waiting for ${seat === 0 ? row.name1 : row.name0}…</p>
      <div class="row"><button data-act="resign" class="danger">Resign</button></div>`;
  }

  const placement = drawn.length === 4 ? placementForDraw(state, seat, drawn) : undefined;
  const step =
    drawn.length < 4
      ? `Trace your L — ${4 - drawn.length} square${drawn.length === 3 ? '' : 's'} to go.`
      : placement
        ? disc < 0
          ? 'L placed. Move a neutral disc, or confirm as is.'
          : destination
            ? 'Disc placed. Confirm your move.'
            : 'Pick where that disc goes, or click it again to leave it.'
        : 'That draw is not a legal L — clear and try again.';

  return `
    <p class="hint-text">${step}</p>
    <div class="row">
      <button data-act="confirm" class="primary" ${placement ? '' : 'disabled'}>Confirm move</button>
      <button data-act="clear" ${drawn.length ? '' : 'disabled'}>Clear</button>
      <button data-act="resign" class="danger">Resign</button>
    </div>`;
}

function render(): void {
  const connected = !!conn && !!me;
  const row = currentGame();
  const seat = row ? mySeat(row) : undefined;
  const profile = me && conn ? conn.db.player.identity.find(me) : undefined;
  const queued = me && conn ? conn.db.queueEntry.identity.find(me) : undefined;

  $('status').textContent = connected ? `connected · ${DATABASE}` : 'connecting…';
  $('status').className = connected ? 'ok' : 'warn';

  // Seats
  if (row && seat !== undefined) {
    const names = [row.name0, row.name1];
    const clocks = [row.clock0Ms, row.clock1Ms];
    const live = row.winner < 0;
    $('seats').innerHTML = ([0, 1] as const)
      .map(
        (index) => `
        <div class="seat${index === seat ? ' you' : ''}${live && row.turn === index ? ' active' : ''}">
          <span class="who">${index === seat ? 'You' : 'Opponent'}</span>
          <span class="name">${names[index]}</span>
          <span class="time">${clock(clocks[index]!)}</span>
        </div>`,
      )
      .join('');
    $('meta').textContent = `${row.mode} · turn ${row.turnNumber}`;
  } else {
    $('seats').innerHTML = '';
    $('meta').textContent = profile ? `${profile.username} · ${Math.round(profile.rating)}` : '';
  }

  $('board').innerHTML = renderBoard(row, seat);
  $('controls').innerHTML = renderControls(row, seat);

  // Lobby is shown whenever there is no live game.
  const inGame = !!row && row.winner < 0;
  $('lobby').style.display = inGame || (row && row.winner >= 0) ? 'none' : 'block';
  if (!inGame) {
    $('queue').innerHTML = queued
      ? `<p class="hint-text">Searching for a ${queued.mode} game…</p>
         <div class="row"><button data-act="cancel">Cancel search</button></div>`
      : `<div class="row">
           <button data-act="casual" class="primary" ${connected ? '' : 'disabled'}>Play casual</button>
           <button data-act="ranked" ${connected && profile && !profile.guest ? '' : 'disabled'}>Play ranked</button>
         </div>
         ${profile?.guest ? '<p class="hint-text">Set a username to unlock ranked.</p>' : ''}`;

    const board = conn ? [...conn.db.player.iter()].filter((p) => p.games > 0) : [];
    board.sort((a, b) => b.rating - a.rating);
    $('leaders').innerHTML = board.length
      ? `<h2>Leaderboard</h2>` +
        board
          .slice(0, 8)
          .map(
            (p, i) =>
              `<div class="lead"><span>${i + 1}</span><span>${p.username}</span><span>${Math.round(p.rating)}</span><span>${p.wins}W ${p.losses}L</span></div>`,
          )
          .join('')
      : '';
  }

  ($('name') as HTMLInputElement).placeholder = profile?.username ?? 'your name';
  $('notice').textContent = notice;
  $('notice').style.display = notice ? 'block' : 'none';
}

// ---------------------------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------------------------

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const row = currentGame();
  const seat = row ? mySeat(row) : undefined;

  const cell = target.dataset.cell;
  if (cell !== undefined && row && seat !== undefined) {
    onCellClick(row, seat, toCell(Number(cell)));
    return;
  }

  switch (target.dataset.act) {
    case 'casual':
      void call('queue', () => conn!.reducers.enqueue({ mode: 'casual' }));
      break;
    case 'ranked':
      void call('queue', () => conn!.reducers.enqueue({ mode: 'ranked' }));
      break;
    case 'cancel':
      void call('cancel', () => conn!.reducers.dequeue({}));
      break;
    case 'confirm':
      if (row) submit(row);
      break;
    case 'clear':
      resetTurn();
      if (row) sendPreview(row, undefined);
      render();
      break;
    case 'resign':
      if (row) void call('resign', () => conn!.reducers.forfeit({ gameId: row.id }));
      break;
    case 'again':
      shownGame = undefined;
      resetTurn();
      render();
      break;
    case 'rename': {
      const input = $('name') as HTMLInputElement;
      const username = input.value.trim();
      if (!username) return;
      void call('rename', async () => {
        await conn!.reducers.setProfile({ username, avatarStyle: '', avatarSeed: '' });
        input.value = '';
      });
      break;
    }
  }
}

function start(): void {
  document.body.addEventListener('click', onClick);
  render();

  DbConnection.builder()
    .withUri(URI)
    .withDatabaseName(DATABASE)
    .withToken(sessionStorage.getItem(TOKEN_KEY) ?? undefined)
    .onConnect((connection, identity, token) => {
      // Per-tab, so two tabs are two players but a refresh keeps you as the same one.
      sessionStorage.setItem(TOKEN_KEY, token);
      conn = connection;
      me = identity;

      connection
        .subscriptionBuilder()
        .onApplied(() => render())
        .onError((ctx) => {
          notice = ctx.event?.message ?? 'subscription failed';
          render();
        })
        .subscribe([
          'SELECT * FROM player',
          'SELECT * FROM game',
          'SELECT * FROM active_game',
          'SELECT * FROM queue_entry',
          'SELECT * FROM preview',
        ]);

      // Any replicated change re-renders; the board is small enough that this is free.
      for (const table of [
        connection.db.game,
        connection.db.activeGame,
        connection.db.player,
        connection.db.queueEntry,
        connection.db.preview,
      ] as { onInsert: Function; onUpdate: Function; onDelete: Function }[]) {
        table.onInsert(() => render());
        table.onUpdate(() => render());
        table.onDelete(() => render());
      }

      // A new game means whatever was half-drawn belongs to the previous one.
      connection.db.activeGame.onInsert(() => {
        resetTurn();
        render();
      });
    })
    .onConnectError((_ctx, error) => {
      notice = `Could not reach SpacetimeDB at ${URI} — is \`npm run stdb:start\` running? (${error.message})`;
      render();
    })
    .onDisconnect(() => {
      notice = 'Disconnected from SpacetimeDB.';
      conn = undefined;
      render();
    })
    .build();

  // The server charges clocks once a second; re-render on the same cadence so they visibly run.
  setInterval(() => render(), 1000);
}

start();
