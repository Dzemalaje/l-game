import * as SecureStore from "expo-secure-store";

/** SecureStore keeps account tokens out of AsyncStorage on iOS and Android. */
export const storage = {
  async get(key: string, fallback = "") {
    try { return (await SecureStore.getItemAsync(key)) ?? fallback; }
    catch { return fallback; }
  },
  async set(key: string, value: string) {
    try {
      if (value) await SecureStore.setItemAsync(key, value);
      else await SecureStore.deleteItemAsync(key);
    } catch { /* Preferences are optional; a locked keychain must not stop offline play. */ }
  },
};

