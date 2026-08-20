export type Tab = "play" | "leaders" | "friends" | "locker";
export type Mode = "cpu" | "local" | "online";
export type Phase = "l" | "neutral" | "gameover";
/**
 * The first-run path, shown before the app proper.
 *
 * "welcome" says what the game is; "tutorial" makes you play a turn of it. Both are skippable, and
 * once either is finished the stage is `undefined` for good.
 */
export type IntroStage = "welcome" | "tutorial";
export type ConnectionState = "idle" | "queueing" | "waiting" | "reconnecting" | "connected" | "disconnected";
export type LockerCategory = "pieces" | "boards" | "avatars";
export type LeaderboardScope = "global" | "friends";
export type LegalPage = "terms" | "privacy" | "credits";

export const CLOCK_SECONDS = 300;
export const URGENT_SECONDS = 30;
export const PREVIEW_INTERVAL_MS = 70;

export const STORAGE = {
  pieceSkin: "lgame.pieceSkin",
  boardSkin: "lgame.boardSkin",
  server: "lgame.server",
  /** The SpacetimeDB identity token. Reusing it is what makes an account survive a restart. */
  token: "lgame.authToken",
  /** Set once the welcome screen or the tutorial has been finished or skipped. */
  intro: "lgame.introSeen",
} as const;
export const LEGAL_OPERATOR = process.env.EXPO_PUBLIC_LEGAL_OPERATOR ?? "The L Game operator";
export const LEGAL_CONTACT = process.env.EXPO_PUBLIC_LEGAL_CONTACT
  ?? "Not configured — set EXPO_PUBLIC_LEGAL_CONTACT before public release";

export const AVATAR_CHOICES = [
  { style: "lorelei", name: "Lorelei" },
  { style: "lorelei-neutral", name: "Lorelei Neutral" },
  { style: "notionists", name: "Notionists" },
  { style: "notionists-neutral", name: "Notionists Neutral" },
  { style: "pixel-art", name: "Pixel Art" },
  { style: "pixel-art-neutral", name: "Pixel Art Neutral" },
  { style: "open-peeps", name: "Open Peeps" },
  { style: "thumbs", name: "Thumbs" },
] as const;

