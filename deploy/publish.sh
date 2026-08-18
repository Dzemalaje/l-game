#!/usr/bin/env bash
# Publish the game module into the SpacetimeDB instance in this compose project. Runs once per
# deploy; publishing an unchanged module is a no-op, so redeploying costs nothing.
set -euo pipefail

SERVER="${SPACETIMEDB_SERVER:-http://spacetimedb:3000}"
NAME="${SPACETIMEDB_NAME:-l-game}"
MODULE_PATH="${SPACETIMEDB_MODULE_PATH:-/app/spacetimedb/spacetimedb}"
CONFIG="${HOME:-/root}/.config/spacetime/cli.toml"

# depends_on/service_healthy already gates this, but a container can still win the race after a host
# reboot, and failing a deploy over two seconds of startup would be silly.
for attempt in $(seq 1 60); do
  if curl -fsS "${SERVER}/v1/ping" >/dev/null 2>&1; then break; fi
  if [ "${attempt}" -eq 60 ]; then
    echo "publish: ${SERVER} never became reachable" >&2
    exit 1
  fi
  sleep 2
done

# A database belongs to the identity that created it, and only that identity may update it. Every
# later deploy therefore has to present the same identity or the server answers 403.
#
# SPACETIMEDB_TOKEN is the supported way to hold onto it: it is a value you keep, so the deployment
# survives losing the stdb-cli volume. Without it the identity exists only inside that volume, and
# deleting the volume locks you out of your own database.
if [ -n "${SPACETIMEDB_TOKEN:-}" ]; then
  echo "publish: restoring the publishing identity from SPACETIMEDB_TOKEN"
  spacetime login --token "${SPACETIMEDB_TOKEN}" >/dev/null
fi

echo "publish: uploading ${NAME} to ${SERVER}"

# No --delete-data and no --break-clients, deliberately. A schema change that would destroy player
# ratings, match history or friendships must fail the deploy and be run by hand, rather than
# silently wiping the database because someone edited a table.
spacetime publish "${NAME}" --server "${SERVER}" --module-path "${MODULE_PATH}" --yes

echo "publish: ${NAME} is live"

if [ -z "${SPACETIMEDB_TOKEN:-}" ] && [ -f "${CONFIG}" ]; then
  cat >&2 <<'WARN'

publish: this deployment has no SPACETIMEDB_TOKEN set.
publish: the identity that owns the database now lives only in the stdb-cli volume. If that volume
publish: is ever lost, every future deploy fails with 403 and the database cannot be updated again.
publish: read the token once and store it as SPACETIMEDB_TOKEN in Dokploy -> Environment:
publish:   docker compose run --rm --entrypoint sh stdb-publish -c 'grep spacetimedb_token ~/.config/spacetime/cli.toml'

WARN
fi
