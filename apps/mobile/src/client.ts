import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { api } from "@bangkago/shared";
// Chunk long sessions to stay below native SecureStore per-value limits.
const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return localStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(key + ".count"));
    if (!count) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + i),
      ),
    );
    return chunks.some((c) => c === null) ? null : chunks.join("");
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await storage.removeItem(key);
    const chunks = value.match(/[\s\S]{1,1500}/g) ?? [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(key + "." + i, chunks[i]);
    await SecureStore.setItemAsync(key + ".count", String(chunks.length));
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    const count = Number(await SecureStore.getItemAsync(key + ".count"));
    await SecureStore.deleteItemAsync(key + ".count");
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(key + "." + i),
      ),
    );
  },
};
export const configured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://unconfigured.invalid",
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "unconfigured",
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce",
    },
  },
);
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
export const backend = api(supabase);
