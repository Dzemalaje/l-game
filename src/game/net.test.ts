/**
 * Tests for the server-address parsing.
 *
 * This exists because a malformed address used to reach the SpacetimeDB SDK untouched and fail
 * inside `new URL(...)`, surfacing as a browser-specific complaint ("URL constructor: … is not a
 * valid URL") about a string the player never typed in that form. Everything below is now rejected
 * or corrected before it gets that far.
 *
 *   npx tsx --test src/game/net.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { normalizeServerUrl as normalize, platformDefault } from "./serverUrl";

const FALLBACK = "ws://127.0.0.1:3000";
const normalizeServerUrl = (value: string) => normalize(value, FALLBACK);

test("websocket addresses are kept as they are", () => {
  assert.equal(normalizeServerUrl("ws://127.0.0.1:3000"), "ws://127.0.0.1:3000");
  assert.equal(normalizeServerUrl("wss://play.example.com:3000"), "wss://play.example.com:3000");
  assert.equal(normalizeServerUrl("  ws://127.0.0.1:3000  "), "ws://127.0.0.1:3000");
});

test("http addresses are converted to websockets", () => {
  assert.equal(normalizeServerUrl("http://127.0.0.1:3000"), "ws://127.0.0.1:3000");
  assert.equal(normalizeServerUrl("https://play.example.com"), "wss://play.example.com");
});

test("a bare host is assumed to be a websocket", () => {
  assert.equal(normalizeServerUrl("127.0.0.1:3000"), "ws://127.0.0.1:3000");
  assert.equal(normalizeServerUrl("play.example.com"), "ws://play.example.com");
});

test("an empty field falls back to the default", () => {
  assert.equal(normalizeServerUrl(""), FALLBACK);
  assert.equal(normalizeServerUrl("   "), FALLBACK);
});

test("the default follows the platform and the page it is served from", () => {
  // An explicit EXPO_PUBLIC_SPACETIMEDB_URL overrides all of this by design, so skip when it is set.
  if (process.env.EXPO_PUBLIC_SPACETIMEDB_URL) return;
  assert.equal(platformDefault("android"), "ws://10.0.2.2:3000");
  assert.equal(platformDefault("ios"), "ws://127.0.0.1:3000");
  assert.equal(
    platformDefault("web", { protocol: "https:", hostname: "play.example.com" }),
    "wss://play.example.com:3000",
  );
  assert.equal(
    platformDefault("web", { protocol: "http:", hostname: "192.168.1.20" }),
    "ws://192.168.1.20:3000",
  );
});

test("a mistyped scheme is rejected rather than read as a hostname", () => {
  // The exact address that produced the original bug report. Without the guard this parses as the
  // host "http" with a path, and the app silently tries to connect somewhere that does not exist.
  assert.throws(() => normalizeServerUrl("http//:127.0.0.1:3000"), /not a valid address/);
  assert.throws(() => normalizeServerUrl("ws//127.0.0.1:3000"), /not a valid address/);
  assert.throws(() => normalizeServerUrl("://127.0.0.1:3000"), /not a valid address/);
});

test("other rubbish is rejected with a readable message", () => {
  assert.throws(() => normalizeServerUrl("not a url"), /not a valid address/);
  assert.throws(() => normalizeServerUrl("ftp://127.0.0.1:3000"), /not a valid address/);
  assert.throws(() => normalizeServerUrl("ws://"), /not a valid address/);
});

test("the rejection message says what a good address looks like", () => {
  assert.throws(() => normalizeServerUrl("http//:127.0.0.1:3000"), /ws:\/\/127\.0\.0\.1:3000/);
});
