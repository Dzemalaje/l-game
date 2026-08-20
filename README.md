# The L Game

An Expo 57 game for web, iOS, and Android. The app shares one TypeScript rules engine and one
headless client controller across platforms. HeroUI Native renders iOS/Android controls, HeroUI
React renders web controls, and React Native SVG draws the board. A SpacetimeDB module owns every
online move, clock, result, rating, leaderboard record, avatar recipe, friendship, and presence
state - see [spacetimedb/ARCHITECTURE.md](spacetimedb/ARCHITECTURE.md).

There is no separate game server and no application database to configure. SpacetimeDB *is* the
database, with the game logic uploaded into it as a module, and clients connect to it directly over
a websocket.

## Requirements

- Node.js 22.13 or newer (Node 24 is used by the production builder)
- npm
- The SpacetimeDB CLI (`spacetime`) - https://spacetimedb.com/install
- Expo Go or an Android/iOS simulator for native development

## Start locally

```powershell
Copy-Item .env.example .env
npm install
npm run stdb:start
```

In a second terminal, publish the module and start the app:

```powershell
npm run stdb:publish
npm run web
```

Web opens through Expo. For a phone over Expo Go run `npm run native`; for an Android emulator run
`npm run android`; for iOS on macOS run `npm run ios`.

**Do not open a phone against the web dev server.** Uniwind compiles a single stylesheet per Metro
server and the platform is chosen by the command that starts it, so a device connecting to
`npm run web` bundles native JS against the web stylesheet: no theme colours compile and the app
fills with `colorKit.RGB` errors. The app detects this and prints one line telling you to restart
with `npm run native`. Serving both at once needs two servers on different ports.

A physical phone cannot use your computer's `127.0.0.1`: set
`EXPO_PUBLIC_SPACETIMEDB_URL=ws://YOUR_LAN_IP:3000` before starting Expo, or edit Connection
settings inside the app.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run web` | Start Expo for web |
| `npm run android` | Open the Android development client/emulator |
| `npm run ios` | Open iOS (macOS required) |
| `npm run native` | Start Expo for a phone over Expo Go |
| `npm run dev` | Run Expo web and the local SpacetimeDB together |
| `npm run stdb:start` | Start SpacetimeDB on 127.0.0.1:3000 |
| `npm run stdb:publish` | Build and publish the game module |
| `npm run stdb:generate` | Regenerate `src/module_bindings` after a schema change |
| `npm run stdb:play` | Standalone play page for testing the backend directly |
| `npm run stdb:logs` / `stdb:sql` | Follow module logs / open a SQL REPL |
| `npm run build:web` | Static Expo web export to `dist/` |
| `npm run check` | Types, lint, rules, builds, and the offline browser smoke |
| `npm run check:full` | Also exercise two live clients against a running server |

## Environment

Expo exposes only variables prefixed with `EXPO_PUBLIC_` to the client:

```dotenv
EXPO_PUBLIC_SPACETIMEDB_URL=ws://127.0.0.1:3000
EXPO_PUBLIC_SPACETIMEDB_NAME=l-game
EXPO_PUBLIC_LEGAL_OPERATOR=Your legal name or company
EXPO_PUBLIC_LEGAL_CONTACT=privacy@example.com
```

There are no server secrets to configure for local play. Accounts are SpacetimeDB identities: the
client holds a token and the server verifies it on every connection.

## Native builds

Expo Go is enough for normal development. For signed store builds, install and authenticate EAS:

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

Before publishing, replace `com.lgame.app` in `app.json` with identifiers you control, configure
store signing in EAS, add final store artwork/metadata, and test against a production `wss://`
SpacetimeDB URL on real devices. iOS submission requires an Apple Developer account; Android submission requires a
Google Play Console account. Follow current [Expo build](https://docs.expo.dev/build/introduction/)
and [submission](https://docs.expo.dev/submit/introduction/) documentation.

## Game and online behavior

- Offline: vs CPU and Pass and play run entirely in the shared client rule engine, and keep working
  when the server is unreachable.
- A turn is one gesture: drag through four highlighted squares to place the L, then drag a neutral
  disc if you want to move one, and End turn commits both. Tapping squares one at a time does the
  same thing, and the board stays fully keyboard and screen-reader operable.
- A match fills the screen and never scrolls. On a phone it is laid out inside a 9:16 frame.
- Online: a connection is issued an identity and given a guest profile automatically. Claiming a
  username is what unlocks ranked play and lets friends find you.
- Ranked matching begins within ±100 rating, widens by 25 per second, and caps at ±600. The rating
  used is read from the caller's own row, never from the request.
- The module validates complete moves, owns five-minute clocks, pauses for a 20-second reconnect
  grace, records results, and updates Glicko-2. The leaderboard is derived from the same rows the
  ratings live in, so the two cannot disagree.
- The all-time board is intentional. A weekly board was removed because splitting a small ranked
  population without seasons/rewards produces a less useful ranking.
- DiceBear stores only an allowed style and an opaque random seed. The avatar URL never contains a
  username or account identifier.

Finished games stay in the `match` table as durable history. Deleting an account strips the identity
from those rows but keeps the recorded names, so the opponent keeps a readable record.

## Project map

- `src/app/` — Expo Router entry and static web document.
- `src/GameApp.tsx` — adaptive application shell and platform navigation.
- `src/components/ui/` — HeroUI Native/React platform adapters.
- `src/components/GameBoard.tsx` — accessible React Native SVG board.
- `src/game/controller.ts` — backend-agnostic state machine: queues, clocks, CPU, and match flow.
- `src/game/net.ts` — the SpacetimeDB connection, subscriptions, and reducer calls.
- `src/module_bindings/` — generated by `spacetime generate`; do not edit by hand.
- `src/shared/rules.ts` — pure game validation and CPU search, also used by tests.
- `spacetimedb/` — the authoritative game module, its tests, and a standalone play page.
- `deploy/` — the Dockerfiles and Caddy configs the production stack is built from.
- `docker-compose.yml` — the whole deployed stack, in one file.

See [ARCHITECTURE.md](spacetimedb/ARCHITECTURE.md) for the backend design, security, and data flow.
The supplied legal documents are templates and need review for the countries where the service
operates.

## Deployment

The stack deploys to a Dokploy VPS straight from this repository: push to `main`, press Deploy, and
Dokploy builds the web export, starts SpacetimeDB, and publishes the game module. Two containers are
public - the static site and a path allowlist in front of SpacetimeDB - while the database itself
stays on a private network, because a SpacetimeDB server accepts a publish from anyone who can reach
it.

The same stack runs locally for a rehearsal:

```bash
docker network create dokploy-network
docker compose -f docker-compose.yml -f deploy/compose.local.yml up --build
```

Full instructions, including the publishing token you must save after the first deploy, are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
