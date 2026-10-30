import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { api } from "@bangkago/shared";

const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
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
      // Use implicit flow on native (Expo Go) to avoid Hermes WebCrypto PKCE hangs
      flowType: Platform.OS === "web" ? "pkce" : "implicit",
    },
  },
);

if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });

export const backend = api(supabase);
