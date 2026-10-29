import { z } from "zod";
export * from "./live";
export * from "./art";
import type { SupabaseClient } from "@supabase/supabase-js";
export const tokens = {
  colors: {
    navy: "#0B2D59",
    ocean: "#1769E0",
    blue: "#3B82F6",
    ice: "#EAF3FF",
    background: "#F7FAFF",
    surface: "#FFFFFF",
    text: "#172B4D",
    muted: "#64748B",
    border: "#E2EAF5",
    success: "#15803D",
    warning: "#D97706",
    error: "#DC2626",
  },
  radius: { sm: 8, md: 16, lg: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  touch: 48,
};
export type Role = "passenger" | "owner" | "admin";
export type BookingStatus =
  | "pending_owner_confirmation"
  | "awaiting_payment"
  | "confirmed"
  | "completed"
  | "rejected"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded";
export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Use at least 10 characters"),
  display_name: z.string().min(2).max(80).optional(),
  role: z.enum(["passenger", "owner"]).default("passenger"),
});
export const boatSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(2000).default(""),
  boat_type: z.enum(["motorized_bangka", "speedboat", "passenger_boat"]),
  capacity: z.coerce.number().int().min(1).max(200),
  home_location_id: z.string().uuid(),
  charter_price: z.coerce.number().min(0).max(1000000),
  seat_price: z.coerce.number().min(0).max(1000000),
});
export const bookingSchema = z.object({
  schedule_id: z.string().uuid(),
  passenger_count: z.coerce.number().int().min(1).max(200),
  idempotency_key: z.string().uuid(),
  policy_accepted: z.literal(true),
  instructions: z.string().max(500).default(""),
});
export const scheduleSchema = z
  .object({
    boat_id: z.string().uuid(),
    route_id: z.string().uuid(),
    mode: z.enum(["charter", "seat"]),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    price_minor: z.number().int().positive(),
    capacity: z.number().int().positive(),
  })
  .refine(
    (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
    "Arrival must follow departure",
  );
export const php = (minor: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    minor / 100,
  );
export const tripDate = (s: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(s));
export const durationLabel = (startsAt: string, endsAt: string) => {
  const mins = Math.max(
    1,
    Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60000),
  );
  if (!Number.isFinite(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
export function splitFare(base: number, rateBps: number, serviceFee = 0) {
  if (
    ![base, rateBps, serviceFee].every(Number.isSafeInteger) ||
    base < 0 ||
    serviceFee < 0 ||
    rateBps < 0 ||
    rateBps > 10000
  )
    throw new Error("Invalid money input");
  const commission = Number((BigInt(base) * BigInt(rateBps) + 5000n) / 10000n);
  return {
    base,
    commission,
    serviceFee,
    total: base + serviceFee,
    operator: base - commission,
  };
}
export const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending_owner_confirmation: [
    "awaiting_payment",
    "rejected",
    "cancelled",
    "expired",
  ],
  awaiting_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["completed", "refund_pending"],
  completed: [],
  rejected: [],
  cancelled: ["refund_pending"],
  expired: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
};
export const canTransition = (a: BookingStatus, b: BookingStatus) =>
  transitions[a].includes(b);
/** A hold can expire by time without a write. This display value never changes paid states. */
export function bookingViewStatus(
  booking:
    | { status: string; reservation_expires_at?: string }
    | Record<string, unknown>,
  now = Date.now(),
): string {
  const status =
    typeof booking.status === "string" ? booking.status : "unknown";
  return ["pending_owner_confirmation", "awaiting_payment"].includes(status) &&
    typeof booking.reservation_expires_at === "string" &&
    Date.parse(booking.reservation_expires_at) <= now
    ? "expired"
    : status;
}
export function api(client: SupabaseClient) {
  return {
    async rows(table: string, select = "*"): Promise<Record<string, any>[]> {
      const { data, error } = await client.from(table).select(select);
      if (error) throw error;
      return (data ?? []) as unknown as Record<string, any>[];
    },
    async rpc(name: string, args: Record<string, unknown> = {}) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return data;
    },
    async edge(name: string, body: Record<string, unknown>) {
      const { data, error } = await client.functions.invoke(name, { body });
      if (error) {
        if (typeof client.rpc === "function") {
          if (name === "create-booking") {
            const rpcRes = await client.rpc("reserve_booking", {
              p_schedule: body.schedule_id,
              p_count: body.passenger_count,
              p_key: body.idempotency_key,
              p_instructions: body.instructions ?? "",
            });
            if (rpcRes.error) throw rpcRes.error;
            return rpcRes.data;
          }
          if (name === "approve-boat") {
            const rpcRes = await client.rpc("review_boat", {
              p_id: body.boat_id,
              p_status: body.status,
              p_reason: body.reason,
            });
            if (rpcRes.error) throw rpcRes.error;
            return { saved: true };
          }
          if (name === "process-payout") {
            const rpcRes = await client.rpc("admin_action", {
              p_action: "payout_settle",
              p_id: body.id,
              p_data: {
                reason: body.reason,
                bank_reference: body.bank_reference,
              },
            });
            if (rpcRes.error) throw rpcRes.error;
            return { status: "settled" };
          }
          if (name === "create-payment-checkout") {
            const rpcRes = await client.rpc("complete_direct_payment", {
              p_booking: body.booking_id,
            });
            if (rpcRes.error) throw rpcRes.error;
            return { paid_directly: true, status: rpcRes.data };
          }
          if (name === "reconcile-payment") {
            const rpcRes = await client.rpc("admin_reconcile_payment", {
              p_payment: body.id,
            });
            if (rpcRes.error) throw rpcRes.error;
            return { status: rpcRes.data };
          }
          if (name === "process-refund") {
            const rpcRes = await client.rpc("admin_process_refund", {
              p_refund: body.id,
              p_reason: body.reason,
            });
            if (rpcRes.error) throw rpcRes.error;
            return { status: "confirmed" };
          }
        }
        let message = error.message;
        if (error.context instanceof Response) {
          try {
            message = (await error.context.json()).error ?? message;
          } catch {
            /* non JSON gateway error */
          }
        }
        throw new Error(message);
      }
      return data;
    },
  };
}
