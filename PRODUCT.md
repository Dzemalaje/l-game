# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Expo SDK 57 with Expo Router for web, iOS, and Android. HeroUI Native supplies mobile interface
components; HeroUI React supplies web interface components because HeroUI Native does not recommend
its current release for web. Shared TypeScript owns game rules, client state, and SpacetimeDB
networking.

## Users

People who want a short, competitive abstract-strategy match against the CPU, another person on the
same device, or an online opponent. Players may arrive as casual guests or create an email account
for persistent ranked and social features.

## Product Purpose

The L Game makes Edward de Bono's four-by-four strategy game quick to learn and reliable to play on
desktop and mobile. Success means the board is immediately understandable, input is precise, online
results are trustworthy, and every connection or match state is visible.

## Positioning

One compact client supports offline CPU and Pass & Play while the SpacetimeDB module owns online
legality, clocks,
reconnection, ratings, friends, presence, and leaderboards. Clients can preview intent but cannot
forge an online result or rank.

## Operating Context

Matches are touch-first and usually played in short sessions. The same account, avatar, friends, and
rank should work across web, iOS, and Android. Native system back behavior, safe areas, accessible
text sizing, reduced motion, and keyboard/pointer input on web are part of normal use.

## Capabilities and Constraints

- Preserve CPU, Pass & Play, casual and ranked matchmaking, authoritative clocks, waiting,
  queueing, reconnecting, disconnected, and game-over states.
- Preserve device-held identity accounts, name editing, DiceBear avatar selection, friends, online
  count, personal rank, global/friends leaderboards, rules guide, legal pages, and credits.
- SpacetimeDB remains the only application backend: it is the database and the game server at once,
  so there is no separate application database.
- There is one all-time ranked leaderboard. Weekly rankings remain intentionally absent.
- The board must work with touch, pointer, and keyboard input without KAPLAY.
- Web remains deployable to a Caddy/SpacetimeDB VPS stack through Dokploy; iOS and Android use Expo
  builds.

## Brand Commitments

The product name is The L Game. Preserve the restrained sage, paper, red, and blue identity, direct
instructional voice, clear side colors, and uncluttered board-first hierarchy while translating the
controls into HeroUI and native platform conventions.

## Evidence on Hand

The existing client contains working product copy, complete flows, legal text, icons, DiceBear
integration, screenshots, shared rules, an authoritative SpacetimeDB module, and automated tests.
There are
no testimonials, commercial claims, or supplied marketing images to invent.

## Product Principles

- The board and current turn are always the clearest information.
- Server authority and connection state are visible, never implied.
- One codebase shares behavior while each platform keeps its expected navigation and input model.
- Cosmetics may add personality but never weaken piece contrast or game-state legibility.
- A match always has a safe, responsive route to replay or leave after it ends.

## Accessibility & Inclusion

Support color-independent labels, screen-reader descriptions, keyboard play on web, 44 pt iOS and
48 dp Android touch targets, safe areas, system back behavior, scalable text, and reduced motion.
