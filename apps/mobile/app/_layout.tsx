import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../src/session";
import { LiveProvider } from "../src/live";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { supabase } from "../src/client";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
export default function Layout() {
  useEffect(() => {
    async function handle(url: string) {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === "string")
        await supabase.auth.exchangeCodeForSession(code);
    }
    Linking.getInitialURL().then((url) => {
      if (url) return handle(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <LiveProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </LiveProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
