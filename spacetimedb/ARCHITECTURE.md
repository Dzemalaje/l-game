# The L Game backend, explained

This document explains the server we built: what SpacetimeDB is, why the backend is shaped the way
it is, and where each decision lives in the code. It is meant to be read once, top to bottom, by
someone who has never seen SpacetimeDB before.

For commands and day-to-day workflow, see [README.md](./README.md).

---

## 1. What SpacetimeDB is, and what changed because of it

A conventional multiplayer stack has three tiers: a database, a game server that owns the rules, and
clients that talk to the game server over sockets. The previous backend for this game was exactly
that — Postgres, a Colyseus room server, and the app.

SpacetimeDB collapses the middle tier. You upload your application logic *into* the database as a
**module**, and clients connect to the database directly. There is no game server process to deploy,
scale, or keep in sync with the schema.

That produces three concrete differences from the Colyseus version:

**There is no request/response.** A client never asks "what is the board?" It *subscribes* to a SQL
query, receives every matching row immediately, and then receives every change to those rows as they
happen. State arrives by replication, not by polling or by hand-written patch messages.

**Writes are reducers.** A client cannot write a table. It calls a **reducer** — a function that runs
inside the database, in a transaction, with the caller's identity attached. Reducers do not return
data; they change rows, and the changes flow back out through subscriptions.

**Identity is built in.** Every connection carries an `Identity`, and reducers see it as `ctx.sender`.
There is no session table to maintain and no token to validate in application code.

The module is written in TypeScript and runs on V8 inside the database. Rust, C# and C++ are also
supported and compile to WebAssembly; TypeScript was chosen here because the rest of this project is
TypeScript, which let the game rules be ported directly and cross-checked against the client's own
implementation.

---

## 2. The shape of the module

```
spacetimedb/spacetimedb/src/
  index.ts     schema binding, lifecycle hooks, every reducer   <- module entry point
  tables.ts    table definitions
  rules.ts     the L Game rules       — pure, no I/O, no clock, no randomness
  rating.ts    Glicko-2               — pure, no I/O, no clock, no randomness
```

`rules.ts` and `rating.ts` are deliberately free of any SpacetimeDB import. They take their inputs as
plain values — including the current time, which is passed in rather than read from a clock. That is
what makes them testable outside the database, and it is also a hard requirement: **reducers must be
deterministic**, so a module may not call `Date.now()`, `Math.random()`, the network, or the
filesystem. Time and randomness come from the reducer context instead (`ctx.timestamp`, `ctx.random`).

`index.ts` owns the two scheduled tables, because a scheduled table has to reference the reducer it
drives. Keeping them next to those reducers avoids an import cycle with `tables.ts`.

---

## 3. The data model

Ten tables. Everything except `connection` is public — meaning clients may *read* it by subscription.
Public never means writable; writes are always reducers.

| Table | Purpose |
|---|---|
| `player` | Profile, online flag, and the full Glicko-2 triple |
| `connection` | One row per open socket (private) |
| `queue_entry` | Who is searching, for what, since when |
| `game` | The live board, clocks, seats and result |
| `active_game` | identity → its one live game |
| `preview` | The "opponent is thinking" relay |
| `match` | Finished games, for history and profiles |
| `friend_edge` | Friendship as directed edges |
| `queue_timer`, `game_timer` | Scheduled tables driving the two tick reducers |
| `leaderboard` | A *view*, not a table — top 100 derived from `player` |

Four of these deserve an explanation, because they are the non-obvious ones.

### `active_game` — why a second table for one number

"Which game am I in?" is asked constantly: before queueing, on every reconnect, on every tick. Asking
it of `game` means scanning every game ever played, which gets slower forever. `active_game` holds one
row per player pointing at their live game, inserted when a game starts and deleted when it ends, so
the question is a primary-key lookup that costs the same on day 1000 as on day 1.

It does a second job for free: because the primary key is the identity, **one account cannot be in two
games at once**. That constraint is enforced by the database, not by careful code.

### `connection` — why `online` is not a boolean anyone sets

One identity can hold several connections: two browser tabs, a phone and a laptop. If `online` were a
flag each connection wrote, the second tab closing would mark a player offline while they were still
playing in the first.

So `connection` holds one row per open socket, and "online" means *this table has at least one row for
me*. `player.online` is a cached view of that, updated only when the last connection goes.

### `preview` — a relay that cannot lie

While you drag out an L, your opponent watches it happen. That is a table: one row per game, holding
the squares drawn so far and the candidate L. The opponent subscribes and sees it change.

