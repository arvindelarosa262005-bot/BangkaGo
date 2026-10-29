import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, Text, View } from "react-native";
import {
  focusManager,
  onlineManager,
  useQueryClient,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import {
  watchLive,
  liveLabels,
  tokens,
  type LiveState,
} from "@bangkago/shared";
import { supabase, configured } from "./client";
import { useSession } from "./session";
const Context = createContext<LiveState>({
  phase: "unconfigured",
  lastEventAt: null,
});
export function LiveProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>({
    phase: configured ? "connecting" : "unconfigured",
    lastEventAt: null,
  });
  useEffect(() => {
    if (configured)
      void supabase.realtime.setAuth(session?.access_token).catch(() => {});
  }, [session?.access_token]);
  useEffect(() => {
    let mounted = true;
    const controller = watchLive(supabase, {
      enabled: configured,
      authenticated: !!session,
      refresh: () => client.invalidateQueries({ refetchType: "active" }),
      snapshot: () =>
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      state: setState,
    });
    const cache = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success")
        controller.reschedule();
    });
    const app =
      Platform.OS !== "web"
        ? AppState.addEventListener("change", (s) => {
            focusManager.setFocused(s === "active");
            if (s === "active") controller.reconnect();
          })
        : null;
    const network = (value: boolean) => {
      if (!mounted) return;
      onlineManager.setOnline(value);
      controller.setOnline(value);
    };
    const networkChanged = (state: Network.NetworkState) => {
      if (state.isConnected === false || state.isInternetReachable === false)
        network(false);
      else if (state.isConnected === true || state.isInternetReachable === true)
        network(true);
    };
    const networkListener =
      Platform.OS !== "web"
        ? Network.addNetworkStateListener(networkChanged)
        : null;
    if (Platform.OS !== "web")
      void Network.getNetworkStateAsync()
        .then(networkChanged)
        .catch(() => {});
    const online = () => network(true),
      offline = () => network(false),
      focus = () => {
        if (typeof document === "undefined" || !document.hidden)
          controller.reconnect();
      };
    if (Platform.OS === "web") {
      network(navigator.onLine);
      window.addEventListener("online", online);
      window.addEventListener("offline", offline);
      window.addEventListener("focus", focus);
      document.addEventListener("visibilitychange", focus);
    }
    return () => {
      mounted = false;
      cache();
      controller.stop();
      app?.remove();
      networkListener?.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
        window.removeEventListener("focus", focus);
        document.removeEventListener("visibilitychange", focus);
      }
    };
  }, [client, session?.user.id]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useLive = () => useContext(Context);
export function LiveIndicator() {
  const live = useLive();
  const color =
    live.phase === "live"
      ? tokens.colors.ocean
      : live.phase === "offline"
        ? tokens.colors.error
        : live.phase === "unconfigured"
          ? tokens.colors.muted
          : tokens.colors.warning;
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-end",
        paddingVertical: 3,
      }}
    >
      <View
        style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: color }}
      />
      <Text
        style={{ color, fontSize: 10, fontWeight: "600", letterSpacing: 0.2 }}
      >
        {liveLabels[live.phase]}
      </Text>
    </View>
  );
}
