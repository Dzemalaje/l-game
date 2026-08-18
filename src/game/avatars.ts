import { AVATAR_CHOICES } from "./constants";

export function diceBearUrl(style: string, seed: string) {
  return `https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Builds the avatar URL for a stored style/seed pair, passing it through the same allow-list as any
 * other source — the style is player-supplied, so it is not trusted just because it came back from
 * our own database.
 */
export function avatarUrl(style: string, seed: string) {
  return safeAvatarUrl(diceBearUrl(style, seed));
}

/** Only allow the DiceBear styles offered by the picker; server/user metadata cannot inject URLs. */
export function safeAvatarUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const offered = AVATAR_CHOICES.some(({ style }) => url.pathname === `/10.x/${style}/svg`);
    return url.protocol === "https:" && url.hostname === "api.dicebear.com" && offered ? url.href : "";
  } catch { return ""; }
}