The important part is what the reducer refuses to store. Only the player on move may write, and a
claimed complete L is only relayed **if it is actually a legal placement**. So the channel cannot be
used to render a position on someone else's screen that could never occur in a real game.

### `friend_edge` — one row per person, not per relationship

A friendship is stored as two directed rows: yours pointing at them, theirs pointing at you. That
looks redundant until you consider reads — each client subscribes with `owner = :sender` and receives
exactly its own social graph, never anyone else's.

`state` uses the numbering the UI already speaks: `0` mutual, `1` request sent, `2` request received,
`3` blocked. Blocking keeps only the blocker's row and deletes the other, so the blocked player simply
sees the friendship end rather than being told they were blocked. A blocked player's later requests
are accepted and silently discarded, for the same reason.

### The board, and why it is stored as integers

Cells are flat indices, `index = y * 4 + x`, in `0..15`. A position is a 16-bit mask where bit `index`
is set. Overlap becomes a single `AND`, and the complete table of legal L placements — all 48 of them
— is computed once when the module loads.

The client stores cells as `[x, y]` pairs instead. The two representations are checked against each
other by a test that plays random games through both at once (§8).

---

## 4. The security model

This is the part worth internalising, because it is the whole reason the server exists.

**Clients never write a table.** They call reducers and read by subscription. Every reducer re-derives
what the caller may do from `ctx.sender` and the *stored* state — never from what the client sent. A
modified client can call any reducer with any arguments and still cannot cheat.

Concretely, the things a client might otherwise lie about:

| Claim | Where it is actually decided |
|---|---|
| "this move is legal" | `rules.ts`, re-validated against the stored board |
| "it's my turn" | `game.turn` compared against the caller's seat |
| "I'm a player in this game" | `game.player0` / `player1` compared to `ctx.sender` |
| "my rating is X" | read from the caller's `player` row when queueing |
| "I've been waiting a while" | `queue_entry.queued_at`, written by the server |
| "my opponent is thinking about this L" | relayed only if it is a legal placement |
| "my clock still has time" | charged from `charged_at` on the server's own timestamp |

Rejections are thrown as `SenderError`, which aborts the transaction — so a refused move leaves no
trace at all, rather than half-applying and needing to be undone.

---

## 5. Time: clocks, ticks and disconnects

Two scheduled reducers run once a second. Scheduled reducers are rows in a scheduled table; inserting
a row with `ScheduleAt.interval(...)` in `init` is what starts them.

### Charging the clock

Each game stores `clock0_ms`, `clock1_ms`, and `charged_at` — the instant the clocks were last
settled. The rule is:

> Whatever touches a game first — the tick or a move — bills the interval since `charged_at` to
> whoever is on move, then advances `charged_at`.

Because both paths go through the same `chargeClocks` helper and both advance the marker, the same
second can never be charged twice, and a move is never billed at a different rate than a tick. The
clock is paused unless the game is live *and both players are connected*, so a disconnect does not
also cost the dropped player time.

`gameTick` then walks the live games — reached via `active_game`, so the cost tracks games *in
progress* rather than games ever played — and ends any where the clock hit zero.

### Disconnects

Losing a socket does not lose the game. When the last connection for an identity closes, the game
records a deadline 20 seconds out. Reconnecting inside that window clears it and resets `charged_at`
so the pause is not billed. Missing it hands the opponent a win by forfeit.

When both players' windows expire, the one whose deadline passed *first* forfeits — decided by
deadline rather than by seat order, so a simultaneous double disconnect is not silently biased against
seat 0.

### Matchmaking

`queueTick` pairs waiting players, longest wait first so nobody starves behind new arrivals. Ranked
pairs within ±100 rating, widening by 25 points per second of waiting up to ±600, and **the stricter
of the two players' windows decides** — a player who just joined cannot be dragged into a mismatch by
someone who has been waiting ten minutes.

Re-queueing within 10 seconds resumes the original search time, so cancelling and re-queueing cannot
be used to keep an already-wide rating band. Seats are assigned by coin flip, because seat 0 moves
first.

---

## 6. Ratings

Glicko-2, implemented from Glickman's paper, and applied to ranked games only. A rating is three
numbers, not one: the rating itself, a **deviation** measuring how uncertain that rating is, and a
**volatility** measuring how erratic the player's results are.

The practical consequence, which surprises people: a first rated game moves a rating a *long* way —
1500 to roughly 1660 for a win. That is correct. Deviation starts at 350, meaning the system has no
idea how good you are, so it moves aggressively. As deviation shrinks the same result moves you far
less. Deviation also grows back while a player is idle, capped so a long absence cannot make a rating
meaningless.

