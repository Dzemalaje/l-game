/**
 * End-to-end smoke test against a running local SpacetimeDB.
 *
 * Two real clients connect over websockets, subscribe, queue up, get matched by the server's own
 * matchmaker, and play a complete game to a legitimate finish. Nothing is stubbed: every assertion
 * below is about state the module actually wrote.
 *
 *   spacetime start                       # in another terminal
 *   spacetime publish l-game --server local
 *   npx tsx spacetimedb/test/e2e.ts
 */

import assert from 'node:assert/strict';

import { DbConnection } from '../../src/module_bindings';
import {
  L_PLACEMENTS,
  applyMove,
  maskOf,
  opponentOf,
  type Board,
  type NeutralChoice,
  type Seat,
} from '../spacetimedb/src/rules';

const URI = process.env.STDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.STDB_DB ?? 'l-game';

const SUBSCRIPTIONS = [
  'SELECT * FROM player',
  'SELECT * FROM game',
  'SELECT * FROM active_game',
  'SELECT * FROM queue_entry',
  'SELECT * FROM match',
  'SELECT * FROM preview',
  // The app scopes this to `owner = :sender`; the test wants both sides of each relationship.
  'SELECT * FROM friend_edge',
];

type Client = Awaited<ReturnType<typeof connect>>;
type GameRow = ReturnType<Client['conn']['db']['game']['iter']> extends Iterable<infer R> ? R : never;

let passed = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

function connect(label: string) {
  return new Promise<{ conn: DbConnection; identity: import('spacetimedb').Identity; label: string }>(
    (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label}: connection timed out`)), 15_000);
      DbConnection.builder()
        .withUri(URI)
        .withDatabaseName(DATABASE)
        .onConnect((conn, identity) => {
          clearTimeout(timer);
          resolve({ conn, identity, label });
        })
        .onConnectError((_ctx, error) => {
          clearTimeout(timer);
          reject(error);
        })
        .build();
    },
  );
}

function subscribe(client: Client): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${client.label}: subscription timed out`)), 15_000);
    client.conn
      .subscriptionBuilder()
      .onApplied(() => {
        clearTimeout(timer);
        resolve();
      })
      .onError((ctx) => {
        clearTimeout(timer);
        reject(ctx.event ?? new Error(`${client.label}: subscription failed`));
      })
      .subscribe(SUBSCRIPTIONS);
  });
}

/**
 * Polls the client cache until `read` returns something, so tests wait on replicated state.
 * Table lookups return `null` when absent, so both empty values have to count as "not yet".
 */
async function waitFor<T>(label: string, read: () => T | undefined | null, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined && value !== null) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Asserts that a reducer call is rejected, and returns the message the server sent back. */
async function expectRejected(label: string, call: Promise<void>): Promise<string> {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`FAIL: ${label} was accepted but should have been rejected`);
}

// ---------------------------------------------------------------------------------------------
// Board helpers, driven by the same rules module the server uses
// ---------------------------------------------------------------------------------------------

function boardOf(row: GameRow): Board {
  return {
    pieces: [Array.from(row.p0Cells), Array.from(row.p1Cells)],
    neutrals: [row.neutral0, row.neutral1],
    turn: row.turn as Seat,
    winner: row.winner as Board['winner'],
    turnNumber: row.turnNumber,
  };
}

function countLegal(board: Board, seat: Seat): number {
  const own = maskOf(board.pieces[seat]);
  const blocked =
    maskOf(board.pieces[opponentOf(seat)]) | (1 << board.neutrals[0]) | (1 << board.neutrals[1]);
  let total = 0;
  for (const placement of L_PLACEMENTS) {
    if (placement.mask !== own && (placement.mask & blocked) === 0) total += 1;
  }
  return total;
}

/**
 * One-ply greedy: of every legal turn, take the one that leaves the opponent fewest replies.
 * Two of these playing each other reach a real win reasonably quickly, which is what makes an
 * end-to-end test of the "no legal moves left" ending possible at all.
 */
