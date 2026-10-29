import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { watchLive, type LiveState } from "@bangkago/shared";
import { supabase, configured } from "./client";
export function useLiveWorkspace(
  userId: string | null,
  token: string | null,
  authorized: boolean,
) {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>({
    phase: "unconfigured",
    lastEventAt: null,
  });
  useEffect(() => {
    if (configured)
      void supabase.realtime.setAuth(token ?? undefined).catch(() => {});
  }, [token]);
  useEffect(() => {
    const controller = watchLive(supabase, {
      enabled: configured && authorized,
      authenticated: !!userId,
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
    const online = () => controller.setOnline(true),
      offline = () => controller.setOnline(false),
      focus = () => {
        if (!document.hidden) controller.reconnect();
      };
    controller.setOnline(navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      cache();
      controller.stop();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [client, userId, authorized]);
  return state;
}
