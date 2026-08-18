# The L Game — Privacy Policy

Last updated: 14 August 2026

**[LEGAL OPERATOR — configure `EXPO_PUBLIC_LEGAL_OPERATOR`]** is responsible for personal data processed
by this deployment of The L Game. Contact: **[LEGAL CONTACT — configure `EXPO_PUBLIC_LEGAL_CONTACT`]**.

## What we process

- **Account data:** a SpacetimeDB identity, a username you choose, connection records, and an
  optional DiceBear avatar style and opaque seed. There is no email address and no password: an
  account is a cryptographic identity held by your device, so we never receive or store either.
- **Game data:** moves, clocks, match results, Glicko-2 rating, wins/losses, leaderboard rank, and
  reconnect state.
- **Social data:** friend relationships, requests, blocks, notifications, and temporary online or
  presence status.
- **Technical data:** server request and security logs may contain timestamps, IP addresses, user
  agents, errors, and identifiers needed to operate and protect the service.
- **On your device:** the identity token that is your account, the configured server address, and
  your chosen board and piece appearance, stored in Expo SecureStore on iOS/Android or localStorage
  on web. Losing that token means losing access to the account, because nothing else identifies
  you to us.

## Why we use it

We use this data to provide accounts, matchmaking, authoritative games, rankings, avatars, friends,
security, troubleshooting, and service integrity. Depending on jurisdiction, the legal bases are
performance of the service agreement, legitimate interests in operating and securing the game,
legal obligations, and consent where specifically required.

## Sharing and external services

SpacetimeDB is self-hosted infrastructure for this deployment and is both the database and the game
server; there is no separate application database. Game code does not send account data to any
analytics or advertising service.

When an avatar is displayed, the app requests an SVG from `api.dicebear.com`. DiceBear receives
ordinary web-request data such as IP address and user agent plus an opaque random seed and style. The
avatar URL does not contain the player's username or identity. DiceBear's own legal
and privacy notices govern that request: <https://www.dicebear.com/>.

## Visibility

Your username, avatar, rating, record, rank, online indicator, friendship state, and the names
recorded on finished matches are readable by other connected players, as gameplay and the
leaderboard require. Your identity token is never shared and never leaves your device except to
authenticate your own connection.

## Retention and deletion

Account, rating, social, and match records are retained while the account or service is active and
as reasonably needed for security, disputes, backups, and legal obligations. **Before production,
the operator must replace this sentence with concrete log and backup retention periods.**

You may request access, correction, export, objection or restriction where applicable, or deletion
through the contact above. Some records may be retained where law or security requires it.

## Security, children, and changes

We use access controls, server-authoritative validation, and restricted storage permissions, but no
system is completely secure. The online service is not directed to children below the minimum
digital-consent age in their country. We will update this notice when processing materially changes.