Both players' new ratings are computed from the *pre-match* values of both, so the order they are
written in cannot matter. Ratings, the match record and the final board are all written in the same
reducer, which means one transaction — a finished game and its rating change cannot disagree.

The `leaderboard` view is derived from `player` rather than stored separately, so it cannot drift out
of sync with the ratings it ranks.

---

## 7. How the app talks to it

The Expo client was migrated onto this backend, and the shape of that migration is worth recording
because it is the part most people get wrong.

All of the SpacetimeDB knowledge lives in **one file**, `src/game/net.ts`. It owns the connection,
the subscriptions, and the reducer calls, and it exposes the game as plain values — a profile, a
friends list, a leaderboard, and a `MatchSnapshot`. `src/game/controller.ts` — the 1000-line state
machine that runs the board, the clocks, the CPU opponent and the whole view model — imports no
database type at all. That is why the migration replaced roughly 600 lines of networking while
leaving the game itself untouched.

The client subscribes with `:sender`-scoped queries, so it only ever replicates its own games, its
own queue ticket and its own half of each friendship:

```sql
SELECT * FROM game        WHERE player0 = :sender
SELECT * FROM active_game WHERE identity = :sender
SELECT * FROM friend_edge WHERE owner = :sender
```

Two things that fell out of the change:

**Reads stopped being requests.** There is no "fetch the leaderboard" call any more. The leaderboard,
the online count, the friends list and the live board are all read straight out of the replicated
cache, and any change to any of them re-renders. `loadLeaderboard()` still exists only because the
screens call it; it no longer fetches anything.

**Moves are optimistic, and that needed a guard.** A move is applied locally before the server
confirms it, so the turn feels immediate. But *any* table change re-reads the whole cache, which
means a snapshot can be rebuilt from the old game row in the window before your own move replicates.
Without a guard that stale snapshot rolls the board back, and for a moment both players believe it is
their turn — which is exactly what the browser test caught. The controller now tracks the turn number
it optimistically advanced to and ignores older snapshots until its move lands or is rejected.

The app keeps working with the server down: vs CPU and Pass & Play run entirely in the client's own
rules engine, so a failed connection downgrades the app rather than blocking it.

## 8. How it is tested

Three suites, each aimed at a different failure mode.

**`npm run test:stdb`** — the rules cross-check. `spacetimedb/src/rules.ts` and `src/shared/rules.ts`
were written independently and store the board differently. This plays 40 random games through both at
once and fails the moment they disagree about a placement, a disc move, a turn or a winner. It needs
no server.

This test earned its keep immediately: it found that the server accepted "move a neutral disc onto its
own square" while the client rejected it — a no-op that should be expressed as "don't move a disc".
The server was made stricter to match. The old Colyseus server still has that laxness.

**`npm run test:stdb:e2e`** — 53 checks. Two real clients connect over websockets, get matched by the
server's own matchmaker, and play a complete game to a genuine "no legal moves left" finish, then
exercise forfeits, clocks, ratings, friends and account deletion. Nothing is stubbed.

**`npm run test:stdb:play`** — 15 checks. Headless Chrome loads the standalone play page in two tabs
and plays a match through it.

**`npm run smoke:online`** — 15 checks. Headless Chrome loads the *real Expo app* in two isolated
browser contexts, claims a username in each, queues both, and plays real turns through the actual
game UI. Isolated contexts matter: the identity token lives in localStorage, so two plain tabs would
be the same account.

**`npm run smoke:browser`** — the offline regression. Drives vs CPU and Pass & Play to completion
with no server running at all.

---

## 9. What is deliberately not done

**Auth is identity-only.** `ctx.sender` is whatever identity a connection presents, and a fresh
connection gets a fresh one with an auto-created guest profile. "Guest" currently means *has not chosen
a username*, and that is what gates ranked play. The token is durable, so an account survives restarts
on the same device — but it is a device-bound account, not an email login. Wiring an OIDC provider
(SpacetimeAuth, Auth0, Clerk, Google) is the one thing to do before this is exposed beyond local
testing, and SpacetimeDB supports all of them natively.

**Account deletion leaves match history.** Deleting an account strips the identity from past matches
but keeps the denormalised names, so the opponent keeps a readable record instead of losing their
history. That is a deliberate trade, not an oversight.

**No chat.** The previous backend had channel presence and chat; that was not carried over.

**The old backends are gone.** `nakama/`, `deploy/`, `docker-compose.yml` and the Nakama-era
`docs/` were removed once this module became the only backend. The sibling `l-game-server/`
(Colyseus) is likewise unused.