function bestMove(board: Board, seat: Seat) {
  let best: { cells: number[]; neutral: NeutralChoice; destination: number; replies: number } | undefined;

  for (const placement of L_PLACEMENTS) {
    const options: Array<{ neutral: NeutralChoice; destination: number }> = [
      { neutral: -1, destination: -1 },
    ];
    for (const disc of [0, 1] as const) {
      for (let destination = 0; destination < 16; destination++) {
        options.push({ neutral: disc, destination });
      }
    }

    for (const option of options) {
      const next = applyMove(board, {
        cells: placement.cells,
        neutral: option.neutral,
        destination: option.destination,
      });
      if (!next) continue;

      const replies = next.winner >= 0 ? -1 : countLegal(next, next.turn);
      if (!best || replies < best.replies) {
        best = { cells: placement.cells, ...option, replies };
      }
      if (replies === -1) return best;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`connecting to ${URI} / ${DATABASE}`);

  const alice = await connect('alice');
  const bob = await connect('bob');
  await Promise.all([subscribe(alice), subscribe(bob)]);
  console.log(`  alice ${alice.identity.toHexString().slice(0, 16)}...`);
  console.log(`  bob   ${bob.identity.toHexString().slice(0, 16)}...\n`);

  console.log('profiles');
  const aliceRow = await waitFor('alice profile', () => alice.conn.db.player.identity.find(alice.identity));
  check('a connecting identity gets a guest profile', aliceRow.guest && aliceRow.username.startsWith('Guest-'));
  check('a new player starts at 1500', Math.round(aliceRow.rating) === 1500);

  const rankedRefusal = await expectRejected(
    'ranked as a guest',
    alice.conn.reducers.enqueue({ mode: 'ranked' }),
  );
  check('guests cannot queue for ranked', /username/i.test(rankedRefusal), rankedRefusal);

  const unknownMode = await expectRejected('bogus mode', alice.conn.reducers.enqueue({ mode: 'blitz' }));
  check('an unknown mode is refused', /unknown mode/i.test(unknownMode), unknownMode);

  const stamp = Date.now().toString(36).slice(-5);
  await alice.conn.reducers.setProfile({
    username: `Alice-${stamp}`,
    avatarStyle: 'lorelei',
    avatarSeed: 'alice-seed',
  });
  await bob.conn.reducers.setProfile({
    username: `Bob-${stamp}`,
    avatarStyle: 'lorelei',
    avatarSeed: 'bob-seed',
  });
  await waitFor('alice named', () => {
    const row = alice.conn.db.player.identity.find(alice.identity);
    return row && !row.guest ? row : undefined;
  });
  check('choosing a name clears guest status', true);

  const taken = await expectRejected(
    'duplicate name',
    bob.conn.reducers.setProfile({
      username: `Alice-${stamp}`,
      avatarStyle: 'lorelei',
      avatarSeed: 'x',
    }),
  );
  check('usernames are unique', /taken/i.test(taken), taken);

  const badName = await expectRejected(
    'short name',
    bob.conn.reducers.setProfile({ username: 'ab', avatarStyle: '', avatarSeed: '' }),
  );
  check('short names are refused', /characters/i.test(badName), badName);

  console.log('\nmatchmaking');
  await alice.conn.reducers.enqueue({ mode: 'ranked' });
  await waitFor('alice queued', () => alice.conn.db.queueEntry.identity.find(alice.identity));
  check('queueing creates a queue entry', true);

  await bob.conn.reducers.enqueue({ mode: 'ranked' });

  const active = await waitFor('a game to start', () =>
    alice.conn.db.activeGame.identity.find(alice.identity),
  );
  const gameId = active.gameId;
  check('two queued players are paired', true);
  check(
    'the queue is emptied by the pairing',
    !alice.conn.db.queueEntry.identity.find(alice.identity) &&
      !bob.conn.db.queueEntry.identity.find(bob.identity),
  );

  const started = await waitFor('game row', () => bob.conn.db.game.id.find(gameId));
  check('both players are seated', !!started && started.mode === 'ranked');
  check('the clocks start at 5 minutes', started.clock0Ms === 300_000n && started.clock1Ms === 300_000n);
  check('seat 0 moves first', started.turn === 0 && started.turnNumber === 1);

  const busy = await expectRejected('queue while playing', alice.conn.reducers.enqueue({ mode: 'casual' }));
  check('a player in a game cannot queue again', /current match/i.test(busy), busy);

  const seatOf = (client: Client): Seat => (started.player0.equals(client.identity) ? 0 : 1);
  const bySeat: [Client, Client] = seatOf(alice) === 0 ? [alice, bob] : [bob, alice];

  console.log('\nillegal moves');
  const notYourTurn = await expectRejected(
    'move out of turn',
    bySeat[1].conn.reducers.playMove({
      gameId,
      cells: Uint8Array.from([2, 3, 6, 7]),
      neutral: -1,
      destination: -1,
    }),
  );
  check('the player not on move is refused', /not your turn/i.test(notYourTurn), notYourTurn);

  const notAnL = await expectRejected(
    'a non-L shape',
    bySeat[0].conn.reducers.playMove({
      gameId,
      cells: Uint8Array.from([0, 1, 2, 3]),
      neutral: -1,
      destination: -1,
    }),
  );
  check('a straight line is not an L', /not legal/i.test(notAnL), notAnL);

  const onTopOfOpponent = await expectRejected(
    'overlapping the opponent',
    bySeat[0].conn.reducers.playMove({
      gameId,
      cells: Uint8Array.from(started.p1Cells),
      neutral: -1,
      destination: -1,
    }),
  );
  check('a placement may not overlap the opponent', /not legal/i.test(onTopOfOpponent), onTopOfOpponent);

  console.log('\npreview relay');
  await bySeat[0].conn.reducers.setPreview({
    gameId,
    drawn: Uint8Array.from([0, 1]),
    candidate: Uint8Array.from([0, 1, 2, 3]),
    neutral: -1,
    destination: -1,
  });
  const relayed = await waitFor('preview to reach the opponent', () =>
    bySeat[1].conn.db.preview.gameId.find(gameId),
  );
  check('the opponent sees what is being drawn', Array.from(relayed.drawn).join(',') === '0,1');
  check('an illegal candidate L is not relayed', relayed.candidate.length === 0);

  console.log('\nplaying a full game');
  let turns = 0;
  let finished = started;
  for (; turns < 200; turns++) {
    const row = bySeat[0].conn.db.game.id.find(gameId);
    if (!row) throw new Error('the game vanished mid-play');
    if (row.winner >= 0) {
      finished = row;
      break;
    }

    const seat = row.turn as Seat;
    const board = boardOf(row);
    const move = bestMove(board, seat);
    if (!move) throw new Error(`seat ${seat} had no legal move but the game was still live`);

    await bySeat[seat].conn.reducers.playMove({
      gameId,
      cells: Uint8Array.from(move.cells),
      neutral: move.neutral,
      destination: move.destination,
    });

    // Wait for the write to replicate before reading the next position.
    const before = row.turnNumber;
    await waitFor(`turn ${before} to land`, () => {
      const next = bySeat[0].conn.db.game.id.find(gameId);
      return next && (next.turnNumber > before || next.winner >= 0) ? next : undefined;
    });
  }

  const result = await waitFor('a winner', () => {
    const row = bySeat[0].conn.db.game.id.find(gameId);
    return row && row.winner >= 0 ? row : undefined;
  });
  finished = result;

  check('the game reached a real finish', finished.winner === 0 || finished.winner === 1, `after ${turns} turns`);
  check('it ended because a player ran out of moves', finished.endReason === 'moves', finished.endReason);
  check('the loser genuinely has no legal move', countLegal(boardOf(finished), opponentOf(finished.winner as Seat)) === 0);
  check('a finish time is recorded', finished.finishedAt != null);

  console.log('\nresults');
  const record = await waitFor('the match record', () =>
    [...alice.conn.db.match.iter()].find((row) => row.gameId === gameId),
  );
  check('the match is written to history', record.reason === 'moves' && record.mode === 'ranked');
  check('the winner is the player who won', !!record.winner?.equals(bySeat[finished.winner as Seat].identity));
  check('the move count is recorded', record.moves === finished.turnNumber - 1);

  check('ranked play moves the winner up', record.winnerRatingAfter > record.winnerRatingBefore,
    `${record.winnerRatingBefore} -> ${record.winnerRatingAfter}`);
  check('ranked play moves the loser down', record.loserRatingAfter < record.loserRatingBefore,
    `${record.loserRatingBefore} -> ${record.loserRatingAfter}`);

  const winnerRow = await waitFor('the winner profile', () => {
    const row = alice.conn.db.player.identity.find(bySeat[finished.winner as Seat].identity);
    return row && row.games > 0 ? row : undefined;
  });
  check('the win is counted on the profile', winnerRow.wins === 1 && winnerRow.games === 1);
  check('the stored rating matches the match record', Math.round(winnerRow.rating) === record.winnerRatingAfter);

  // Awaited, not read straight away: the delete has to replicate to both clients first.
  await waitFor('both seats to be released', () =>
    !alice.conn.db.activeGame.identity.find(alice.identity) &&
    !bob.conn.db.activeGame.identity.find(bob.identity)
      ? true
      : undefined,
  );
  check('both players are released from the game', true);
  check('the preview is cleaned up', bySeat[0].conn.db.preview.gameId.find(gameId) == null);

  console.log('\nrematch');
  await alice.conn.reducers.enqueue({ mode: 'casual' });
  await bob.conn.reducers.enqueue({ mode: 'casual' });
  const second = await waitFor('a second game', () => {
    const row = alice.conn.db.activeGame.identity.find(alice.identity);
    return row && row.gameId !== gameId ? row : undefined;
  });
  check('players can queue again after a result', true);

  const casual = await waitFor('the casual game', () => alice.conn.db.game.id.find(second.gameId));
  check('the second game is casual', casual.mode === 'casual');

  console.log('\nforfeit');
  await alice.conn.reducers.forfeit({ gameId: second.gameId });
  const resigned = await waitFor('the forfeit to land', () => {
    const row = bob.conn.db.game.id.find(second.gameId);
    return row && row.winner >= 0 ? row : undefined;
  });
  const aliceSeat: Seat = resigned.player0.equals(alice.identity) ? 0 : 1;
  check('resigning hands the win to the opponent', resigned.winner === opponentOf(aliceSeat));
  check('the reason is recorded as a forfeit', resigned.endReason === 'forfeit');

  const casualRecord = await waitFor('the casual match record', () =>
    [...bob.conn.db.match.iter()].find((row) => row.gameId === second.gameId),
  );
  check('casual games are unrated', casualRecord.winnerRatingAfter === 0 && casualRecord.loserRatingAfter === 0);

  const bobAfter = bob.conn.db.player.identity.find(bob.identity)!;
  check('a casual result does not change ratings', bobAfter.games === 1, `games=${bobAfter.games}`);

  console.log('\nclocks');
  await alice.conn.reducers.enqueue({ mode: 'casual' });
  await bob.conn.reducers.enqueue({ mode: 'casual' });
  const third = await waitFor('a third game', () => {
    const row = alice.conn.db.activeGame.identity.find(alice.identity);
    return row && row.gameId !== second.gameId ? row : undefined;
  });
  const ticked = await waitFor(
    'the clock to tick down',
    () => {
      const row = alice.conn.db.game.id.find(third.gameId);
      return row && row.clock0Ms < 300_000n ? row : undefined;
    },
    10_000,
  );
  check('the mover’s clock runs', ticked.clock0Ms < 300_000n, `${ticked.clock0Ms}ms left`);
  check('the waiting player’s clock does not', ticked.clock1Ms === 300_000n);

  await alice.conn.reducers.forfeit({ gameId: third.gameId });
  await waitFor('cleanup', () => {
    const row = alice.conn.db.game.id.find(third.gameId);
    return row && row.winner >= 0 ? row : undefined;
  });

  console.log('\nfriends');
  const mineOf = (client: Client, other: Client) =>
    [...client.conn.db.friendEdge.iter()].find(
      (edge) => edge.owner.equals(client.identity) && edge.other.equals(other.identity),
    );

  const noSuchPlayer = await expectRejected(
    'befriending a stranger',
    alice.conn.reducers.sendFriendRequest({ username: 'nobody-at-all' }),
  );
  check('an unknown username is refused', /no player/i.test(noSuchPlayer), noSuchPlayer);

  const self = await expectRejected(
    'befriending yourself',
    alice.conn.reducers.sendFriendRequest({ username: `Alice-${stamp}` }),
  );
  check('you cannot add yourself', /yourself/i.test(self), self);

  await alice.conn.reducers.sendFriendRequest({ username: `Bob-${stamp}` });
  await waitFor('the request to arrive', () => mineOf(bob, alice));
  check('a request is sent and received', mineOf(alice, bob)?.state === 1 && mineOf(bob, alice)?.state === 2);

  const twice = await expectRejected(
    'a duplicate request',
    alice.conn.reducers.sendFriendRequest({ username: `Bob-${stamp}` }),
  );
  check('the same request cannot be sent twice', /already sent/i.test(twice), twice);

  await bob.conn.reducers.acceptFriend({ other: alice.identity });
  await waitFor('the friendship', () => (mineOf(alice, bob)?.state === 0 ? true : undefined));
  check('accepting makes both sides mutual', mineOf(alice, bob)?.state === 0 && mineOf(bob, alice)?.state === 0);

  await bob.conn.reducers.blockFriend({ other: alice.identity });
  await waitFor('the block', () => (mineOf(bob, alice)?.state === 3 ? true : undefined));
  check('blocking keeps only the blocker’s edge', mineOf(bob, alice)?.state === 3);
  await waitFor('the blocked side to be dropped', () => (mineOf(alice, bob) === undefined ? true : undefined));
  check('the blocked player just sees the friendship end', mineOf(alice, bob) === undefined);

  await alice.conn.reducers.sendFriendRequest({ username: `Bob-${stamp}` });
  await new Promise((resolve) => setTimeout(resolve, 300));
  check('a blocked player cannot re-request', mineOf(alice, bob) === undefined);

  await bob.conn.reducers.removeFriend({ other: alice.identity });
  await waitFor('the unblock', () => (mineOf(bob, alice) === undefined ? true : undefined));
  check('unblocking clears the edge', mineOf(bob, alice) === undefined);

  console.log('\naccount deletion');
  await bob.conn.reducers.deleteAccount({});
  await waitFor('the account to go', () =>
    bob.conn.db.player.identity.find(bob.identity) === null ? true : undefined,
  );
  check('the player row is removed', bob.conn.db.player.identity.find(bob.identity) === null);

  // Only this run's matches: earlier runs leave their own Bob-* rows behind, and those belong to
  // different identities. The strip replicates separately from the player row, so it is awaited.
  const bobName = `Bob-${stamp}`;
  const mine = () =>
    [...alice.conn.db.match.iter()].filter(
      (row) => row.winnerName === bobName || row.loserName === bobName,
    );
  check('past matches survive the deletion', mine().length > 0, `${mine().length} matches`);
  await waitFor('the identity to be stripped', () =>
    mine().every((row) => !row.winner?.equals(bob.identity) && !row.loser?.equals(bob.identity))
      ? true
      : undefined,
  );
  check('the deleted identity is stripped from them', true);
  check('the opponent keeps a readable record', mine().every((row) => row.winnerName && row.loserName));

  console.log(`\n${passed} checks passed`);
  alice.conn.disconnect();
  bob.conn.disconnect();
}

main()
  .then(() => {
    assert.ok(passed > 0);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
