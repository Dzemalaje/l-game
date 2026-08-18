# Deploying with Dokploy

The whole game runs from this repository. Dokploy watches the GitHub repo, builds the images defined
in [`docker-compose.yml`](../docker-compose.yml), and restarts the stack. There is nothing to install
on the server by hand and no configuration that lives only on the VPS.

```text
internet
  |
  |-- https://APP_DOMAIN  --> Traefik --> web           static Expo export on Caddy
  |
  `-- wss://STDB_DOMAIN   --> Traefik --> stdb-gateway  path allowlist on Caddy
                                              |
                                    (private network)
                                              |
                                          spacetimedb  the game module + all player data
                                              ^
                                              |
                                         stdb-publish  runs once per deploy, then exits
```

## Why SpacetimeDB is not exposed directly

A SpacetimeDB server accepts a publish from anyone who can reach it. Pointed straight at the
internet, a stranger could replace the game module, run SQL against it, or delete the database. The
upstream self-hosting guide solves this with an nginx allowlist; `stdb-gateway` is that allowlist,
kept in the repo so it deploys with everything else.

Exactly four routes are public, and everything else answers 404:

| Route | Why |
| --- | --- |
| `POST /v1/identity` | the TypeScript SDK needs it to obtain an identity |
| `GET /v1/database/<name>/subscribe` | the websocket the entire game runs on |
| `GET /v1/ping` | liveness only; returns nothing and changes nothing |

Deploys publish the module from `stdb-publish`, which sits *inside* the private network and never
passes through the gateway.

## One-time setup

### 1. DNS

Two A records, both pointed at the VPS:

```text
APP_DOMAIN    e.g. lgame.example.com    the game
STDB_DOMAIN   e.g. stdb.example.com     the websocket
```

### 2. Create the Dokploy service

In Dokploy: **Create Service → Compose**, then under **General**:

- **Source:** GitHub → this repository → branch `main`
- **Compose Path:** `./docker-compose.yml`
- **Compose Type:** `Docker Compose` — *not* Stack. Swarm mode cannot build images, and this stack
  builds three.

### 3. Environment

Paste the contents of [`.env.deploy.example`](../.env.deploy.example) into **Environment** and fill
it in. Dokploy writes these to a `.env` next to the compose file, which is where the `${...}`
references read from. Leave `SPACETIMEDB_TOKEN` empty for now.

### 4. Deploy

Press **Deploy**. The first run pulls the SpacetimeDB image, builds the web export, and publishes the
module; expect a few minutes. Traefik issues certificates about ten seconds after the containers are
up.

Check `stdb-publish` in the deploy logs. It should end with `publish: l-game is live`.

### 5. Save the publishing token — do not skip this

A SpacetimeDB database belongs to the identity that created it, and only that identity may ever
update it. On the first deploy that identity is generated inside the `stdb-cli` volume. **If the
volume is lost and the token was never saved, every future deploy fails with a 403 and the database
can never be updated again** — the data is still there, but unreachable by any new deploy.

Read it once, from the Dokploy terminal for this service:

```bash
docker compose run --rm --entrypoint sh stdb-publish -c 'grep spacetimedb_token ~/.config/spacetime/cli.toml'
```

Put the value in **Environment** as `SPACETIMEDB_TOKEN` and redeploy. From then on the identity comes
from a value you hold, and the volume is only a cache. `stdb-publish` prints a warning on every
deploy until you do this.

## Day-to-day

**Shipping a change** — push to `main` and press **Deploy** (or enable Dokploy's GitHub webhook for
auto-deploy). Every deploy rebuilds the web image and republishes the module. Publishing an unchanged
module is a no-op, so redeploying costs nothing but build time.

**Changing a domain** — the SpacetimeDB URL is compiled into the JavaScript bundle, not read at
runtime, so `STDB_DOMAIN` only takes effect after a rebuild. Dokploy rebuilds on every deploy, so
changing the variable and redeploying is enough.

**A schema change that would destroy data** — `deploy/publish.sh` passes neither `--delete-data` nor
`--break-clients`, on purpose. If a table change would drop player ratings, match history or
friendships, the publish fails and the deploy goes red rather than silently wiping the database. To
go ahead anyway, run it deliberately from the Dokploy terminal:

```bash
docker compose run --rm --entrypoint spacetime stdb-publish \
  publish l-game --server http://spacetimedb:3000 --module-path /app/spacetimedb/spacetimedb \
  --delete-data=always --yes
```

**Backups** — everything a player owns is in the `stdb-data` volume. Nothing else in the stack holds
state; the images rebuild from git. Snapshot that volume on whatever schedule matters to you.

**Upgrading SpacetimeDB** — bump `SPACETIME_VERSION` in the environment. Server and CLI both come
from that one tag, so they can never drift apart. Check the SpacetimeDB release notes for migration
requirements first, and back up `stdb-data`.

## Rehearsing locally

The same stack runs on your own machine, so a change can be proven before it reaches the server:

```bash
docker network create dokploy-network
docker compose -f docker-compose.yml -f deploy/compose.local.yml up --build
```

The game is on <http://127.0.0.1:8080> and the gateway on <http://127.0.0.1:3001>, with the same
allowlist as production. Port 3001 rather than 3000 so it can run beside a local `npm run stdb:start`.

To exercise it the way a player would — two browsers, matchmaking, real turns:

```bash
EXPO_PUBLIC_SPACETIMEDB_URL=ws://127.0.0.1:3001 npm run build:web
EXPO_PUBLIC_SPACETIMEDB_URL=ws://127.0.0.1:3001 node tools/smoke-online-stdb.mjs
```

## When something is wrong

**`403 ... is not authorized to perform action on database`** — the publisher is presenting a
different identity than the one that created the database. The `stdb-cli` volume was replaced, or
`SPACETIMEDB_TOKEN` holds the wrong value. Restore the right token. If it is genuinely gone, the only
way forward is a fresh database with `--delete-data=always`, which loses every account and rating.

**The site loads but online play never connects** — open the browser console. If it is trying to
reach `wss://APP_DOMAIN:3000`, the web image was built without `STDB_DOMAIN` set; fix the variable
and redeploy. If it reaches `STDB_DOMAIN` and gets 404, check that the gateway is the service Traefik
routes to, not `spacetimedb` itself.

**504 from Traefik** — a service on more than one network needs Traefik told which to use. Both
public services already carry `traefik.docker.network=dokploy-network`; keep that label if you edit
the compose file.

**`Permission denied (os error 13)` from spacetimedb** — the data volume is root-owned while the
server runs as `spacetime`. `deploy/Dockerfile.spacetimedb` exists precisely to prevent this by
creating `/stdb` with the right owner in the image. Do not swap the service back to the stock
`clockworklabs/spacetime` image without recreating that directory.
