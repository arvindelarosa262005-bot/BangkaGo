import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

/** Stream only minimal invalidation signals, then read authoritative records under normal RLS. */
export const liveTables = [
  "profiles",
  "boat_owners",
  "boats",
  "boat_images",
  "boat_documents",
  "locations",
  "routes",
  "boat_schedules",
  "bookings",
  "payments",
  "commission_rules",
  "platform_commissions",
  "refunds",
  "payouts",
  "reviews",
  "notifications",
  "support_tickets",
  "admin_audit_logs",
  "app_settings",
  "saved_boats",
  "document_requirements",
] as const;
export type LivePhase =
  | "unconfigured"
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "needs_setup";
export type LiveState = { phase: LivePhase; lastEventAt: number | null };
export const liveLabels: Record<LivePhase, string> = {
  unconfigured: "Not connected",
  connecting: "Connecting",
  live: "Live updates",
  reconnecting: "Reconnecting",
  offline: "Offline",
  needs_setup: "Live setup required",
};

/** A clock change is not a database write. Requery exactly at the next visible time boundary. */
export function nextBoundaryDelay(
  data: unknown,
  now = Date.now(),
  fallback = 60000,
): number {
  let nearest = now + fallback;
  let visited = 0;
  const seen = new WeakSet<object>();
  function walk(value: unknown, depth: number) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 12 ||
      visited++ > 20000 ||
      seen.has(value)
    )
      return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, depth + 1));
      return;
    }
    for (const [key, v] of Object.entries(value)) {
      if (
        typeof v === "string" &&
        [
          "next_change_at",
          "starts_at",
          "ends_at",
          "reservation_expires_at",
        ].includes(key)
      ) {
        const t = Date.parse(v);
        if (t > now && t < nearest) nearest = t;
      } else if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  walk(data, 0);
  return Math.max(100, Math.min(fallback, nearest - now + 100));
}

export function watchLive(
  client: SupabaseClient,
  options: {
    enabled: boolean;
    authenticated: boolean;
    refresh: () => void | Promise<unknown>;
    snapshot: () => unknown;
    state: (s: LiveState) => void;
    coalesceMs?: number;
    fallbackMs?: number;
  },
) {
  let channel: RealtimeChannel | null = null;
  let stopped = false;
  let online = true;
  let sequence = 0;
  let state: LiveState = {
    phase: options.enabled ? "connecting" : "unconfigured",
    lastEventAt: null,
  };
  let changeTimer: ReturnType<typeof setTimeout> | undefined,
    boundaryTimer: ReturnType<typeof setTimeout> | undefined,
    retryTimer: ReturnType<typeof setTimeout> | undefined;
  const publish = (phase: LivePhase) => {
    if (stopped) return;
    state = { ...state, phase };
    options.state(state);
  };
  const detach = () => {
    if (channel) {
      const old = channel;
      channel = null;
      void client.removeChannel(old);
    }
  };
  function scheduleBoundary() {
    clearTimeout(boundaryTimer);
    if (stopped || !online || !options.enabled) return;
    boundaryTimer = setTimeout(
      () => {
        void refreshSnapshot().finally(scheduleBoundary);
      },
      nextBoundaryDelay(
        options.snapshot(),
        Date.now(),
        options.fallbackMs ?? 60000,
      ),
    );
  }
  async function refreshSnapshot() {
    if (stopped || !online) return;
    try {
      await options.refresh();
    } catch {
      /* Query errors stay visible in their owning screens. */
    }
  }
  function changed() {
    if (stopped) return;
    state = { ...state, lastEventAt: Date.now() };
    options.state(state);
    if (changeTimer) return;
    changeTimer = setTimeout(() => {
      changeTimer = undefined;
      void refreshSnapshot().finally(scheduleBoundary);
    }, options.coalesceMs ?? 150);
  }
  async function connect() {
    const mine = ++sequence;
    clearTimeout(retryTimer);
    detach();
    if (stopped || !options.enabled || !online) return;
    publish(state.lastEventAt === null ? "connecting" : "reconnecting");
    try {
      const health = await client.rpc("realtime_health");
      if (stopped || mine !== sequence) return;
      if (health.error) {
        publish("reconnecting");
        retryTimer = setTimeout(() => void connect(), 5000);
        return;
      }
      if (!health.data?.ready) {
        publish("needs_setup");
        scheduleBoundary();
        retryTimer = setTimeout(() => void connect(), 30000);
        return;
      }
      const current = client.channel(
        `bangkago-live-${options.authenticated ? "account" : "public"}-${mine}-${Math.random().toString(36).slice(2)}`,
      );
      channel = current;
      current.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_events" },
        changed,
      );
      current.subscribe((status) => {
        if (stopped || mine !== sequence) return;
        if (status === "SUBSCRIBED") {
          clearTimeout(retryTimer);
          publish("live");
          void refreshSnapshot().finally(scheduleBoundary);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          publish(online ? "reconnecting" : "offline");
          clearTimeout(retryTimer);
          if (online) retryTimer = setTimeout(() => void connect(), 5000);
        }
      });
    } catch {
      if (stopped || mine !== sequence) return;
      publish("reconnecting");
      retryTimer = setTimeout(() => void connect(), 5000);
    }
  }
  options.state(state);
  if (options.enabled) {
    scheduleBoundary();
    void connect();
  }
  return {
    reschedule: scheduleBoundary,
    reconnect() {
      if (!stopped && online && options.enabled) {
        void refreshSnapshot();
        void connect();
      }
    },
    setOnline(value: boolean) {
      if (online === value) return;
      online = value;
      if (!value) {
        ++sequence;
        clearTimeout(retryTimer);
        clearTimeout(boundaryTimer);
        clearTimeout(changeTimer);
        changeTimer = undefined;
        detach();
        publish(options.enabled ? "offline" : "unconfigured");
      } else if (options.enabled && !stopped) {
        scheduleBoundary();
        void connect();
      }
    },
    stop() {
      stopped = true;
      ++sequence;
      clearTimeout(changeTimer);
      clearTimeout(boundaryTimer);
      clearTimeout(retryTimer);
      detach();
    },
  };
}
