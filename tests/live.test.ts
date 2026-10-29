import { afterEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  watchLive,
  nextBoundaryDelay,
  bookingViewStatus,
  durationLabel,
  type LiveState,
} from "../packages/shared/src/index";
function transport(ready = true) {
  const handlers: { filter: Record<string, string>; fn: () => void }[] = [];
  let status: (s: string) => void = () => {};
  const channel = {
    on: vi.fn(
      (_event: string, filter: Record<string, string>, fn: () => void) => {
        handlers.push({ filter, fn });
        return channel;
      },
    ),
    subscribe: vi.fn((fn: (s: string) => void) => {
      status = fn;
      return channel;
    }),
  };
  const client = {
    rpc: vi.fn(async () => ({ data: { ready }, error: null })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => {}),
  };
  return {
    client: client as unknown as SupabaseClient,
    raw: client,
    handlers,
    status: (s: string) => status(s),
  };
}
afterEach(() => vi.useRealTimers());
describe("Live updates transport and recovery", () => {
  it("never opens a connection when configuration is missing", () => {
    const t = transport();
    const states: LiveState[] = [];
    const watch = watchLive(t.client, {
      enabled: false,
      authenticated: false,
      refresh: vi.fn(),
      snapshot: () => [],
      state: (s) => states.push(s),
    });
    expect(t.raw.rpc).not.toHaveBeenCalled();
    expect(states.at(-1)?.phase).toBe("unconfigured");
    watch.stop();
  });
  it("does not claim Live if replication is not ready", async () => {
    vi.useFakeTimers();
    const t = transport(false);
    const states: LiveState[] = [];
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh: vi.fn(),
      snapshot: () => [],
      state: (s) => states.push(s),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)?.phase).toBe("needs_setup");
    expect(t.raw.channel).not.toHaveBeenCalled();
    w.stop();
  });
  it("subscribes only to sanitized INSERT signals, never private rows or DELETE payloads", async () => {
    vi.useFakeTimers();
    const t = transport();
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh: vi.fn(),
      snapshot: () => [],
      state: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.handlers.map((h) => h.filter)).toEqual([
      { event: "INSERT", schema: "public", table: "live_events" },
    ]);
    w.stop();
  });
  it("coalesces a transaction burst and refetches authoritative snapshots", async () => {
    vi.useFakeTimers();
    const t = transport();
    const refresh = vi.fn();
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh,
      snapshot: () => [],
      state: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    t.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    t.handlers[0].fn();
    t.handlers[0].fn();
    t.handlers[0].fn();
    await vi.advanceTimersByTimeAsync(151);
    expect(refresh).toHaveBeenCalledTimes(2);
    w.stop();
  });
  it("takes a fresh snapshot after reconnect instead of assuming missed events are replayed", async () => {
    vi.useFakeTimers();
    const t = transport();
    const refresh = vi.fn();
    const states: LiveState[] = [];
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh,
      snapshot: () => [],
      state: (s) => states.push(s),
    });
    await vi.advanceTimersByTimeAsync(0);
    t.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    t.status("CHANNEL_ERROR");
    expect(states.at(-1)?.phase).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(5001);
    t.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.raw.rpc).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.phase).toBe("live");
    w.stop();
  });
  it("reports offline and recovers when network returns", async () => {
    vi.useFakeTimers();
    const t = transport();
    const states: LiveState[] = [];
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh: vi.fn(),
      snapshot: () => [],
      state: (s) => states.push(s),
    });
    await vi.advanceTimersByTimeAsync(0);
    w.setOnline(false);
    expect(states.at(-1)?.phase).toBe("offline");
    w.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    t.status("SUBSCRIBED");
    expect(states.at(-1)?.phase).toBe("live");
    w.stop();
  });
  it("cleans up pending callbacks and channels on logout or unmount", async () => {
    vi.useFakeTimers();
    const t = transport();
    const refresh = vi.fn();
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: true,
      refresh,
      snapshot: () => [],
      state: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    t.handlers[0].fn();
    w.stop();
    await vi.advanceTimersByTimeAsync(120000);
    expect(refresh).not.toHaveBeenCalled();
    expect(t.raw.removeChannel).toHaveBeenCalledTimes(1);
  });
  it("refreshes at a hold expiry even if no database transaction happens", async () => {
    vi.useFakeTimers();
    const t = transport();
    const refresh = vi.fn();
    const w = watchLive(t.client, {
      enabled: true,
      authenticated: false,
      refresh,
      snapshot: () => [
        { next_change_at: new Date(Date.now() + 2000).toISOString() },
      ],
      state: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(2101);
    expect(refresh).toHaveBeenCalledTimes(1);
    w.stop();
  });
});
describe("Time-sensitive availability", () => {
  it("finds the nearest boundary inside nested query data", () =>
    expect(
      nextBoundaryDelay(
        [
          {
            starts_at: new Date(20000).toISOString(),
            nested: { reservation_expires_at: new Date(5000).toISOString() },
          },
        ],
        1000,
      ),
    ).toBe(4100));
  it("ignores past boundaries and keeps a bounded recovery refresh", () =>
    expect(
      nextBoundaryDelay(
        [{ next_change_at: new Date(500).toISOString() }],
        1000,
      ),
    ).toBe(60000));
  it("handles cyclic cached objects", () => {
    const x: { self?: unknown } = {};
    x.self = x;
    expect(nextBoundaryDelay(x, 1000)).toBe(60000);
  });
  it("expires only unpaid hold displays, never paid or completed journeys", () => {
    const expiry = new Date(500).toISOString();
    expect(
      bookingViewStatus(
        { status: "awaiting_payment", reservation_expires_at: expiry },
        1000,
      ),
    ).toBe("expired");
    expect(
      bookingViewStatus(
        { status: "confirmed", reservation_expires_at: expiry },
        1000,
      ),
    ).toBe("confirmed");
    expect(
      bookingViewStatus(
        { status: "completed", reservation_expires_at: expiry },
        1000,
      ),
    ).toBe("completed");
  });
  it("formats trip durations clearly across minutes and hours", () => {
    expect(
      durationLabel("2026-10-29T08:00:00+08:00", "2026-10-29T08:45:00+08:00"),
    ).toBe("45m");
    expect(
      durationLabel("2026-10-29T08:00:00+08:00", "2026-10-29T09:00:00+08:00"),
    ).toBe("1h");
    expect(
      durationLabel("2026-10-29T08:00:00+08:00", "2026-10-29T09:30:00+08:00"),
    ).toBe("1h 30m");
  });
});
