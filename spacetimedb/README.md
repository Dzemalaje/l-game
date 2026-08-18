# L Game — SpacetimeDB backend

The authoritative server for online play, written as a SpacetimeDB TypeScript module. There is no
separate game server process: the module *is* the database, and clients talk to it directly over a
websocket.

```
spacetimedb/
  spacetime.json         server + module path for the CLI (currently: local)
  spacetime.local.json   the database name (l-game)
  spacetimedb/src/
    index.ts             schema binding, lifecycle hooks, reducers   <- module entry point
    tables.ts            table definitions
    rules.ts             pure L Game rules (no I/O, no clock)
    rating.ts            pure Glicko-2 (no I/O, no clock)
  test/
    rules.test.ts        cross-checks rules.ts against src/shared/rules.ts
    e2e.ts               two real clients play a full game against a running server
  play/
    index.html, main.ts  a standalone page for actually playing against the module
    serve.mjs            bundles it with esbuild and serves it
    smoke.mjs            drives that page through a match in headless Chrome
```

## Running it locally

Two terminals, both from `web/`:

```bash
npm run stdb:start      # terminal 1 — SpacetimeDB on 127.0.0.1:3000, leave running
npm run stdb:play       # terminal 2 — the play page on http://127.0.0.1:4000
```

Open <http://127.0.0.1:4000> in **two tabs** and they will be matched against each other. The auth
token is kept in `sessionStorage`, which is per-tab, so each tab is its own player while a refresh
keeps you as the same one.

After changing the module:

```bash
npm run stdb:publish    # build + publish as "l-game"
npm run stdb:generate   # regenerate src/module_bindings
```

`npm run stdb:reset` republishes and wipes all data — use it after a breaking schema change.

## Tests

```bash
npm run test:stdb       # rules cross-check, no server needed
npm run test:stdb:e2e   # two SDK clients play a full game (needs the server)
npm run test:stdb:play  # headless Chrome plays through the play page (needs the server)
```

`npm run stdb:logs` follows the module's log output, `npm run stdb:sql` opens a SQL REPL.

> SpacetimeDB has no web UI. `http://127.0.0.1:3000` in a browser returns 404 — that is correct, it
> is an HTTP/WebSocket API. `GET /v1/ping` is the health check; use `stdb:sql` to look at data.

> The client bindings in `src/module_bindings/` are generated. Do not edit them by hand; rerun
> `npm run stdb:generate` after any change to a table or reducer.

> The play page is a test harness for the backend. The Expo app under `src/` is the real client and
> now talks to this module too, through `src/game/net.ts`.

## The security model

Clients never write a table. They call reducers, and they read by subscribing to the public tables.
Every reducer re-derives what the caller may do from `ctx.sender` and the *stored* board, never from
what the client sent — so a modified client can call anything with any arguments and still cannot
place a piece illegally, move out of turn, play in someone else's game, or set its own rating.

Concretely, the things a client might otherwise lie about:

| Claim | Where it is actually decided |
|---|---|
| "this move is legal" | `rules.ts` re-validates against the stored board |
| "it's my turn" | `game.turn` compared to the caller's seat |
| "my rating is X" | read from the caller's `player` row when queueing |
| "I've been waiting a while" | `queue_entry.queued_at`, written by the server |
| "my opponent is thinking about this L" | relayed only if it is a legal placement |
| "my clock still has time" | charged from `charged_at` on the server's own timestamp |

## Tables

Everything except `connection` is public — i.e. readable by subscription.

| Table | What it holds |
|---|---|
| `player` | profile, online flag, and the full Glicko-2 triple |
| `connection` | one row per open socket; `online` means "has at least one" |
| `queue_entry` | who is searching, for what, since when |
| `game` | the live board, clocks, seats and result |
| `active_game` | identity → its one live game, so the lookup is a primary-key hit |
| `preview` | the "opponent is thinking" relay for the player on move |
| `match` | finished games, for history and profiles |
| `friend_edge` | friendship as directed edges, one row per person |
| `leaderboard` (view) | top 100 rated players, derived from `player` |

The board is stored as flat cell indices (`index = y * 4 + x`, `0..15`). The client uses `[x, y]`
pairs; `test/rules.test.ts` plays random games through both representations at once and fails if
they ever disagree.

## Reducers

| Reducer | Notes |
|---|---|
| `setProfile(username, avatarStyle, avatarSeed)` | claims a unique name; also clears guest status |
| `enqueue(mode)` | `casual` or `ranked`; refuses guests, and anyone already in a game |
| `dequeue()` | leaves the queue |
| `playMove(gameId, cells, neutral, destination)` | one complete turn |
| `setPreview(...)` / `clearPreview(gameId)` | live relay to the opponent |
| `forfeit(gameId)` | resign |
| `setAvatar(style, seed)` | avatar only, skipping the username uniqueness check |
| `sendFriendRequest(username)` | accepts immediately if they already asked you |
| `acceptFriend` / `removeFriend` / `blockFriend` | manage one relationship |
| `deleteAccount()` | forfeits any live game, then erases the account |

`cells` is a `Uint8Array` of four cell indices. `neutral` is `-1` (leave the discs) or the disc
index `0`/`1`, in which case `destination` is where it goes.

Two scheduled reducers run once a second: `queueTick` pairs waiting players, and `gameTick` charges
clocks and resolves flag-falls and reconnect deadlines.

## Behaviour worth knowing

- **Clocks.** 5 minutes each. Time is billed from `charged_at` to whoever is on move, by whichever
  code touches the game first — the tick or the move — so the same second is never charged twice.
  The clock is paused while either player is disconnected.
- **Disconnects.** A dropped player has 20 seconds to return before the opponent wins by forfeit. A
  single identity may hold several connections (tabs, devices); only the last one closing counts.
- **Matchmaking.** Longest wait first. Ranked pairs within ±100 rating, widening by 25 per second up
  to ±600, and the stricter of the two players' windows decides. Re-queueing within 10 seconds
  resumes the old search, so cancelling cannot be used to reset an already-wide band.
- **Seats.** Assigned by coin flip, because seat 0 moves first.
- **Ratings.** Glicko-2, ranked only. A first rated game moves a rating a long way — that is correct;
  the deviation starts at 350 and shrinks as the system learns the player.

## Not done yet

- **Auth is identity-only.** `ctx.sender` is whatever identity the connection presents, and a fresh
  connection gets a fresh one with an auto-created guest profile. "Guest" currently means "has not
  chosen a username", which is what gates ranked play. Wiring a real OIDC provider (SpacetimeAuth,
  Auth0, …) is what turns that into a durable account, and is the one thing to revisit before this
  is exposed beyond local testing.
- **No chat.** The previous backend had channel presence and chat; that was not carried over.
