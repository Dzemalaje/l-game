/**
 * Parsing and defaulting for the game server address.
 *
 * Deliberately free of any `react-native` import so it can be unit tested directly: this is pure
 * string handling, and it is the only thing standing between a mistyped address and a failure deep
 * inside the SpacetimeDB SDK's own `new URL(...)`.
 */

export interface LocationLike {
  protocol: string;
  hostname: string;
}

/** Where to connect when nothing has been configured or stored. */
export function platformDefault(platformOS: string, where?: LocationLike): string {
  const configured = String(process.env.EXPO_PUBLIC_SPACETIMEDB_URL ?? "").trim();
  if (configured) return configured;
  if (where?.hostname) {
    return `${where.protocol === "https:" ? "wss" : "ws"}://${where.hostname}:3000`;
  }
  // Native. Android emulators map the host loopback to 10.0.2.2; a physical device needs the LAN
  // address, either through EXPO_PUBLIC_SPACETIMEDB_URL or Connection settings in the app.
  return platformOS === "android" ? "ws://10.0.2.2:3000" : "ws://127.0.0.1:3000";
}

/**
 * Turns whatever is in the server field into a websocket URL the SDK can actually use.
 *
 * Accepts `ws://`, `wss://`, `http://`, `https://`, or a bare `host:port`. Anything else throws a
 * readable message here rather than failing later inside the SDK, where the error surfaces as a
 * browser-specific complaint about a string the player never typed in that form.
 */
export function normalizeServerUrl(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw) return fallback;

  const malformed = `"${raw}" is not a valid address. It should look like ws://127.0.0.1:3000`;
  // A "//" that is not part of a scheme means the scheme itself is mistyped - "http//:host" being
  // the usual slip. Caught here because it would otherwise parse as a host named "http".
  if (raw.includes("//") && !/^(wss?|https?):\/\//i.test(raw)) throw new Error(malformed);

  let candidate = raw;
  const scheme = /^([a-zA-Z][a-zA-Z\d+\-.]*):\/\//.exec(candidate);
  if (scheme) {
    const protocol = scheme[1]!.toLowerCase();
    const rest = candidate.slice(scheme[0].length);
    if (protocol === "http") candidate = `ws://${rest}`;
    else if (protocol === "https") candidate = `wss://${rest}`;
    else if (protocol !== "ws" && protocol !== "wss") throw new Error(malformed);
  } else {
    if (!/^[a-zA-Z0-9.\-[\]]+(:\d+)?(\/[^\s]*)?$/.test(candidate)) throw new Error(malformed);
    candidate = `ws://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(malformed);
  }
  if (!url.hostname) throw new Error(malformed);
  return url.toString().replace(/\/$/, "");
}
