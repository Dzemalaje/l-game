/** Web uses localStorage; the stored value is an identity token the server re-verifies on connect. */
export const storage = {
  async get(key: string, fallback = "") {
    try { return globalThis.localStorage?.getItem(key) ?? fallback; }
    catch { return fallback; }
  },
  async set(key: string, value: string) {
    try {
      if (value) globalThis.localStorage?.setItem(key, value);
      else globalThis.localStorage?.removeItem(key);
    } catch { /* Private browsing may reject persistence; keep the running session usable. */ }
  },
};

